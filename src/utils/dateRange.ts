import { EventItem } from '../types';
import { WATERLOO_TIMEZONE } from './timeZone';

export type DateRangePreset =
  | 'all'
  | 'today'
  | 'thisWeek'
  | 'thisWeekend'
  | 'nextWeek'
  | 'custom';

export interface DateRangeResolution {
  preset: DateRangePreset;
  start: string | null; // YYYY-MM-DD inclusive
  end: string | null;   // YYYY-MM-DD inclusive
  exactLabel: string;   // Exact human-readable selected date(s)
  isFiltered: boolean;
}

/**
 * Returns today's calendar date (YYYY-MM-DD) in Waterloo local time (America/Toronto).
 */
export function getWaterlooTodayStr(now: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: WATERLOO_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(now);
  } catch {
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}

/**
 * Pure UTC calendar arithmetic for YYYY-MM-DD strings (immune to DST shifts).
 */
export function addDaysToIsoDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/**
 * Computes Monday–Sunday calendar week bounds and Saturday–Sunday weekend bounds
 * containing `dateStr`.
 */
export function getCalendarWeekBounds(dateStr: string): {
  monday: string;
  saturday: string;
  sunday: string;
  nextMonday: string;
  nextSunday: string;
} {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dayOfWeek = dt.getUTCDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const monday = addDaysToIsoDate(dateStr, mondayOffset);
  const saturday = addDaysToIsoDate(monday, 5);
  const sunday = addDaysToIsoDate(monday, 6);
  const nextMonday = addDaysToIsoDate(monday, 7);
  const nextSunday = addDaysToIsoDate(monday, 13);

  return { monday, saturday, sunday, nextMonday, nextSunday };
}

export function formatIsoDatePretty(dateStr: string, includeYear = true): string {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.toLocaleDateString('en-US', {
      timeZone: 'UTC',
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      ...(includeYear ? { year: 'numeric' } : {})
    });
  } catch {
    return dateStr;
  }
}

export function formatExactDateRange(start: string | null, end: string | null): string {
  if (!start && !end) return 'All upcoming & past dates';
  if (start && !end) return `From ${formatIsoDatePretty(start, true)}`;
  if (!start && end) return `Through ${formatIsoDatePretty(end, true)}`;
  if (start && end) {
    if (start === end) return formatIsoDatePretty(start, true);
    const sameYear = start.slice(0, 4) === end.slice(0, 4);
    return `${formatIsoDatePretty(start, !sameYear)} – ${formatIsoDatePretty(end, true)}`;
  }
  return 'All dates';
}

/**
 * Resolves a DateRangePreset + optional custom bounds into exact inclusive YYYY-MM-DD dates.
 */
export function resolveDateRange(
  preset: DateRangePreset,
  customStart: string = '',
  customEnd: string = '',
  todayStr: string = getWaterlooTodayStr()
): DateRangeResolution {
  const { monday, saturday, sunday, nextMonday, nextSunday } = getCalendarWeekBounds(todayStr);

  switch (preset) {
    case 'today':
      return {
        preset,
        start: todayStr,
        end: todayStr,
        exactLabel: formatExactDateRange(todayStr, todayStr),
        isFiltered: true
      };
    case 'thisWeek':
      return {
        preset,
        start: monday,
        end: sunday,
        exactLabel: formatExactDateRange(monday, sunday),
        isFiltered: true
      };
    case 'thisWeekend':
      return {
        preset,
        start: saturday,
        end: sunday,
        exactLabel: formatExactDateRange(saturday, sunday),
        isFiltered: true
      };
    case 'nextWeek':
      return {
        preset,
        start: nextMonday,
        end: nextSunday,
        exactLabel: formatExactDateRange(nextMonday, nextSunday),
        isFiltered: true
      };
    case 'custom': {
      const s = customStart.trim() || null;
      const e = customEnd.trim() || null;
      if (!s && !e) {
        return {
          preset,
          start: null,
          end: null,
          exactLabel: 'Select start or end date',
          isFiltered: false
        };
      }
      if (s && e && s > e) {
        // Auto-normalize swapped range so overlap still works predictably
        return {
          preset,
          start: e,
          end: s,
          exactLabel: formatExactDateRange(e, s),
          isFiltered: true
        };
      }
      return {
        preset,
        start: s,
        end: e,
        exactLabel: formatExactDateRange(s, e),
        isFiltered: true
      };
    }
    case 'all':
    default:
      return {
        preset: 'all',
        start: null,
        end: null,
        exactLabel: 'All dates',
        isFiltered: false
      };
  }
}

function spanOverlapsRange(
  spanStart: string,
  spanEnd: string,
  rangeStart: string | null,
  rangeEnd: string | null
): boolean {
  if (rangeStart && spanEnd < rangeStart) return false;
  if (rangeEnd && spanStart > rangeEnd) return false;
  return true;
}

/**
 * Checks whether an event overlaps the resolved date range,
 * accounting for multi-day spans (`endDate`) and confirmed recurring occurrences (`recurringDates`).
 */
export function eventOverlapsDateRange(
  event: EventItem,
  range: DateRangeResolution
): boolean {
  if (!range.isFiltered || (!range.start && !range.end)) {
    return true;
  }

  const evStart = event.date;
  const evEnd = event.endDate && event.endDate >= evStart ? event.endDate : evStart;

  if (spanOverlapsRange(evStart, evEnd, range.start, range.end)) {
    return true;
  }

  if (Array.isArray(event.recurringDates) && event.recurringDates.length > 0) {
    for (const occDate of event.recurringDates) {
      if (occDate && spanOverlapsRange(occDate, occDate, range.start, range.end)) {
        return true;
      }
    }
  }

  return false;
}
