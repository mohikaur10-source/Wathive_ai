/**
 * Waterloo Timezone and Daylight Saving Time (DST) Utilities
 *
 * University of Waterloo is located in Waterloo, Ontario, Canada (America/Toronto timezone).
 * Observes Eastern Time:
 * - Eastern Daylight Time (EDT, UTC-4) from 2nd Sunday in March until 1st Sunday in November.
 * - Eastern Standard Time (EST, UTC-5) from 1st Sunday in November until 2nd Sunday in March.
 */

import {
  EVENT_TIMEZONE,
  getTorontoOffsetStringForWallClock,
  isEventPast,
  torontoWallClockToUtcMs
} from './eventLifecycle';

export const WATERLOO_TIMEZONE = EVENT_TIMEZONE;

export interface TorontoNowInfo {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  dateStr: string;     // YYYY-MM-DD
  timeStr: string;     // HH:mm (24h)
  dateTimeStr: string; // YYYY-MM-DD HH:mm
  msUntilMidnightToronto: number;
}

/**
 * Returns the current wall-clock date & time in America/Toronto using Intl.DateTimeFormat,
 * automatically handling EST/EDT transitions without hardcoded offsets or dates.
 */
export function getTorontoNow(now: Date = new Date()): TorontoNowInfo {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: WATERLOO_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23'
    });

    const parts = formatter.formatToParts(now);
    const getPart = (type: string) => parts.find((p) => p.type === type)?.value || '00';

    const year = parseInt(getPart('year'), 10);
    const month = parseInt(getPart('month'), 10);
    const day = parseInt(getPart('day'), 10);
    const hour = parseInt(getPart('hour'), 10) % 24;
    const minute = parseInt(getPart('minute'), 10);
    const second = parseInt(getPart('second'), 10);

    const pad = (n: number) => String(n).padStart(2, '0');
    const dateStr = `${year}-${pad(month)}-${pad(day)}`;
    const timeStr = `${pad(hour)}:${pad(minute)}`;
    const dateTimeStr = `${dateStr} ${timeStr}`;

    const elapsedTodayMs = ((hour * 60 + minute) * 60 + second) * 1000 + now.getMilliseconds();
    const msUntilMidnightToronto = Math.max(1000, 24 * 60 * 60 * 1000 - elapsedTodayMs);

    return {
      year,
      month,
      day,
      hour,
      minute,
      second,
      dateStr,
      timeStr,
      dateTimeStr,
      msUntilMidnightToronto
    };
  } catch {
    const pad = (n: number) => String(n).padStart(2, '0');
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const second = now.getSeconds();
    const dateStr = `${year}-${pad(month)}-${pad(day)}`;
    const timeStr = `${pad(hour)}:${pad(minute)}`;
    return {
      year,
      month,
      day,
      hour,
      minute,
      second,
      dateStr,
      timeStr,
      dateTimeStr: `${dateStr} ${timeStr}`,
      msUntilMidnightToronto: 60 * 60 * 1000
    };
  }
}

/**
 * Returns true when an event's end date/time has passed in America/Toronto.
 * Delegates to the canonical `isEventPast` helper.
 */
export function isEventPastToronto(
  event: {
    date: string;
    endDate?: string;
    recurringDates?: string[];
    startTime?: string;
    endTime?: string;
    status?: string;
  },
  nowOrInfo: Date | TorontoNowInfo = new Date()
): boolean {
  const nowDate = nowOrInfo instanceof Date ? nowOrInfo : new Date();
  return isEventPast(event, nowDate);
}

/**
 * Checks if a specific Date falls within Daylight Saving Time in Ontario / Waterloo.
 * Standard Canadian DST: 2:00 AM on second Sunday of March to 2:00 AM on first Sunday of November.
 */
export function isWaterlooDaylightSaving(date: Date = new Date()): boolean {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: WATERLOO_TIMEZONE,
      timeZoneName: 'short'
    });
    const parts = formatter.formatToParts(date);
    const tzPart = parts.find((p) => p.type === 'timeZoneName');
    if (tzPart) {
      return tzPart.value.includes('EDT') || tzPart.value.includes('GMT-4');
    }
  } catch {
    const year = date.getUTCFullYear();
    const marchFirst = new Date(Date.UTC(year, 2, 1));
    const marchFirstDay = marchFirst.getUTCDay();
    const secondSundayMarch = 1 + ((7 - marchFirstDay) % 7) + 7;
    const dstStart = new Date(Date.UTC(year, 2, secondSundayMarch, 7));

    const novFirst = new Date(Date.UTC(year, 10, 1));
    const novFirstDay = novFirst.getUTCDay();
    const firstSundayNov = 1 + ((7 - novFirstDay) % 7);
    const dstEnd = new Date(Date.UTC(year, 10, firstSundayNov, 6));

    return date >= dstStart && date < dstEnd;
  }
  return true;
}

/**
 * Returns current or target Waterloo timezone abbreviation ('EDT' or 'EST').
 */
export function getWaterlooTzAbbreviation(date: Date = new Date()): string {
  return isWaterlooDaylightSaving(date) ? 'EDT' : 'EST';
}

/**
 * Returns current or target Waterloo UTC offset string (e.g. 'UTC-4' or 'UTC-5').
 */
