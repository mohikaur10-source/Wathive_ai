import crypto from 'node:crypto';
import { db } from './db.js';
import {
  WusaStoredEvent,
  OrganizerData,
  VenueData
} from './types.js';
import {
  capString,
  sanitizeHttpUrl,
  stripHtmlToText
} from './htmlParser.js';
import {
  getTorontoOffsetStringForWallClock,
  isEventPast,
  torontoWallClockToUtcMs
} from '../src/utils/eventLifecycle.js';

const USER_AGENT = 'WatHive-CommunityCollector/1.0 (+https://wathive.uwaterloo.ca)';
const MAX_FETCH_BYTES = 2 * 1024 * 1024; // 2 MB cap per remote response
const FETCH_TIMEOUT_MS = 10_000;
const MAX_REDIRECT_HOPS = 3;
const RRULE_HORIZON_DAYS = 60;
const MAX_TITLE_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 2000;

export const ALLOWED_WATHIVE_CATEGORIES = [
  'Arts and culture',
  'Technology',
  'Career and networking',
  'Sports and recreation',
  'Social events',
  'Volunteering',
  'Academic workshops',
  'Research participation'
] as const;

export type WatHiveCategory = (typeof ALLOWED_WATHIVE_CATEGORIES)[number];

export interface ConfiguredCommunitySources {
  sheetCsvUrls: string[];
  icsUrls: string[];
}

export interface CommunityParseResult {
  events: WusaStoredEvent[];
  skipped: Array<{ reason: string; detail?: string }>;
}

const WINDOWS_TZ_ALIASES: Record<string, string> = {
  'eastern standard time': 'America/Toronto',
  'eastern daylight time': 'America/Toronto',
  'us/eastern': 'America/Toronto',
  'canada/eastern': 'America/Toronto',
  'central standard time': 'America/Chicago',
  'us/central': 'America/Chicago',
  'mountain standard time': 'America/Denver',
  'us/mountain': 'America/Denver',
  'pacific standard time': 'America/Los_Angeles',
  'us/pacific': 'America/Los_Angeles',
  'canada/pacific': 'America/Vancouver',
  'utc': 'UTC',
  'gmt': 'UTC',
  'etc/utc': 'UTC',
  'etc/gmt': 'UTC'
};

function isPrivateOrLocalHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    lower === 'localhost' ||
    lower.endsWith('.localhost') ||
    lower.endsWith('.local') ||
    lower.endsWith('.internal') ||
    lower === '::1' ||
    lower === '0.0.0.0'
  ) {
    return true;
  }
  const ipv4Match = lower.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const [a, b] = [Number(ipv4Match[1]), Number(ipv4Match[2])];
    if (a === 127 || a === 10 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
  }
  if (lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80')) {
    return true;
  }
  return false;
}

export function assertSafeCommunitySourceUrl(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new Error('Invalid community source URL');
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error(`Unsupported source protocol: ${parsed.protocol}`);
  }
  if (parsed.username || parsed.password) {
    throw new Error('Source URL must not contain embedded credentials');
  }
  if (isPrivateOrLocalHostname(parsed.hostname)) {
    throw new Error(`Blocked local/private source host: ${parsed.hostname}`);
  }
  return parsed;
}

export function getConfiguredCommunitySources(
  env: Record<string, string | undefined> = process.env
): ConfiguredCommunitySources {
  const parseList = (raw?: string): string[] => {
    if (!raw || !raw.trim()) return [];
    const results: string[] = [];
    for (const entry of raw.split(',')) {
      const trimmed = entry.trim();
      if (!trimmed) continue;
      try {
        results.push(assertSafeCommunitySourceUrl(trimmed).toString());
      } catch (err: any) {
        console.warn(`[CommunitySources] Ignoring invalid configured URL "${trimmed}": ${err.message}`);
      }
    }
    return Array.from(new Set(results));
  };

  return {
    sheetCsvUrls: parseList(env.COMMUNITY_SHEET_CSV_URLS),
    icsUrls: parseList(env.COMMUNITY_ICS_URLS)
  };
}

export function normalizeWatHiveCategory(raw: string | null | undefined): WatHiveCategory {
  if (!raw || typeof raw !== 'string') return 'Social events';
  const normalized = stripHtmlToText(raw).trim().toLowerCase();
  const matched = ALLOWED_WATHIVE_CATEGORIES.find(
    (cat) => cat.toLowerCase() === normalized
  );
  return matched || 'Social events';
}

export function buildCommunityEventId(
  source: 'community_sheet' | 'community_ics',
  title: string,
  date: string,
  startTime: string
): string {
  const payload = `${source}|${title.trim().toLowerCase()}|${date.trim()}|${startTime.trim()}`;
  const hex = crypto.createHash('sha256').update(payload).digest('hex').slice(0, 16);
  const prefix = source === 'community_sheet' ? 'comm_sheet' : 'comm_ics';
  return `${prefix}_${hex}`;
}

export function isValidCalendarDate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [y, m, d] = dateStr.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const probe = new Date(Date.UTC(y, m - 1, d));
  return (
    probe.getUTCFullYear() === y &&
    probe.getUTCMonth() === m - 1 &&
    probe.getUTCDate() === d
  );
}

