import crypto from 'node:crypto';
import { db } from './db.js';
import {
  WusaStoredEvent,
  RecurringSeries,
  SyncRun,
  CollectorConfig,
  VenueData,
  OrganizerData
} from './types.js';
import {
  decodeHtmlEntities,
  sanitizeHtml,
  stripHtmlToText,
  parseEventHtmlPage,
  extractRegistrationLinks
} from './htmlParser.js';

const USER_AGENT = 'WatHive-EventCollector/1.0 (+https://wathive.uwaterloo.ca; contact: info@wathive.ca)';

export class WusaCollector {
  private isRunning = false;

  public isBusy(): boolean {
    return this.isRunning;
  }

  /**
   * Helper sleep with polite delay
   */
  private async sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Fetch with exponential backoff and Retry-After support
   */
  private async fetchWithRetry(url: string, retries = 3, baseDelayMs = 500): Promise<{ ok: boolean; status: number; text: string }> {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': USER_AGENT,
            'Accept': 'application/json, text/html, */*'
          }
        });

        // Respect 429 Rate Limiting
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          const waitTime = retryAfter ? parseInt(retryAfter, 10) * 1000 : 3000;
          console.warn(`[WusaCollector] 429 Rate Limited. Backing off for ${waitTime}ms`);
          await this.sleep(waitTime);
          continue;
        }

        if (response.status >= 500 && attempt < retries) {
          const delay = baseDelayMs * Math.pow(2, attempt);
          await this.sleep(delay);
          continue;
        }

        const text = await response.text();
        return { ok: response.ok, status: response.status, text };
      } catch (err: any) {
        if (attempt < retries) {
          const delay = baseDelayMs * Math.pow(2, attempt);
          console.warn(`[WusaCollector] Network fetch error (${err.message}), retrying in ${delay}ms...`);
          await this.sleep(delay);
          continue;
        }
        return { ok: false, status: 0, text: err.message || 'Network error' };
      }
    }
    return { ok: false, status: 500, text: 'Max retries exceeded' };
  }

  /**
   * Determine exact America/Toronto UTC offset for a given timestamp
   */
  public getTorontoIsoString(dateStr: string, timeStr?: string): { iso: string; formatted: string } {
    // If input already has format "YYYY-MM-DD HH:mm:ss"
    const cleaned = dateStr.replace('T', ' ').trim();
    const [datePart, timePartRaw] = cleaned.split(' ');
    const timePart = timeStr || timePartRaw || '00:00:00';
    const dateTimeStr = `${datePart} ${timePart.length === 5 ? timePart + ':00' : timePart}`;

    // Determine DST offset for America/Toronto on that specific calendar date
    const probeDate = new Date(`${datePart}T12:00:00Z`);
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Toronto',
      timeZoneName: 'shortOffset'
    });
    const parts = formatter.formatToParts(probeDate);
    const tzPart = parts.find(p => p.type === 'timeZoneName')?.value || 'GMT-5';
    // e.g. "GMT-4" or "GMT-5"
    const offsetHours = tzPart.replace('GMT', '').trim();
    const sign = offsetHours.startsWith('+') ? '+' : '-';
    const numHour = Math.abs(parseInt(offsetHours, 10) || 5);
    const offsetStr = `${sign}${String(numHour).padStart(2, '0')}:00`;

    const iso = `${datePart}T${timePart.length === 5 ? timePart + ':00' : timePart}${offsetStr}`;
    return { iso, formatted: dateTimeStr };
  }

  /**
   * Classify event as upcoming, ongoing, or past
   */
  public classifyTemporalStatus(startIso: string, endIso: string | null): 'upcoming' | 'ongoing' | 'past' {
    const now = Date.now();
    const startTime = new Date(startIso).getTime();

    if (isNaN(startTime)) return 'upcoming';

    if (endIso) {
      const endTime = new Date(endIso).getTime();
      if (!isNaN(endTime)) {
        if (now < startTime) return 'upcoming';
        if (now >= startTime && now <= endTime) return 'ongoing';
        return 'past';
      }
    }

    // If no end time, assume event ends at end of the start day (or 2 hours after start)
    const assumedEnd = startTime + (2 * 60 * 60 * 1000);
    if (now < startTime) return 'upcoming';
    if (now >= startTime && now <= assumedEnd) return 'ongoing';
    return 'past';
  }

  /**
   * Execute sync run with concurrency lock
   */
  public async executeSync(triggerType: 'manual' | 'scheduled' = 'manual'): Promise<SyncRun> {
    if (this.isRunning) {
      throw new Error('A collection sync run is currently in progress. Overlapping jobs are strictly prohibited.');
    }

    this.isRunning = true;
    const runId = `run_${Date.now()}`;
    const startTime = new Date();
    const config = db.getConfig();

    const run: SyncRun = {
      id: runId,
      trigger_type: triggerType,
      started_at: startTime.toISOString(),
      completed_at: null,
      duration_ms: null,
      status: 'in_progress',
      events_found: 0,
      events_new: 0,
      events_updated: 0,
      events_unchanged: 0,
      events_failed: 0,
      pages_crawled: 0,
      page_limit_reached: false,
      error_message: null,
      logs: []
    };

    const addLog = (msg: string) => {
      const entry = `[${new Date().toISOString()}] ${msg}`;
      run.logs.push(entry);
      console.log(`[WusaCollector] ${msg}`);
    };

    addLog(`Initiating ${triggerType} sync run (${runId}). Scope: -${config.past_days_scope}d to +${config.future_days_scope}d`);
    db.recordSyncRunStart(run);

    try {
      // Calculate date scope in YYYY-MM-DD
      const nowMs = startTime.getTime();
      const pastMs = nowMs - (config.past_days_scope * 24 * 60 * 60 * 1000);
      const futureMs = nowMs + (config.future_days_scope * 24 * 60 * 60 * 1000);

      const pastDateStr = new Date(pastMs).toISOString().slice(0, 10);
      const futureDateStr = new Date(futureMs).toISOString().slice(0, 10);

      let currentApiUrl = `https://wusa.ca/wp-json/tribe/events/v1/events?start_date=${pastDateStr}+00:00:00&end_date=${futureDateStr}+23:59:59&per_page=20`;
      let pageNum = 1;
      const collectedEvents: WusaStoredEvent[] = [];

      addLog(`Querying primary REST API endpoint: ${currentApiUrl}`);

      // Loop through API pagination
      while (currentApiUrl && pageNum <= config.page_limit) {
        addLog(`Crawling API page ${pageNum}...`);
        const res = await this.fetchWithRetry(currentApiUrl);

        if (!res.ok) {
          addLog(`API fetch failed on page ${pageNum} with HTTP ${res.status}: ${res.text.slice(0, 200)}`);
          if (pageNum === 1) {
            throw new Error(`Primary endpoint unreachable (HTTP ${res.status})`);
          }
          break;
        }

        let data: any;
        try {
          data = JSON.parse(res.text);
        } catch (err: any) {
          addLog(`Failed to parse JSON response on page ${pageNum}: ${err.message}`);
          break;
        }

        run.pages_crawled = pageNum;
        const pageEvents: any[] = data.events || [];
        addLog(`Page ${pageNum} returned ${pageEvents.length} event items (Total expected: ${data.total || 'unknown'})`);

        for (const rawEv of pageEvents) {
          run.events_found++;
          try {
            const parsed = await this.processRawTribeEvent(rawEv, config, addLog);
            collectedEvents.push(parsed);

            // Upsert into persistent SQLite database
            const result = db.upsertEvent(parsed, runId);
            if (result.status === 'new') run.events_new++;
            else if (result.status === 'updated') run.events_updated++;
            else if (result.status === 'unchanged') run.events_unchanged++;
            else run.events_failed++;
          } catch (itemErr: any) {
            addLog(`Error processing event ${rawEv.id} (${rawEv.title}): ${itemErr.message}`);
            run.events_failed++;
          }

          // Polite rate limiting between event inspections
          if (config.request_delay_ms > 0) {
            await this.sleep(config.request_delay_ms);
          }
        }

        // Check next page URL
        if (data.next_rest_url && pageNum < config.page_limit) {
          currentApiUrl = data.next_rest_url;
          pageNum++;
          await this.sleep(config.request_delay_ms);
        } else {
          if (data.next_rest_url && pageNum >= config.page_limit) {
            run.page_limit_reached = true;
            addLog(`Configured page limit (${config.page_limit}) reached before all events were consumed. Flagging incomplete run.`);
          }
          break;
        }
      }

      // Check recurring series among collected events
      addLog(`Analyzing ${collectedEvents.length} events for recurring series and multi-day patterns...`);
      this.detectAndStoreSeries(collectedEvents, addLog);

      run.status = run.page_limit_reached ? 'incomplete' : 'completed';
      addLog(`Sync run ${runId} finished with status: ${run.status}. New: ${run.events_new}, Updated: ${run.events_updated}, Unchanged: ${run.events_unchanged}, Failed: ${run.events_failed}`);
    } catch (error: any) {
      run.status = 'failed';
      run.error_message = error.message || 'Unknown collection failure';
      addLog(`Sync run encountered fatal failure: ${run.error_message}`);
    } finally {
      const endTime = new Date();
      run.completed_at = endTime.toISOString();
      run.duration_ms = endTime.getTime() - startTime.getTime();
      this.isRunning = false;
      db.updateSyncRun(run);
    }

    return run;
  }

  /**
   * Process and normalize a single Tribe REST API event with detail enrichment
   */
  private async processRawTribeEvent(
    raw: any,
    config: CollectorConfig,
    addLog: (msg: string) => void
  ): Promise<WusaStoredEvent> {
    const id = String(raw.id);
    const title = decodeHtmlEntities(raw.title || 'Untitled Event').trim();
    const slug = raw.slug || null;
    const originalUrl = raw.url || `https://wusa.ca/event/${slug || id}/`;
    const descriptionHtml = sanitizeHtml(raw.description || '');
    const descriptionText = stripHtmlToText(raw.description || '');
    const excerpt = raw.excerpt ? decodeHtmlEntities(stripHtmlToText(raw.excerpt)) : null;

    // Review flags accumulator
    const reviewFlags: string[] = [];

    // Parse dates and time
    const startStr = raw.start_date || ''; // "2026-11-09 17:00:00"
    const endStr = raw.end_date || null;
    const allDay = Boolean(raw.all_day);
    const timezone = raw.timezone || 'America/Toronto';

    if (!startStr) {
      reviewFlags.push('Missing required start date');
    }

    const startInfo = this.getTorontoIsoString(startStr);
    let endInfo: { iso: string; formatted: string } | null = null;

    if (endStr && endStr.trim() !== '') {
      endInfo = this.getTorontoIsoString(endStr);
      // Check if end date is ambiguous or before start date
      if (new Date(endInfo.iso).getTime() < new Date(startInfo.iso).getTime()) {
        reviewFlags.push('Ambiguous end time: end timestamp occurs before start timestamp');
      }
    } else if (!allDay) {
      reviewFlags.push('Missing explicit end time');
    }

    // Check if multi-day
    const startDateOnly = startStr.slice(0, 10);
    const endDateOnly = endStr ? endStr.slice(0, 10) : startDateOnly;
    const isMultiDay = Boolean(endDateOnly && startDateOnly && endDateOnly !== startDateOnly);

    // Dynamic temporal classification
    const temporalStatus = this.classifyTemporalStatus(startInfo.iso, endInfo ? endInfo.iso : null);

    // Venue parsing
    let venue: VenueData | null = null;
    if (raw.venue && typeof raw.venue === 'object') {
      const v = raw.venue;
      // Extract room if mentioned in venue name or address
      let room: string | null = null;
      const combinedLocationStr = `${v.venue || ''} ${v.address || ''}`;
      const roomMatch = combinedLocationStr.match(/(?:room|rm|suite|hall|atrium|flex space)\s*[:#]?\s*([A-Za-z0-9-]+)/i);
      if (roomMatch) {
        room = roomMatch[0].trim();
      }

      // Check coordinates: ONLY if explicitly provided in venue data
      let latitude: number | null = null;
      let longitude: number | null = null;
      if (v.geo && typeof v.geo === 'object' && v.geo.latitude && v.geo.longitude) {
        latitude = parseFloat(v.geo.latitude) || null;
        longitude = parseFloat(v.geo.longitude) || null;
      } else if (v.lat && v.lng) {
        latitude = parseFloat(v.lat) || null;
        longitude = parseFloat(v.lng) || null;
      }

      venue = {
        id: v.id || null,
        name: decodeHtmlEntities(v.venue || 'WUSA Venue'),
        room,
        address: v.address ? decodeHtmlEntities(v.address) : null,
        city: v.city ? decodeHtmlEntities(v.city) : 'Waterloo',
        province: v.province || v.stateprovince || 'ON',
        postal_code: v.zip || null,
        country: v.country || 'Canada',
        latitude,
        longitude,
        website: v.website || null
      };
    }

    // Organizer parsing
    let organizer: OrganizerData | null = null;
    if (raw.organizer && Array.isArray(raw.organizer) && raw.organizer.length > 0) {
      const o = raw.organizer[0];
      organizer = {
        id: o.id || null,
        name: decodeHtmlEntities(o.organizer || 'WUSA Organizer'),
        email: o.email ? decodeHtmlEntities(o.email) : null,
        website: o.website || null,
        phone: o.phone || null,
        url: o.url || null
      };
    }

    // Category parsing
    const categories: string[] = [];
    if (raw.categories && Array.isArray(raw.categories)) {
      for (const c of raw.categories) {
        if (c.name) categories.push(decodeHtmlEntities(c.name));
      }
    }
    const primaryCategory = categories.length > 0 ? categories[0] : 'Campus Life';

    // Cost / Pricing: Preserve exact raw representation
    let cost: string | null = null;
    if (raw.cost !== undefined && raw.cost !== null && String(raw.cost).trim() !== '') {
      cost = decodeHtmlEntities(String(raw.cost)).trim();
    } else if (raw.cost_details && raw.cost_details.values && raw.cost_details.values.length > 0) {
      cost = raw.cost_details.values.join(' – ');
    }

    // Image URL
    let sourceImageUrl: string | null = null;
    if (raw.image && typeof raw.image === 'object') {
      sourceImageUrl = raw.image.url || (raw.image.sizes?.large?.url) || null;
    } else if (typeof raw.image === 'string') {
      sourceImageUrl = raw.image;
    }

    // Registration URL in raw data or description
    let registrationUrl = extractRegistrationLinks(raw.description || '');

    // Cancellation status
    let cancellationStatus: 'scheduled' | 'cancelled' | 'postponed' = 'scheduled';
    if (/\[\s*cancell?ed\s*\]|\b(cancelled|canceled)\b/i.test(title)) {
      cancellationStatus = 'cancelled';
    } else if (/\[\s*postponed\s*\]|\b(postponed)\b/i.test(title)) {
      cancellationStatus = 'postponed';
    }

    let registrationDeadline: string | null = null;

    // Optional detail enrichment from individual event page
    if (config.detail_enrichment_enabled && originalUrl) {
      try {
        const pageRes = await this.fetchWithRetry(originalUrl, 2, 400);
        if (!pageRes.ok) {
          reviewFlags.push(`Source event page unavailable (HTTP ${pageRes.status})`);
        } else {
          const enriched = parseEventHtmlPage(pageRes.text, pageRes.status);
          if (enriched.registrationUrl && !registrationUrl) {
            registrationUrl = enriched.registrationUrl;
          }
          if (enriched.registrationDeadline && !registrationDeadline) {
            registrationDeadline = enriched.registrationDeadline;
          }
          if (enriched.cancellationStatus !== 'scheduled') {
            cancellationStatus = enriched.cancellationStatus;
          }
          // If cost was unknown, check offers in JSON-LD
          if (!cost && enriched.offers.length > 0) {
            const firstOffer = enriched.offers[0];
            cost = typeof firstOffer.price === 'number' ? `$${firstOffer.price.toFixed(2)} CAD` : String(firstOffer.price);
          }
        }
      } catch (err: any) {
        addLog(`Enrichment visit for ${originalUrl} failed: ${err.message}`);
        reviewFlags.push(`Detail page check failed: ${err.message}`);
      }
    }

    // Content hash for change detection
    const hashPayload = `${title}|${startInfo.iso}|${endInfo?.iso || ''}|${cost || ''}|${venue?.name || ''}|${cancellationStatus}`;
    const contentHash = crypto.createHash('sha256').update(hashPayload).digest('hex');

    const reviewStatus: 'clean' | 'needs_review' = reviewFlags.length > 0 ? 'needs_review' : 'clean';

    return {
      id,
      title,
      slug,
      description: descriptionHtml,
      description_text: descriptionText,
      excerpt,
      organizer,
      start_date: startInfo.formatted,
      end_date: endInfo ? endInfo.formatted : null,
      start_iso: startInfo.iso,
      end_iso: endInfo ? endInfo.iso : null,
      timezone,
      all_day: allDay,
      venue,
      category: primaryCategory,
      categories,
      cost,
      registration_url: registrationUrl,
      registration_deadline: registrationDeadline,
      source_image_url: sourceImageUrl,
      original_wusa_url: originalUrl,
      cancellation_status: cancellationStatus,
      temporal_status: temporalStatus,
      is_multi_day: isMultiDay,
      is_recurring: false, // Detected in series pass
      series_id: null,
      recurrence_rule: raw.recurrence ? JSON.stringify(raw.recurrence) : null,
      review_status: reviewStatus,
      review_flags: reviewFlags,
      approval_status: 'pending',
      admin_notes: null,
      content_hash: contentHash,
      first_imported_at: new Date().toISOString(),
      last_checked_at: new Date().toISOString(),
      last_changed_at: new Date().toISOString(),
      raw_payload: JSON.stringify(raw)
    };
  }

  /**
   * Group recurring event occurrences into separate series records
   * Rule: Multi-day events are NOT recurring events.
   */
  private detectAndStoreSeries(events: WusaStoredEvent[], addLog: (msg: string) => void) {
    const seriesCandidates = new Map<string, WusaStoredEvent[]>();

    for (const ev of events) {
      // Do not consider multi-day events as recurring series
      if (ev.is_multi_day) continue;

      // Extract base slug without numerical occurrence suffixes like -2, -5, -6
      const baseSlug = (ev.slug || ev.title.toLowerCase())
        .replace(/-\d+$/, '')
        .replace(/\s+\d+$/, '')
        .replace(/[^a-zA-Z0-9-]/g, '')
        .toLowerCase();

      if (!seriesCandidates.has(baseSlug)) {
        seriesCandidates.set(baseSlug, []);
      }
      seriesCandidates.get(baseSlug)!.push(ev);
    }

    for (const [baseSlug, occurrences] of seriesCandidates.entries()) {
      if (occurrences.length > 1) {
        // Distinct occurrence dates verify a true recurring series
        const dates = occurrences.map(o => o.start_date.slice(0, 10)).sort();
        const uniqueDates = Array.from(new Set(dates));

        if (uniqueDates.length > 1) {
          const seriesId = `series_${baseSlug}`;
          let seriesTitle = occurrences[0].title.replace(/[:\-–—\d]+$/, '').trim();
          if (!seriesTitle || seriesTitle.toLowerCase() === 'n/a') {
            seriesTitle = baseSlug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
          }

          const series: RecurringSeries = {
            id: seriesId,
            title: seriesTitle,
            slug_base: baseSlug,
            recurrence_description: `${uniqueDates.length} confirmed schedule occurrences published on WUSA`,
            total_occurrences: occurrences.length,
            first_occurrence: uniqueDates[0],
            last_occurrence: uniqueDates[uniqueDates.length - 1],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };

          db.upsertSeries(series);
          addLog(`Identified recurring series "${seriesTitle}" with ${occurrences.length} occurrences (${uniqueDates.join(', ')})`);

          // Update occurrences with series reference
          for (const ev of occurrences) {
            ev.is_recurring = true;
            ev.series_id = seriesId;
            db.updateEventManual(ev.id, {
              is_recurring: true,
              series_id: seriesId
            });
          }
        }
      }
    }
  }
}

export const collector = new WusaCollector();