export function getWaterlooUtcOffsetString(date: Date = new Date()): string {
  return isWaterlooDaylightSaving(date) ? 'UTC-4' : 'UTC-5';
}

/**
 * Converts Waterloo local date ('YYYY-MM-DD') and time ('HH:MM') into a consistent UTC ISO-8601 string.
 */
export function toWaterlooUtcIso(dateStr: string, timeStr: string = '12:00'): string {
  try {
    const ms = torontoWallClockToUtcMs(dateStr, timeStr);
    if (Number.isFinite(ms)) {
      return new Date(ms).toISOString();
    }
    const offset = getTorontoOffsetStringForWallClock(dateStr, timeStr);
    return new Date(`${dateStr.slice(0, 10)}T${timeStr.slice(0, 5)}:00${offset}`).toISOString();
  } catch {
    return new Date().toISOString();
  }
}

/**
 * Formats a local 24h time 'HH:MM' into friendly 12h format with EDT/EST annotation.
 */
export function formatWaterlooTime(
  dateStr: string,
  timeStr: string,
  includeTzAbbr: boolean = true
): string {
  try {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 === 0 ? 12 : hours % 12;
    const displayMinutes = minutes < 10 ? `0${minutes}` : String(minutes);
    const formatted = `${displayHours}:${displayMinutes} ${period}`;

    if (!includeTzAbbr) return formatted;

    const [year, month, day] = dateStr.split('-').map(Number);
    const targetDate = new Date(year, month - 1, day);
    const tz = getWaterlooTzAbbreviation(targetDate);
    return `${formatted} ${tz}`;
  } catch {
    return timeStr;
  }
}

/**
 * Formats a time range with Waterloo timezone indicator.
 */
export function formatWaterlooTimeRange(
  dateStr: string,
  startTime: string,
  endTime: string
): string {
  const startPart = formatWaterlooTime(dateStr, startTime, false);
  const endPart = formatWaterlooTime(dateStr, endTime, true);
  return `${startPart} – ${endPart}`;
}

/**
 * Returns formatted date with Waterloo timezone label.
 */
export function formatWaterlooDateWithDst(dateStr: string): string {
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    const tz = getWaterlooTzAbbreviation(d);
    const offset = getWaterlooUtcOffsetString(d);
    const dateFormatted = d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    return `${dateFormatted} (${tz} · ${offset})`;
  } catch {
    return dateStr;
  }
}

/**
 * Returns true when the viewer's browser timezone differs from America/Toronto.
 */
export function isViewerDifferentTimezone(date: Date = new Date()): boolean {
  try {
    const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (browserTz === WATERLOO_TIMEZONE) return false;
    // Also compare wall-clock offset/name in case browser uses an alias like Canada/Eastern
    const torontoStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: WATERLOO_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    }).format(date);
    const localStr = new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    }).format(date);
    return torontoStr !== localStr;
  } catch {
    return false;
  }
}

/**
 * Formats event date & time cleanly (e.g. "Thu, Nov 20 · 5:00–7:00 PM"),
 * showing the Eastern timezone abbreviation only if the viewer is in another timezone.
 */
export function formatModalEventDateTime(
  dateStr: string,
  startTime: string,
  endTime?: string
): string {
  const safeDate = typeof dateStr === 'string' ? dateStr.trim() : '';
  const safeStart = typeof startTime === 'string' ? startTime.trim() : '';
  const safeEnd = typeof endTime === 'string' ? endTime.trim() : undefined;
  try {
    const [year, month, day] = safeDate.split('-').map(Number);
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
      return [safeDate, safeStart].filter(Boolean).join(' · ');
    }
    const d = new Date(Date.UTC(year, month - 1, day));
    if (Number.isNaN(d.getTime())) {
      return [safeDate, safeStart].filter(Boolean).join(' · ');
    }
    const datePart = d.toLocaleDateString('en-US', {
      timeZone: 'UTC',
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });

    if (!safeStart) return datePart;

    const format12h = (hhmm: string) => {
      const [h, m] = hhmm.split(':').map(Number);
      if (Number.isNaN(h) || Number.isNaN(m)) return { text: hhmm, period: '' };
      const period = h >= 12 ? 'PM' : 'AM';
      const displayH = h % 12 === 0 ? 12 : h % 12;
      const displayM = String(m).padStart(2, '0');
      return { text: `${displayH}:${displayM}`, period };
    };

    const start = format12h(safeStart);
    let timeRange = `${start.text} ${start.period}`.trim();

    if (safeEnd && safeEnd !== safeStart) {
      const end = format12h(safeEnd);
      if (start.period && start.period === end.period) {
        timeRange = `${start.text}–${end.text} ${end.period}`;
      } else {
        timeRange = `${start.text} ${start.period}–${end.text} ${end.period}`.trim();
      }
    }

    const showTz = isViewerDifferentTimezone();
    const tzSuffix = showTz ? ` ${getWaterlooTzAbbreviation(new Date(year, month - 1, day))}` : '';
    return `${datePart} · ${timeRange}${tzSuffix}`;
  } catch {
    return [safeDate, safeStart].filter(Boolean).join(' · ');
  }
}