export function parse24HourTime(raw: string): string | null {
  const trimmed = raw.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = match[3] ? Number(match[3]) : 0;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) {
    return null;
  }
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function buildTorontoFormattedFromUtcMs(utcMs: number): {
  date: string;
  timeHHMM: string;
  timeHHMMSS: string;
  iso: string;
  utcIso: string;
  formatted: string;
} {
  const dateObj = new Date(utcMs);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(dateObj);
  const pick = (t: string) => parts.find((p) => p.type === t)?.value || '00';
  const date = `${pick('year')}-${pick('month')}-${pick('day')}`;
  const hh = String(Number(pick('hour')) % 24).padStart(2, '0');
  const mm = pick('minute');
  const ss = pick('second');
  const timeHHMM = `${hh}:${mm}`;
  const timeHHMMSS = `${hh}:${mm}:${ss}`;
  const offset = getTorontoOffsetStringForWallClock(date, timeHHMMSS);
  return {
    date,
    timeHHMM,
    timeHHMMSS,
    iso: `${date}T${timeHHMMSS}${offset}`,
    utcIso: dateObj.toISOString(),
    formatted: `${date} ${timeHHMMSS}`
  };
}

function buildTorontoEventTiming(
  dateStr: string,
  timeHHMMSS: string
): { iso: string; utcIso: string; formatted: string } {
  const offset = getTorontoOffsetStringForWallClock(dateStr, timeHHMMSS);
  const msPad = timeHHMMSS === '23:59:59' ? 999 : 0;
  const utcMs = torontoWallClockToUtcMs(dateStr, timeHHMMSS, msPad);
  return {
    iso: `${dateStr}T${timeHHMMSS}${offset}`,
    utcIso: new Date(utcMs).toISOString(),
    formatted: `${dateStr} ${timeHHMMSS}`
  };
}

/**
 * RFC 4180 compliant CSV parser (handles BOM, quoted commas/newlines, and escaped "" quotes).
 */
