/**
 * Canonical Event Lifecycle Helpers (America/Toronto)
 *
 * Single source of truth for determining whether an event has ended,
 * safe across all client browser timezones and Ontario DST transitions.
 */

export const EVENT_TIMEZONE = 'America/Toronto';

export interface EventLifecycleShape {
  date?: string;
  endDate?: string;
  recurringDates?: string[];
  startTime?: string;
  endTime?: string;
  status?: string;
  end_iso?: string | null;
  endUtcIso?: string | null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^(\d{2}):(\d{2})(?::(\d{2}))?/;

function getTorontoWallClockParts(utcDate: Date): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: EVENT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  });

  const parts = formatter.formatToParts(utcDate);
  const pick = (type: string) => parseInt(parts.find((p) => p.type === type)?.value || '0', 10);

  return {
    year: pick('year'),
    month: pick('month'),
    day: pick('day'),
    hour: pick('hour') % 24,
    minute: pick('minute'),
    second: pick('second')
  };
}

/**
 * Converts a wall-clock date/time in America/Toronto to exact UTC epoch milliseconds,
 * independent of the host OS or browser local timezone, handling EST (-05:00) and EDT (-04:00)
 * transitions cleanly.
 *
 * On ambiguous Fall-Back hours (1:00–1:59 AM on the first Sunday in November),
 * prefers the later (EST) instant so active events do not prematurely disappear.
 */
export function torontoWallClockToUtcMs(
  dateStr: string,
  timeStr = '23:59:59',
  msOffset = 0
): number {
  const cleanDate = dateStr.slice(0, 10);
  if (!DATE_RE.test(cleanDate)) return NaN;

  const [year, month, day] = cleanDate.split('-').map(Number);
  const match = timeStr.match(TIME_RE);
  const hour = match ? Math.min(23, Math.max(0, parseInt(match[1], 10))) : 23;
  const minute = match ? Math.min(59, Math.max(0, parseInt(match[2], 10))) : 59;
  const second = match && match[3] ? Math.min(59, Math.max(0, parseInt(match[3], 10))) : 0;

  const targetAsUtc = Date.UTC(year, month - 1, day, hour, minute, second, 0);

  // Two-pass fixed-point solver from UTC guess -> Toronto wall-clock offset
  const resolveWithOffsetProbe = (probeUtcMs: number): number => {
    const p = getTorontoWallClockParts(new Date(probeUtcMs));
    const wallAtProbe = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second, 0);
    const offset = probeUtcMs - wallAtProbe; // +4h or +5h in ms
    return targetAsUtc + offset;
  };

  // Probe assuming EST (+5h) first so fall-back ambiguous 01:xx selects the later EST instant,
  // then refine once at that candidate instant.
  const estInitialGuess = targetAsUtc + 5 * 60 * 60 * 1000;
  const pass1 = resolveWithOffsetProbe(estInitialGuess);
  const pass2 = resolveWithOffsetProbe(pass1);

  return pass2 + msOffset;
}

/**
 * Formats an exact UTC offset string ("-04:00" or "-05:00") for a Toronto wall-clock timestamp.
 */
export function getTorontoOffsetStringForWallClock(dateStr: string, timeStr = '12:00:00'): string {
  const cleanDate = dateStr.slice(0, 10);
  const utcMs = torontoWallClockToUtcMs(cleanDate, timeStr);
  if (!Number.isFinite(utcMs)) return '-05:00';

  const [year, month, day] = cleanDate.split('-').map(Number);
  const match = timeStr.match(TIME_RE);
  const hour = match ? parseInt(match[1], 10) : 12;
  const minute = match ? parseInt(match[2], 10) : 0;
  const second = match && match[3] ? parseInt(match[3], 10) : 0;
  const wallAsUtc = Date.UTC(year, month - 1, day, hour, minute, second, 0);

  const offsetMinutes = Math.round((wallAsUtc - utcMs) / 60_000);
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absMins = Math.abs(offsetMinutes);
  const hh = String(Math.floor(absMins / 60)).padStart(2, '0');
  const mm = String(absMins % 60).padStart(2, '0');
  return `${sign}${hh}:${mm}`;
}

/**
 * Computes the effective end instant (UTC epoch ms) of an event in America/Toronto.
 * Precedence:
 *  1. Latest date among `date`, `endDate`, and any `recurringDates`
 *  2. Explicit `endTime` if valid, otherwise end of day (`23:59:59.999` Toronto time)
 */
export function getEventEndUtcMs(event: EventLifecycleShape): number {
  if (!event) return NaN;

  // If explicit full ISO end timestamp is provided without separate date override, check validity
  const candidateIso = event.endUtcIso || event.end_iso;
  if (candidateIso && !event.date && !event.endDate && !event.recurringDates?.length) {
    const parsed = Date.parse(candidateIso);
    if (!Number.isNaN(parsed)) return parsed;
  }

  const candidateDates: string[] = [];
  if (event.date && DATE_RE.test(event.date.slice(0, 10))) {
    candidateDates.push(event.date.slice(0, 10));
  }
  if (event.endDate && DATE_RE.test(event.endDate.slice(0, 10))) {
    candidateDates.push(event.endDate.slice(0, 10));
  }
  if (Array.isArray(event.recurringDates)) {
    for (const d of event.recurringDates) {
      if (typeof d === 'string' && DATE_RE.test(d.slice(0, 10))) {
        candidateDates.push(d.slice(0, 10));
      }
    }
  }

  if (candidateDates.length === 0) return NaN;

  candidateDates.sort();
  const effectiveEndDate = candidateDates[candidateDates.length - 1];

  if (event.endTime && TIME_RE.test(event.endTime.trim())) {
    const trimmed = event.endTime.trim();
    const match = trimmed.match(TIME_RE)!;
    const normalizedTime = `${match[1]}:${match[2]}:${match[3] || '00'}`;
    // If endTime is 23:59:59 or 23:59, include the final second cleanly
    const msPad = normalizedTime === '23:59:59' ? 999 : 0;
    return torontoWallClockToUtcMs(effectiveEndDate, normalizedTime, msPad);
  }

  // Fallback when no endTime is specified: 23:59:59.999 on endDate ?? date
  return torontoWallClockToUtcMs(effectiveEndDate, '23:59:59', 999);
}

/**
 * Single canonical check returning true when an event has ended in America/Toronto.
 * - Explicitly 'ended' events are always past.
 * - Cancelled events remain visible until their scheduled end time passes, then become past.
 * - Multi-day events remain active through `endDate` + `endTime` (or 23:59:59).
 * - Recurring events with `recurringDates` remain active through the latest occurrence.
 */
export function isEventPast(
  event: EventLifecycleShape | null | undefined,
  now: Date = new Date()
): boolean {
  if (!event) return true;
  if (event.status === 'ended') return true;

  const endMs = getEventEndUtcMs(event);
  if (!Number.isFinite(endMs)) return true;

  return endMs <= now.getTime();
}
