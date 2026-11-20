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
  stripHtmlToText,
  parseEventHtmlPage,
  extractRegistrationLinks,
  sanitizeHttpUrl,
  capString
} from './htmlParser.js';
import {
  getTorontoOffsetStringForWallClock,
  torontoWallClockToUtcMs
} from '../src/utils/eventLifecycle.js';
import { communityCollector } from './communitySources.js';

const USER_AGENT = 'WatHive-EventCollector/1.0 (+https://wathive.uwaterloo.ca; contact: info@wathive.ca)';
const ALLOWED_WUSA_HOSTS = new Set(['wusa.ca', 'www.wusa.ca']);
const MAX_FETCH_BYTES = 2 * 1024 * 1024; // 2 MB cap per remote response
const FETCH_TIMEOUT_MS = 10_000;
const MAX_REDIRECT_HOPS = 3;

export class WusaCollector {
  private isRunning = false;

  public isBusy(): boolean {
    return this.isRunning;
  }

  /**
   * Ensure remote collector requests strictly target HTTPS on allowlisted wusa.ca hosts.
   */
  private assertAllowedWusaUrl(rawUrl: string): URL {
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      throw new Error('Blocked invalid remote URL');
    }
    if (parsed.protocol !== 'https:') {
      throw new Error(`Blocked non-HTTPS collector URL: ${parsed.protocol}`);
    }
    if (!ALLOWED_WUSA_HOSTS.has(parsed.hostname.toLowerCase())) {
      throw new Error(`Blocked non-allowlisted host: ${parsed.hostname}`);
    }
    if (parsed.username || parsed.password) {
      throw new Error('Blocked URL with embedded credentials');
    }
    return parsed;
  }

  /**
   * Read a bounded response body up to MAX_FETCH_BYTES.
   */
  private async readBoundedText(response: Response, maxBytes = MAX_FETCH_BYTES): Promise<string> {
    const contentLengthHeader = response.headers.get('content-length');
    if (contentLengthHeader) {
      const declaredBytes = parseInt(contentLengthHeader, 10);
      if (Number.isFinite(declaredBytes) && declaredBytes > maxBytes) {
        throw new Error(`Response exceeded max size limit (${declaredBytes} > ${maxBytes} bytes)`);
      }
    }

    if (!response.body) {
      const text = await response.text();
      if (Buffer.byteLength(text, 'utf8') > maxBytes) {
        throw new Error(`Response exceeded max size limit (${maxBytes} bytes)`);
      }
      return text;
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        totalBytes += value.byteLength;
        if (totalBytes > maxBytes) {
          await reader.cancel().catch(() => {});
          throw new Error(`Response stream exceeded max size limit (${maxBytes} bytes)`);
        }
        chunks.push(value);
      }
    }

    return Buffer.concat(chunks.map((c) => Buffer.from(c.buffer, c.byteOffset, c.byteLength))).toString('utf8');
  }

  /**
   * Perform a single allowlisted fetch with manual redirect verification on wusa.ca hosts.
   */
  private async fetchAllowlisted(
    rawUrl: string,
    acceptHeader: string,
    timeoutMs = FETCH_TIMEOUT_MS
  ): Promise<Response> {
    let currentUrl = this.assertAllowedWusaUrl(rawUrl).toString();

    for (let hop = 0; hop <= MAX_REDIRECT_HOPS; hop++) {
      const response = await fetch(currentUrl, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': acceptHeader
        },
        redirect: 'manual',
        signal: AbortSignal.timeout(timeoutMs)
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location || hop === MAX_REDIRECT_HOPS) {
          throw new Error(`Redirect limit or missing Location header (${response.status})`);
        }
        const resolvedRedirect = new URL(location, currentUrl).toString();
        currentUrl = this.assertAllowedWusaUrl(resolvedRedirect).toString();
        continue;
      }

      return response;
    }

    throw new Error('Exceeded maximum redirect hops');
  }

  /**
   * Helper sleep with polite delay
   */
  private async sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Fetch and parse robots.txt disallow rules politely for wusa.ca
   */
  private async fetchDisallowedPaths(addLog: (msg: string) => void): Promise<string[]> {
    try {
      const res = await this.fetchAllowlisted('https://wusa.ca/robots.txt', 'text/plain, */*', 4000);
      if (!res.ok) return [];
      const text = await this.readBoundedText(res, 256 * 1024);
      const lines = text.split(/\r?\n/);
      const disallows: string[] = [];
      let applies = false;
      for (const rawLine of lines) {
        const line = rawLine.split('#')[0].trim();
        if (!line) continue;
        const lower = line.toLowerCase();
        if (lower.startsWith('user-agent:')) {
          const agent = line.slice('user-agent:'.length).trim().toLowerCase();
          applies = agent === '*' || agent.includes('wathive');
        } else if (applies && lower.startsWith('disallow:')) {
          const pathRule = line.slice('disallow:'.length).trim();
          if (pathRule) disallows.push(pathRule);
        }
      }
      addLog(`Checked robots.txt (${disallows.length} disallow rules active)`);
      return disallows;
    } catch {
      addLog('robots.txt check unavailable (network/timeout); proceeding politely with rate limiting.');
      return [];
    }
  }

  private isAllowedByRobots(url: string, disallows: string[]): boolean {
    try {
      const parsed = this.assertAllowedWusaUrl(url);
      const pathname = parsed.pathname + parsed.search;
      return !disallows.some(rule => rule !== '/' && pathname.startsWith(rule));
    } catch {
      return false;
    }
  }

  /**
   * Fetch with exponential backoff, host allowlist, timeout, size cap, and Retry-After support
   */
  private async fetchWithRetry(url: string, retries = 3, baseDelayMs = 500): Promise<{ ok: boolean; status: number; text: string }> {
    this.assertAllowedWusaUrl(url);

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await this.fetchAllowlisted(url, 'application/json, text/html, */*', FETCH_TIMEOUT_MS);

        // Respect 429 Rate Limiting (bounded backoff up to 15s)
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          const parsedSeconds = retryAfter ? parseInt(retryAfter, 10) : NaN;
          const waitTime = Number.isFinite(parsedSeconds)
            ? Math.min(15_000, Math.max(1000, parsedSeconds * 1000))
            : 3000;
          console.warn(`[WusaCollector] 429 Rate Limited. Backing off for ${waitTime}ms`);
          await this.sleep(waitTime);
          continue;
        }

        if (response.status >= 500 && attempt < retries) {
          const delay = baseDelayMs * Math.pow(2, attempt);
          await this.sleep(delay);
          continue;
        }

        const text = await this.readBoundedText(response);
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
   * Determine exact America/Toronto UTC offset and UTC ISO for a given wall-clock timestamp
   */
  public getTorontoIsoString(dateStr: string, timeStr?: string): { iso: string; utcIso: string; formatted: string } {
    const cleaned = dateStr.replace('T', ' ').trim();
    const [datePart, timePartRaw] = cleaned.split(' ');
    const timeBase = timeStr || timePartRaw || '00:00:00';
    const normalizedTime = timeBase.length === 5 ? `${timeBase}:00` : timeBase.slice(0, 8);
    const dateTimeStr = `${datePart} ${normalizedTime}`;

    const offsetStr = getTorontoOffsetStringForWallClock(datePart, normalizedTime);
    const utcMs = torontoWallClockToUtcMs(
      datePart,
      normalizedTime,
      normalizedTime === '23:59:59' ? 999 : 0
    );
    const utcIso = Number.isFinite(utcMs)
      ? new Date(utcMs).toISOString()
      : new Date(`${datePart}T${normalizedTime}${offsetStr}`).toISOString();

    const iso = `${datePart}T${normalizedTime}${offsetStr}`;
    return { iso, utcIso, formatted: dateTimeStr };
  }

  /**
   * Classify event as upcoming, ongoing, or past using canonical end instant
   */
  public classifyTemporalStatus(startIso: string, endIso: string | null): 'upcoming' | 'ongoing' | 'past' {
    const now = Date.now();
    const startTime = Date.parse(startIso);

    if (Number.isNaN(startTime)) return 'upcoming';

    if (endIso) {
      const endTime = Date.parse(endIso);
      if (!Number.isNaN(endTime)) {
        if (now < startTime) return 'upcoming';
        if (now >= startTime && now < endTime) return 'ongoing';
        return 'past';
      }
    }

    // Fallback: end of start day in America/Toronto (23:59:59.999)
    const fallbackEndMs = torontoWallClockToUtcMs(startIso.slice(0, 10), '23:59:59', 999);
    if (now < startTime) return 'upcoming';
    if (Number.isFinite(fallbackEndMs) && now < fallbackEndMs) return 'ongoing';
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

    let wusaErrorMessage: string | null = null;
    try {
      const disallowedPaths = await this.fetchDisallowedPaths(addLog);
      // Archive any previously stored events that have ended in America/Toronto
      db.archivePastEvents();

      // Calculate active date scope in America/Toronto (skip past window for ingestion)
      const { dateStr: torontoToday } = db.getTorontoDateTimeNow(startTime);
      const futureMs = startTime.getTime() + (config.future_days_scope * 24 * 60 * 60 * 1000);
      const futureDateStr = new Date(futureMs).toISOString().slice(0, 10);

      let currentApiUrl = `https://wusa.ca/wp-json/tribe/events/v1/events?start_date=${torontoToday}+00:00:00&end_date=${futureDateStr}+23:59:59&per_page=20`;
      let pageNum = 1;
      const collectedEvents: WusaStoredEvent[] = [];

      addLog(`Querying primary REST API endpoint: ${currentApiUrl}`);

      // Loop through API pagination
      while (currentApiUrl && pageNum <= config.page_limit) {
        if (!this.isAllowedByRobots(currentApiUrl, disallowedPaths)) {
          addLog(`Skipping disallowed endpoint per robots.txt: ${currentApiUrl}`);
          break;
        }
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
            const parsed = await this.processRawTribeEvent(rawEv, config, addLog, disallowedPaths);

            // Skip already-past events during ingestion (if already in DB, archivePastEvents handles it)
            if (parsed.temporal_status === 'past') {
              run.events_unchanged++;
              continue;
            }

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

        // Check next page URL (strictly allowlisted on wusa.ca)
        if (data.next_rest_url && pageNum < config.page_limit) {
          try {
            currentApiUrl = this.assertAllowedWusaUrl(String(data.next_rest_url)).toString();
          } catch (urlErr: any) {
            addLog(`Stopping pagination: blocked unsafe next_rest_url (${urlErr.message})`);
            break;
          }
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
    } catch (error: any) {
      wusaErrorMessage = error.message || 'Unknown collection failure';
      addLog(`WUSA sync encountered error: ${wusaErrorMessage}`);
    }

    try {
      const communityStats = await communityCollector.syncAll(addLog);
      if (communityStats.sourcesQueried > 0) {
        addLog(
          `Community sources queried: ${communityStats.sourcesQueried}, active synced: ${communityStats.eventsImported}, archived: ${communityStats.eventsArchived}, errors: ${communityStats.errors}`
        );
      }

      if (wusaErrorMessage) {
        run.error_message = wusaErrorMessage;
        run.status =
          communityStats.sourcesQueried > 0 && communityStats.errors < communityStats.sourcesQueried
            ? 'incomplete'
            : 'failed';
      } else {
        run.status = run.page_limit_reached ? 'incomplete' : 'completed';
      }
      const issueSuffix = run.events_failed > 0 ? `, Issues: ${run.events_failed}` : '';
      addLog(`Sync run ${runId} finished with status: ${run.status}. New: ${run.events_new}, Updated: ${run.events_updated}, Unchanged: ${run.events_unchanged}${issueSuffix}`);
    } catch (error: any) {
      run.status = 'failed';
      run.error_message = error.message || wusaErrorMessage || 'Unknown collection failure';
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
    addLog: (msg: string) => void,
    disallowedPaths: string[] = []
  ): Promise<WusaStoredEvent> {
    const id = capString(String(raw.id), 64);
    const title = capString(decodeHtmlEntities(raw.title || 'Untitled Event').trim(), 300) || 'Untitled Event';
    const slug = raw.slug ? capString(String(raw.slug), 200) : null;
    const fallbackUrl = `https://wusa.ca/event/${encodeURIComponent(slug || id)}/`;
    const originalUrl = sanitizeHttpUrl(raw.url) || fallbackUrl;
    const descriptionText = capString(stripHtmlToText(raw.description || ''), 10_000);
    const excerpt = raw.excerpt ? capString(stripHtmlToText(raw.excerpt), 1000) || null : null;

    // Review flags accumulator
    const reviewFlags: string[] = [];

    // Parse dates and time (preserve true multi-day end_date from WUSA API)
    const startStr = raw.start_date || ''; // "2026-11-09 17:00:00"
    const endStr = raw.end_date || null;
    const allDay = Boolean(raw.all_day);
    const timezone = raw.timezone || 'America/Toronto';

    if (!startStr) {
      reviewFlags.push('Missing required start date');
    }

    const startInfo = this.getTorontoIsoString(startStr);
    const startDateOnly = startStr.slice(0, 10);
    let endInfo: { iso: string; utcIso: string; formatted: string } | null = null;

    if (endStr && String(endStr).trim() !== '') {
      endInfo = this.getTorontoIsoString(String(endStr));
      // Check if end date is ambiguous or before start date
      if (Date.parse(endInfo.utcIso) < Date.parse(startInfo.utcIso)) {
        reviewFlags.push('Ambiguous end time: end timestamp occurs before start timestamp');
      }
    } else if (startDateOnly) {
      // Fallback to 23:59:59 on start date in America/Toronto
      endInfo = this.getTorontoIsoString(startDateOnly, '23:59:59');
      if (!allDay) {
        reviewFlags.push('Missing explicit end time');
      }
    }

    // Check if multi-day
    const endDateOnly = endInfo ? endInfo.formatted.slice(0, 10) : startDateOnly;
    const isMultiDay = Boolean(endDateOnly && startDateOnly && endDateOnly !== startDateOnly);

    // Dynamic temporal classification
    const temporalStatus = this.classifyTemporalStatus(startInfo.utcIso, endInfo ? endInfo.utcIso : null);

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
        name: capString(decodeHtmlEntities(v.venue || 'WUSA Venue'), 200),
        room: room ? capString(room, 100) : null,
        address: v.address ? capString(decodeHtmlEntities(v.address), 300) : null,
        city: v.city ? capString(decodeHtmlEntities(v.city), 100) : 'Waterloo',
        province: capString(v.province || v.stateprovince || 'ON', 50),
        postal_code: v.zip ? capString(String(v.zip), 30) : null,
        country: capString(v.country || 'Canada', 80),
        latitude,
        longitude,
        website: sanitizeHttpUrl(v.website)
      };
    }

    // Organizer parsing
    let organizer: OrganizerData | null = null;
    if (raw.organizer && Array.isArray(raw.organizer) && raw.organizer.length > 0) {
      const o = raw.organizer[0];
      organizer = {
        id: o.id || null,
        name: capString(decodeHtmlEntities(o.organizer || 'WUSA Organizer'), 200),
        email: o.email ? capString(decodeHtmlEntities(o.email), 200) : null,
        website: sanitizeHttpUrl(o.website),
        phone: o.phone ? capString(String(o.phone), 50) : null,
        url: sanitizeHttpUrl(o.url)
      };
    }

    // Category parsing
    const categories: string[] = [];
    if (raw.categories && Array.isArray(raw.categories)) {
      for (const c of raw.categories) {
        if (c.name) categories.push(capString(decodeHtmlEntities(c.name), 100));
      }
    }
    const primaryCategory = categories.length > 0 ? categories[0] : 'Campus Life';

    // Cost / Pricing: Preserve exact raw representation (plain text, capped)
    let cost: string | null = null;
    if (raw.cost !== undefined && raw.cost !== null && String(raw.cost).trim() !== '') {
      cost = capString(stripHtmlToText(String(raw.cost)).trim(), 120) || null;
    } else if (raw.cost_details && raw.cost_details.values && raw.cost_details.values.length > 0) {
      cost = capString(raw.cost_details.values.join(' – '), 120);
    }

    // Image URL (strictly http/https)
    let rawImageUrl: string | null = null;
    if (raw.image && typeof raw.image === 'object') {
      rawImageUrl = raw.image.url || (raw.image.sizes?.large?.url) || null;
    } else if (typeof raw.image === 'string') {
      rawImageUrl = raw.image;
    }
    const sourceImageUrl = sanitizeHttpUrl(rawImageUrl);

    // Registration URL in raw data or description (strictly http/https)
    let registrationUrl = sanitizeHttpUrl(extractRegistrationLinks(raw.description || ''));

    // Cancellation status
    let cancellationStatus: 'scheduled' | 'cancelled' | 'postponed' = 'scheduled';
    if (/\[\s*cancell?ed\s*\]|\b(cancelled|canceled)\b/i.test(title)) {
      cancellationStatus = 'cancelled';
    } else if (/\[\s*postponed\s*\]|\b(postponed)\b/i.test(title)) {
      cancellationStatus = 'postponed';
    }

    let registrationDeadline: string | null = null;

    // Optional detail enrichment from individual event page (skip for past events or disallowed paths)
    if (
      config.detail_enrichment_enabled &&
      originalUrl &&
      temporalStatus !== 'past' &&
      this.isAllowedByRobots(originalUrl, disallowedPaths)
    ) {
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
      description: descriptionText,
      description_text: descriptionText,
      excerpt,
      organizer,
      start_date: startInfo.formatted,
      end_date: endInfo ? endInfo.formatted : null,
      start_iso: startInfo.iso,
      end_iso: endInfo ? endInfo.iso : null,
      start_utc: startInfo.utcIso,
      end_utc: endInfo ? endInfo.utcIso : null,
      timezone,
      all_day: allDay,
      venue,
      category: capString(primaryCategory, 100),
      categories,
      cost,
      registration_url: sanitizeHttpUrl(registrationUrl),
      registration_deadline: registrationDeadline ? capString(registrationDeadline, 200) : null,
      source: 'wusa',
      source_url: 'https://wusa.ca/events/',
      source_image_url: sourceImageUrl,
      original_wusa_url: originalUrl,
      cancellation_status: cancellationStatus,
      temporal_status: temporalStatus,
      is_multi_day: isMultiDay,
      is_recurring: false, // Detected in series pass
      series_id: null,
      recurrence_rule: raw.recurrence ? capString(JSON.stringify(raw.recurrence), 1000) : null,
      review_status: reviewStatus,
      review_flags: reviewFlags,
      approval_status: 'pending',
      admin_notes: null,
      content_hash: contentHash,
      first_imported_at: new Date().toISOString(),
      last_checked_at: new Date().toISOString(),
      last_changed_at: new Date().toISOString(),
      raw_payload: null
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