export function parseCsv(text: string): string[][] {
  const cleanText = text.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const ch = cleanText[i];

    if (inQuotes) {
      if (ch === '"') {
        if (cleanText[i + 1] === '"') {
          currentField += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        currentField += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      currentRow.push(currentField);
      currentField = '';
    } else if (ch === '\r') {
      if (cleanText[i + 1] === '\n') i++;
      currentRow.push(currentField);
      rows.push(currentRow);
      currentRow = [];
      currentField = '';
    } else if (ch === '\n') {
      currentRow.push(currentField);
      rows.push(currentRow);
      currentRow = [];
      currentField = '';
    } else {
      currentField += ch;
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows;
}

/**
 * Parse a Google Sheets CSV export into validated, sanitized WusaStoredEvent objects.
 */
export function parseCommunitySheetCsv(
  csvText: string,
  options: { sourceUrl?: string; now?: Date } = {}
): CommunityParseResult {
  const now = options.now ?? new Date();
  const sourceUrl = options.sourceUrl || 'community_sheet';
  const rows = parseCsv(csvText);

  if (rows.length < 2) {
    return { events: [], skipped: [] };
  }

  const headers = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
  const events: WusaStoredEvent[] = [];
  const skipped: Array<{ reason: string; detail?: string }> = [];

  for (let rowIdx = 1; rowIdx < rows.length; rowIdx++) {
    const row = rows[rowIdx];
    if (row.every((cell) => !cell.trim())) continue;

    const record: Record<string, string> = {};
    for (let colIdx = 0; colIdx < headers.length; colIdx++) {
      record[headers[colIdx]] = (row[colIdx] ?? '').trim();
    }

    const rowLabel = `row ${rowIdx + 1}`;

    if ((record.publish || '').trim().toLowerCase() !== 'yes') {
      skipped.push({ reason: 'not_published', detail: `${rowLabel}: publish != yes` });
      continue;
    }

    const title = stripHtmlToText(record.title || '').trim();
    if (!title) {
      skipped.push({ reason: 'missing_title', detail: `${rowLabel}: missing title` });
      continue;
    }
    if (title.length > MAX_TITLE_LENGTH) {
      skipped.push({ reason: 'title_too_long', detail: `${rowLabel}: title exceeds ${MAX_TITLE_LENGTH} chars` });
      continue;
    }

    const dateStr = (record.date || '').trim();
    if (!isValidCalendarDate(dateStr)) {
      skipped.push({ reason: 'invalid_date', detail: `${rowLabel}: invalid date "${dateStr}"` });
      continue;
    }

    const startTime = parse24HourTime(record.start_time || '');
    const endTime = parse24HourTime(record.end_time || '');
    if (!startTime || !endTime) {
      skipped.push({ reason: 'invalid_time', detail: `${rowLabel}: invalid start_time or end_time` });
      continue;
    }

    const rawEndDate = (record.end_date || '').trim();
    const effectiveEndDate = rawEndDate ? rawEndDate : dateStr;
    if (rawEndDate && !isValidCalendarDate(rawEndDate)) {
      skipped.push({ reason: 'invalid_end_date', detail: `${rowLabel}: invalid end_date "${rawEndDate}"` });
      continue;
    }

    const startUtcMs = torontoWallClockToUtcMs(dateStr, `${startTime}:00`);
    const endUtcMs = torontoWallClockToUtcMs(effectiveEndDate, `${endTime}:00`);
    if (!Number.isFinite(startUtcMs) || !Number.isFinite(endUtcMs) || endUtcMs <= startUtcMs) {
      skipped.push({ reason: 'end_not_after_start', detail: `${rowLabel}: end must be after start` });
      continue;
    }

    const location = stripHtmlToText(record.location || '').trim();
    if (!location) {
      skipped.push({ reason: 'missing_location', detail: `${rowLabel}: missing location` });
      continue;
    }

    const description = stripHtmlToText(record.description || '').trim();
    if (!description) {
      skipped.push({ reason: 'missing_description', detail: `${rowLabel}: missing description` });
      continue;
    }
    if (description.length > MAX_DESCRIPTION_LENGTH) {
      skipped.push({
        reason: 'description_too_long',
        detail: `${rowLabel}: description exceeds ${MAX_DESCRIPTION_LENGTH} chars`
      });
      continue;
    }

    const organizerName = stripHtmlToText(record.organizer || '').trim();
    if (!organizerName) {
      skipped.push({ reason: 'missing_organizer', detail: `${rowLabel}: missing organizer` });
      continue;
    }

    const rawAddress = stripHtmlToText(record.address || '').trim();
    const category = normalizeWatHiveCategory(record.category);

    const isFreeRaw = (record.is_free || 'yes').trim().toLowerCase();
    const isFree = isFreeRaw !== 'no';
    const rawPrice = stripHtmlToText(record.price || '').trim();
    const cost = isFree ? 'Free' : (rawPrice ? capString(rawPrice, 120) : 'Paid');

    const safeLink = sanitizeHttpUrl(record.link);
    if (record.link && !safeLink) {
      skipped.push({ reason: 'unsafe_link_stripped', detail: `${rowLabel}: rejected unsafe link` });
    }
    const safeCover = sanitizeHttpUrl(record.cover_image_url);
    if (record.cover_image_url && !safeCover) {
      skipped.push({ reason: 'unsafe_cover_stripped', detail: `${rowLabel}: rejected unsafe cover_image_url` });
    }

    const isMultiDay = effectiveEndDate !== dateStr;
    if (
      isEventPast(
        {
          date: dateStr,
          endDate: isMultiDay ? effectiveEndDate : undefined,
          startTime,
          endTime,
          status: 'published'
        },
        now
      )
    ) {
      skipped.push({ reason: 'past_event', detail: `${rowLabel}: event already ended` });
      continue;
    }

    const startTiming = buildTorontoEventTiming(dateStr, `${startTime}:00`);
    const endTiming = buildTorontoEventTiming(effectiveEndDate, `${endTime}:00`);
    const nowMs = now.getTime();
    const temporalStatus: 'upcoming' | 'ongoing' | 'past' =
      nowMs >= startUtcMs && nowMs < endUtcMs ? 'ongoing' : 'upcoming';

    const venue: VenueData = {
      id: null,
      name: capString(location, 200),
      room: null,
      address: rawAddress ? capString(rawAddress, 300) : null,
      city: 'Waterloo',
      province: 'ON',
      postal_code: null,
      country: 'Canada',
      latitude: null,
      longitude: null,
      website: null
    };

    const organizer: OrganizerData = {
      id: null,
      name: capString(organizerName, 200),
      email: null,
      website: null,
      phone: null,
      url: null
    };

    const id = buildCommunityEventId('community_sheet', title, dateStr, startTime);
    const hashPayload = `${title}|${startTiming.iso}|${endTiming.iso}|${cost}|${venue.name}|${description}|${category}|${safeLink || ''}|${safeCover || ''}`;
    const contentHash = crypto.createHash('sha256').update(hashPayload).digest('hex');
    const nowIso = now.toISOString();

    events.push({
      id,
      title,
      slug: null,
      description,
      description_text: description,
      excerpt: capString(description, 240),
      organizer,
      start_date: startTiming.formatted,
      end_date: endTiming.formatted,
      start_iso: startTiming.iso,
      end_iso: endTiming.iso,
      start_utc: startTiming.utcIso,
      end_utc: endTiming.utcIso,
      timezone: 'America/Toronto',
      all_day: false,
      venue,
      category,
      categories: [category],
      cost,
      registration_url: safeLink,
      registration_deadline: null,
      source: 'community_sheet',
      source_url: sourceUrl,
      source_image_url: safeCover,
      original_wusa_url: safeLink || '',
      cancellation_status: 'scheduled',
      temporal_status: temporalStatus,
      is_multi_day: isMultiDay,
      is_recurring: false,
      series_id: null,
      recurrence_rule: null,
      review_status: 'clean',
      review_flags: [],
      approval_status: 'approved',
      admin_notes: null,
      content_hash: contentHash,
      first_imported_at: nowIso,
      last_checked_at: nowIso,
      last_changed_at: nowIso,
      raw_payload: null
    });
  }

  return { events, skipped };
}

function unescapeIcsText(val: string): string {
  return val
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

function resolveIanaTimezone(rawTzid: string | undefined): string {
  if (!rawTzid) return 'America/Toronto';
  const cleaned = rawTzid.replace(/^["']|["']$/g, '').trim();
  const alias = WINDOWS_TZ_ALIASES[cleaned.toLowerCase()];
  if (alias) return alias;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: cleaned }).format(new Date(0));
    return cleaned;
  } catch {
    return 'America/Toronto';
  }
}

function wallClockInIanaZoneToUtcMs(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string
): number {
  if (timeZone === 'UTC') {
    return Date.UTC(year, month - 1, day, hour, minute, second, 0);
  }
  if (timeZone === 'America/Toronto') {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
    return torontoWallClockToUtcMs(dateStr, timeStr);
  }

  const targetAsUtc = Date.UTC(year, month - 1, day, hour, minute, second, 0);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  });

  const probe = (probeUtcMs: number): number => {
    const parts = formatter.formatToParts(new Date(probeUtcMs));
    const pick = (t: string) => parseInt(parts.find((p) => p.type === t)?.value || '0', 10);
    const wallAtProbe = Date.UTC(
      pick('year'),
      pick('month') - 1,
      pick('day'),
      pick('hour') % 24,
      pick('minute'),
      pick('second'),
      0
    );
    return targetAsUtc + (probeUtcMs - wallAtProbe);
  };

  const pass1 = probe(targetAsUtc);
  return probe(pass1);
}

interface ParsedIcsDateValue {
  isAllDay: boolean;
  utcMs: number;
  dateStr: string;
  timeStr: string;
  timeZone: string;
}

function parseIcsDateProperty(
  rawValue: string,
  params: Record<string, string>
): ParsedIcsDateValue | null {
  const val = rawValue.trim();

  // All-day DATE: YYYYMMDD
  const dateOnlyMatch = val.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (dateOnlyMatch || (params.VALUE && params.VALUE.toUpperCase() === 'DATE')) {
    if (!dateOnlyMatch) return null;
    const dateStr = `${dateOnlyMatch[1]}-${dateOnlyMatch[2]}-${dateOnlyMatch[3]}`;
    if (!isValidCalendarDate(dateStr)) return null;
    const utcMs = torontoWallClockToUtcMs(dateStr, '00:00:00');
    return {
      isAllDay: true,
      utcMs,
      dateStr,
      timeStr: '00:00:00',
      timeZone: 'America/Toronto'
    };
  }

  // DATE-TIME: YYYYMMDDTHHMMSS(Z)?
  const dtMatch = val.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/i);
  if (!dtMatch) return null;

  const year = Number(dtMatch[1]);
  const month = Number(dtMatch[2]);
  const day = Number(dtMatch[3]);
  const hour = Number(dtMatch[4]);
  const minute = Number(dtMatch[5]);
  const second = Number(dtMatch[6]);
  const isUtc = Boolean(dtMatch[7]);

  const dateStr = `${dtMatch[1]}-${dtMatch[2]}-${dtMatch[3]}`;
  if (!isValidCalendarDate(dateStr)) return null;
  if (hour > 23 || minute > 59 || second > 59) return null;

  const tz = isUtc ? 'UTC' : resolveIanaTimezone(params.TZID);
  const utcMs = wallClockInIanaZoneToUtcMs(year, month, day, hour, minute, second, tz);
  if (!Number.isFinite(utcMs)) return null;

  return {
    isAllDay: false,
    utcMs,
    dateStr,
    timeStr: `${dtMatch[4]}:${dtMatch[5]}:${dtMatch[6]}`,
    timeZone: tz
  };
}

function parseIcsDurationMs(rawDuration: string): number | null {
  const m = rawDuration.trim().match(/^P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i);
  if (!m) return null;
  const weeks = Number(m[1] || 0);
  const days = Number(m[2] || 0);
  const hours = Number(m[3] || 0);
  const minutes = Number(m[4] || 0);
  const seconds = Number(m[5] || 0);
  const totalMs = (((weeks * 7 + days) * 24 + hours) * 60 + minutes) * 60 * 1000 + seconds * 1000;
  return totalMs > 0 ? totalMs : null;
}

function addCalendarDays(dateStr: string, deltaDays: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

function expandIcsOccurrences(
  dtStart: ParsedIcsDateValue,
  durationMs: number,
  rruleRaw: string | undefined,
  exdates: Set<number>,
  nowMs: number
): Array<{ startUtcMs: number; endUtcMs: number }> {
  const horizonMs = nowMs + RRULE_HORIZON_DAYS * 24 * 60 * 60 * 1000;

  if (!rruleRaw) {
    if (exdates.has(dtStart.utcMs)) return [];
    return [{ startUtcMs: dtStart.utcMs, endUtcMs: dtStart.utcMs + durationMs }];
  }

  const ruleParts: Record<string, string> = {};
  for (const seg of rruleRaw.split(';')) {
    const [k, v] = seg.split('=');
    if (k && v) ruleParts[k.trim().toUpperCase()] = v.trim().toUpperCase();
  }

  const freq = ruleParts.FREQ;
  const interval = Math.max(1, parseInt(ruleParts.INTERVAL || '1', 10) || 1);
  const maxCount = ruleParts.COUNT ? Math.max(1, parseInt(ruleParts.COUNT, 10) || 1) : 200;

  let untilMs = horizonMs;
  if (ruleParts.UNTIL) {
    const parsedUntil = parseIcsDateProperty(ruleParts.UNTIL, {});
    if (parsedUntil) {
      untilMs = Math.min(untilMs, parsedUntil.utcMs + (parsedUntil.isAllDay ? 24 * 60 * 60 * 1000 - 1 : 0));
    }
  }

  const cutoffMs = Math.min(horizonMs, untilMs);
  const results: Array<{ startUtcMs: number; endUtcMs: number }> = [];

  // Unsupported frequencies: keep single DTSTART if within horizon & valid
  if (freq !== 'DAILY' && freq !== 'WEEKLY' && freq !== 'MONTHLY') {
    if (dtStart.utcMs <= cutoffMs && !exdates.has(dtStart.utcMs)) {
      results.push({ startUtcMs: dtStart.utcMs, endUtcMs: dtStart.utcMs + durationMs });
    }
    return results;
  }

  const weekdayMap: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
  const byDays = ruleParts.BYDAY
    ? ruleParts.BYDAY.split(',').map((d) => weekdayMap[d.slice(-2)]).filter((n) => n !== undefined)
    : null;

  const [baseY, baseM, baseD] = dtStart.dateStr.split('-').map(Number);
  const [baseH, baseMin, baseSec] = dtStart.timeStr.split(':').map(Number);

  let generatedCount = 0;
  let step = 0;
  const MAX_STEPS = 400;

  while (generatedCount < maxCount && step < MAX_STEPS) {
    if (freq === 'WEEKLY' && byDays && byDays.length > 0) {
      const weekBase = new Date(Date.UTC(baseY, baseM - 1, baseD + step * 7 * interval));
      const baseDow = weekBase.getUTCDay();
      const sortedDays = [...byDays].sort((a, b) => a - b);

      let beyondCutoff = false;
      for (const targetDow of sortedDays) {
        const occDate = new Date(Date.UTC(
          weekBase.getUTCFullYear(),
          weekBase.getUTCMonth(),
          weekBase.getUTCDate() + (targetDow - baseDow)
        ));
        const occUtcMs = wallClockInIanaZoneToUtcMs(
          occDate.getUTCFullYear(),
          occDate.getUTCMonth() + 1,
          occDate.getUTCDate(),
          baseH,
          baseMin,
          baseSec,
          dtStart.timeZone
        );
        if (occUtcMs < dtStart.utcMs) continue;
        if (occUtcMs > cutoffMs) {
          beyondCutoff = true;
          break;
        }
        generatedCount++;
        if (!exdates.has(occUtcMs)) {
          results.push({ startUtcMs: occUtcMs, endUtcMs: occUtcMs + durationMs });
        }
        if (generatedCount >= maxCount) break;
      }
      if (beyondCutoff) break;
      step++;
      continue;
    }

    let occDate: Date;
    if (freq === 'DAILY') {
      occDate = new Date(Date.UTC(baseY, baseM - 1, baseD + step * interval));
    } else if (freq === 'WEEKLY') {
      occDate = new Date(Date.UTC(baseY, baseM - 1, baseD + step * 7 * interval));
    } else {
      occDate = new Date(Date.UTC(baseY, baseM - 1 + step * interval, baseD));
      // Skip months where day overflowed (e.g. Jan 31 -> Mar 3)
      if (occDate.getUTCDate() !== baseD) {
        step++;
        continue;
      }
    }

    const occUtcMs = wallClockInIanaZoneToUtcMs(
      occDate.getUTCFullYear(),
      occDate.getUTCMonth() + 1,
      occDate.getUTCDate(),
      baseH,
      baseMin,
      baseSec,
      dtStart.timeZone
    );

    if (occUtcMs > cutoffMs) break;
    generatedCount++;
    if (!exdates.has(occUtcMs)) {
      results.push({ startUtcMs: occUtcMs, endUtcMs: occUtcMs + durationMs });
    }
    step++;
  }

  return results;
}

interface IcsPropLine {
  name: string;
  params: Record<string, string>;
  value: string;
}

function parseIcsPropertyLine(line: string): IcsPropLine | null {
  let inQuotes = false;
  let colonIdx = -1;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === ':' && !inQuotes) {
      colonIdx = i;
      break;
    }
  }
  if (colonIdx === -1) return null;

  const left = line.slice(0, colonIdx);
  const value = line.slice(colonIdx + 1);
  const segments = left.split(';');
  const name = segments[0].trim().toUpperCase();
  const params: Record<string, string> = {};

  for (let i = 1; i < segments.length; i++) {
    const eqIdx = segments[i].indexOf('=');
    if (eqIdx === -1) continue;
    const pKey = segments[i].slice(0, eqIdx).trim().toUpperCase();
    const pVal = segments[i].slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    params[pKey] = pVal;
  }

  return { name, params, value };
}

/**
 * Parse an iCalendar (.ics) feed into validated, sanitized WusaStoredEvent objects in America/Toronto.
 */
export function parseIcsEvents(
  icsText: string,
  options: { sourceUrl?: string; now?: Date } = {}
): CommunityParseResult {
  const now = options.now ?? new Date();
  const nowMs = now.getTime();
  const sourceUrl = options.sourceUrl || 'community_ics';

  // Unfold RFC 5545 continuation lines
  const unfolded = icsText.replace(/^\uFEFF/, '').replace(/\r?\n[ \t]/g, '');
  const lines = unfolded.split(/\r?\n/);

  let calendarName = '';
  let inVevent = false;
  let currentProps: IcsPropLine[] = [];
  const rawEvents: IcsPropLine[][] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.toUpperCase() === 'BEGIN:VEVENT') {
      inVevent = true;
      currentProps = [];
      continue;
    }
    if (trimmed.toUpperCase() === 'END:VEVENT') {
      if (inVevent) {
        rawEvents.push(currentProps);
      }
      inVevent = false;
      currentProps = [];
      continue;
    }

    const parsedProp = parseIcsPropertyLine(trimmed);
    if (!parsedProp) continue;

    if (!inVevent && parsedProp.name === 'X-WR-CALNAME') {
      calendarName = stripHtmlToText(unescapeIcsText(parsedProp.value)).trim();
    } else if (inVevent) {
      currentProps.push(parsedProp);
    }
  }

  const events: WusaStoredEvent[] = [];
  const skipped: Array<{ reason: string; detail?: string }> = [];

  for (let idx = 0; idx < rawEvents.length; idx++) {
    const props = rawEvents[idx];
    const label = `VEVENT #${idx + 1}`;
    const findProp = (name: string) => props.find((p) => p.name === name);

    const summaryProp = findProp('SUMMARY');
    const title = stripHtmlToText(unescapeIcsText(summaryProp?.value || '')).trim();
    if (!title) {
      skipped.push({ reason: 'missing_title', detail: `${label}: missing SUMMARY` });
      continue;
    }
    if (title.length > MAX_TITLE_LENGTH) {
      skipped.push({ reason: 'title_too_long', detail: `${label}: SUMMARY exceeds ${MAX_TITLE_LENGTH} chars` });
      continue;
    }

    const dtStartProp = findProp('DTSTART');
    if (!dtStartProp) {
      skipped.push({ reason: 'missing_dtstart', detail: `${label}: missing DTSTART` });
      continue;
    }
    const dtStart = parseIcsDateProperty(dtStartProp.value, dtStartProp.params);
    if (!dtStart) {
      skipped.push({ reason: 'invalid_dtstart', detail: `${label}: invalid DTSTART "${dtStartProp.value}"` });
      continue;
    }

    const dtEndProp = findProp('DTEND');
    const durationProp = findProp('DURATION');

    let isAllDay = dtStart.isAllDay;
    let durationMs = 0;

    if (dtStart.isAllDay) {
      if (dtEndProp) {
        const dtEnd = parseIcsDateProperty(dtEndProp.value, dtEndProp.params);
        if (!dtEnd) {
          skipped.push({ reason: 'invalid_dtend', detail: `${label}: invalid DTEND "${dtEndProp.value}"` });
          continue;
        }
        // RFC 5545 all-day DTEND is exclusive; normalize inclusive end at 23:59:59.999 of final day
        const endExclusiveDate = dtEnd.dateStr;
        if (endExclusiveDate <= dtStart.dateStr) {
          skipped.push({ reason: 'end_not_after_start', detail: `${label}: all-day DTEND must be after DTSTART` });
          continue;
        }
        const inclusiveEndDate = addCalendarDays(endExclusiveDate, -1);
        const inclusiveEndMs = torontoWallClockToUtcMs(inclusiveEndDate, '23:59:59', 999);
        durationMs = inclusiveEndMs - dtStart.utcMs;
      } else {
        const singleDayEndMs = torontoWallClockToUtcMs(dtStart.dateStr, '23:59:59', 999);
        durationMs = singleDayEndMs - dtStart.utcMs;
      }
    } else if (dtEndProp) {
      const dtEnd = parseIcsDateProperty(dtEndProp.value, dtEndProp.params);
      if (!dtEnd) {
        skipped.push({ reason: 'invalid_dtend', detail: `${label}: invalid DTEND "${dtEndProp.value}"` });
        continue;
      }
      durationMs = dtEnd.utcMs - dtStart.utcMs;
    } else if (durationProp) {
      const parsedDur = parseIcsDurationMs(durationProp.value);
      if (!parsedDur) {
        skipped.push({ reason: 'invalid_duration', detail: `${label}: invalid DURATION "${durationProp.value}"` });
        continue;
      }
      durationMs = parsedDur;
    } else {
      skipped.push({ reason: 'missing_dtend', detail: `${label}: missing DTEND/DURATION` });
      continue;
    }

    if (durationMs <= 0) {
      skipped.push({ reason: 'end_not_after_start', detail: `${label}: DTEND must be after DTSTART` });
      continue;
    }

    const descProp = findProp('DESCRIPTION');
    const description = descProp
      ? stripHtmlToText(unescapeIcsText(descProp.value)).trim()
      : '';
    if (description.length > MAX_DESCRIPTION_LENGTH) {
      skipped.push({
        reason: 'description_too_long',
        detail: `${label}: DESCRIPTION exceeds ${MAX_DESCRIPTION_LENGTH} chars`
      });
      continue;
    }

    const locProp = findProp('LOCATION');
    const location = locProp
      ? stripHtmlToText(unescapeIcsText(locProp.value)).trim() || 'University of Waterloo Campus'
      : 'University of Waterloo Campus';

    const orgProp = findProp('ORGANIZER');
    let organizerName = calendarName || 'Campus Club';
    if (orgProp) {
      const cn = orgProp.params.CN ? stripHtmlToText(unescapeIcsText(orgProp.params.CN)).trim() : '';
      const rawOrgVal = orgProp.value.trim();
      const valClean = /^mailto:/i.test(rawOrgVal) || rawOrgVal.includes('@')
        ? ''
        : stripHtmlToText(unescapeIcsText(rawOrgVal)).trim();
      organizerName = cn || valClean || organizerName;
    }

    const urlProp = findProp('URL');
    const rawUrl = urlProp ? unescapeIcsText(urlProp.value).trim() : '';
    const safeUrl = sanitizeHttpUrl(rawUrl);
    if (rawUrl && !safeUrl) {
      skipped.push({ reason: 'unsafe_url_stripped', detail: `${label}: rejected unsafe URL` });
    }

    const catProp = findProp('CATEGORIES');
    const category = catProp
      ? normalizeWatHiveCategory(unescapeIcsText(catProp.value.split(',')[0] || ''))
      : 'Social events';

    const statusProp = findProp('STATUS');
    const cancellationStatus: 'scheduled' | 'cancelled' | 'postponed' =
      statusProp?.value.trim().toUpperCase() === 'CANCELLED' ? 'cancelled' : 'scheduled';

    const exdateSet = new Set<number>();
    for (const p of props) {
      if (p.name === 'EXDATE') {
        for (const token of p.value.split(',')) {
          const parsedEx = parseIcsDateProperty(token, p.params);
          if (parsedEx) exdateSet.add(parsedEx.utcMs);
        }
      }
    }

    const rruleProp = findProp('RRULE');
    const occurrences = expandIcsOccurrences(
      dtStart,
      durationMs,
      rruleProp?.value,
      exdateSet,
      nowMs
    );

    for (const occ of occurrences) {
      const startTor = buildTorontoFormattedFromUtcMs(occ.startUtcMs);
      const endTor = buildTorontoFormattedFromUtcMs(occ.endUtcMs);

      const startTime = isAllDay ? '00:00' : startTor.timeHHMM;
      const endTime = isAllDay ? '23:59' : endTor.timeHHMM;
      const isMultiDay = endTor.date !== startTor.date;

      if (
        isEventPast(
          {
            date: startTor.date,
            endDate: isMultiDay ? endTor.date : undefined,
            startTime,
            endTime: isAllDay ? '23:59:59' : endTor.timeHHMMSS,
            status: cancellationStatus === 'cancelled' ? 'cancelled' : 'published'
          },
          now
        )
      ) {
        continue;
      }

      const id = buildCommunityEventId('community_ics', title, startTor.date, startTime);
      const temporalStatus: 'upcoming' | 'ongoing' | 'past' =
        nowMs >= occ.startUtcMs && nowMs < occ.endUtcMs ? 'ongoing' : 'upcoming';

      const venue: VenueData = {
        id: null,
        name: capString(location, 200),
        room: null,
        address: null,
        city: 'Waterloo',
        province: 'ON',
        postal_code: null,
        country: 'Canada',
        latitude: null,
        longitude: null,
        website: null
      };

      const organizer: OrganizerData = {
        id: null,
        name: capString(organizerName, 200),
        email: null,
        website: null,
        phone: null,
        url: null
      };

      const hashPayload = `${title}|${startTor.iso}|${endTor.iso}|${venue.name}|${description}|${category}|${safeUrl || ''}|${cancellationStatus}`;
      const contentHash = crypto.createHash('sha256').update(hashPayload).digest('hex');
      const nowIso = now.toISOString();

      events.push({
        id,
        title,
        slug: null,
        description,
        description_text: description,
        excerpt: description ? capString(description, 240) : null,
        organizer,
        start_date: startTor.formatted,
        end_date: endTor.formatted,
        start_iso: startTor.iso,
        end_iso: endTor.iso,
        start_utc: startTor.utcIso,
        end_utc: endTor.utcIso,
        timezone: 'America/Toronto',
        all_day: isAllDay,
        venue,
        category,
        categories: [category],
        cost: 'Free',
        registration_url: safeUrl,
        registration_deadline: null,
        source: 'community_ics',
        source_url: sourceUrl,
        source_image_url: null,
        original_wusa_url: safeUrl || '',
        cancellation_status: cancellationStatus,
        temporal_status: temporalStatus,
        is_multi_day: isMultiDay,
        is_recurring: Boolean(rruleProp),
        series_id: null,
        recurrence_rule: rruleProp ? capString(rruleProp.value, 1000) : null,
        review_status: 'clean',
        review_flags: [],
        approval_status: 'approved',
        admin_notes: null,
        content_hash: contentHash,
        first_imported_at: nowIso,
        last_checked_at: nowIso,
        last_changed_at: nowIso,
        raw_payload: null
      });
    }
  }

  return { events, skipped };
}

export class CommunitySourceCollector {
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

    return Buffer.concat(
      chunks.map((c) => Buffer.from(c.buffer, c.byteOffset, c.byteLength))
    ).toString('utf8');
  }

  private async fetchConfiguredUrl(
    rawUrl: string,
    acceptHeader: string
  ): Promise<string> {
    const initialUrl = assertSafeCommunitySourceUrl(rawUrl);
    const initialHost = initialUrl.hostname.toLowerCase();
    let currentUrl = initialUrl.toString();

    for (let hop = 0; hop <= MAX_REDIRECT_HOPS; hop++) {
      const response = await fetch(currentUrl, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': acceptHeader
        },
        redirect: 'manual',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location || hop === MAX_REDIRECT_HOPS) {
          throw new Error(`Redirect limit or missing Location header (${response.status})`);
        }
        const resolved = assertSafeCommunitySourceUrl(new URL(location, currentUrl).toString());
        if (resolved.hostname.toLowerCase() !== initialHost) {
          throw new Error(`Blocked cross-host redirect to ${resolved.hostname}`);
        }
        if (initialUrl.protocol === 'https:' && resolved.protocol !== 'https:') {
          throw new Error('Blocked HTTPS-to-HTTP redirect downgrade');
        }
        currentUrl = resolved.toString();
        continue;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return this.readBoundedText(response);
    }

    throw new Error('Exceeded maximum redirect hops');
  }

  public async syncAll(addLog: (msg: string) => void = (m) => console.log(`[CommunitySources] ${m}`)): Promise<{
    sourcesQueried: number;
    eventsImported: number;
    eventsArchived: number;
    errors: number;
  }> {
    const { sheetCsvUrls, icsUrls } = getConfiguredCommunitySources();
    if (sheetCsvUrls.length === 0 && icsUrls.length === 0) {
      return { sourcesQueried: 0, eventsImported: 0, eventsArchived: 0, errors: 0 };
    }

    const syncId = `community_${Date.now()}`;
    let sourcesQueried = 0;
    let eventsImported = 0;
    let eventsArchived = 0;
    let errors = 0;

    for (const csvUrl of sheetCsvUrls) {
      sourcesQueried++;
      try {
        const csvText = await this.fetchConfiguredUrl(csvUrl, 'text/csv, text/plain, */*');
        const parsed = parseCommunitySheetCsv(csvText, { sourceUrl: csvUrl });
        const activeIds: string[] = [];

        for (const ev of parsed.events) {
          activeIds.push(ev.id);
          const res = db.upsertEvent(ev, syncId);
          if (res.status !== 'failed') eventsImported++;
        }

        const archived = db.archiveMissingEventsForSource('community_sheet', csvUrl, activeIds);
        eventsArchived += archived;

        if (parsed.skipped.length > 0) {
          addLog(`Sheet (${new URL(csvUrl).hostname}): ${parsed.events.length} active, ${parsed.skipped.length} skipped, ${archived} archived`);
        } else {
          addLog(`Sheet (${new URL(csvUrl).hostname}): ${parsed.events.length} active, ${archived} archived`);
        }
      } catch (err: any) {
        errors++;
        addLog(`Community sheet fetch failed (${csvUrl}); keeping last good events. Error: ${err?.message || err}`);
      }
    }

    for (const icsUrl of icsUrls) {
      sourcesQueried++;
      try {
        const icsText = await this.fetchConfiguredUrl(icsUrl, 'text/calendar, text/plain, */*');
        const parsed = parseIcsEvents(icsText, { sourceUrl: icsUrl });
        const activeIds: string[] = [];

        for (const ev of parsed.events) {
          activeIds.push(ev.id);
          const res = db.upsertEvent(ev, syncId);
          if (res.status !== 'failed') eventsImported++;
        }

        const archived = db.archiveMissingEventsForSource('community_ics', icsUrl, activeIds);
        eventsArchived += archived;

        addLog(`ICS (${new URL(icsUrl).hostname}): ${parsed.events.length} active, ${parsed.skipped.length} skipped, ${archived} archived`);
      } catch (err: any) {
        errors++;
        addLog(`Community ICS fetch failed (${icsUrl}); keeping last good events. Error: ${err?.message || err}`);
      }
    }

    return { sourcesQueried, eventsImported, eventsArchived, errors };
  }
}

export const communityCollector = new CommunitySourceCollector();
