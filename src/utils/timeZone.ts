/**
 * Waterloo Timezone and Daylight Saving Time (DST) Utilities
 * 
 * University of Waterloo is located in Waterloo, Ontario, Canada (America/Toronto timezone).
 * Observes Eastern Time:
 * - Eastern Daylight Time (EDT, UTC-4) from 2nd Sunday in March until 1st Sunday in November.
 * - Eastern Standard Time (EST, UTC-5) from 1st Sunday in November until 2nd Sunday in March.
 * 
 * Requirements:
 * - Store event timestamps consistently in UTC ISO-8601 strings.
 * - Display Waterloo-local times correctly, accounting for daylight saving transitions.
 */

export const WATERLOO_TIMEZONE = 'America/Toronto';

/**
 * Checks if a specific Date falls within Daylight Saving Time in Ontario / Waterloo.
 * Standard Canadian DST: 2:00 AM on second Sunday of March to 2:00 AM on first Sunday of November.
 */
export function isWaterlooDaylightSaving(date: Date = new Date()): boolean {
  try {
    // Check using Intl API with America/Toronto time zone name
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: WATERLOO_TIMEZONE,
      timeZoneName: 'short'
    });
    const parts = formatter.formatToParts(date);
    const tzPart = parts.find(p => p.type === 'timeZoneName');
    if (tzPart) {
      return tzPart.value.includes('EDT') || tzPart.value.includes('GMT-4');
    }
  } catch {
    // Fallback formula for Ontario DST rules
    const year = date.getUTCFullYear();
    // 2nd Sunday in March
    const marchFirst = new Date(Date.UTC(year, 2, 1));
    const marchFirstDay = marchFirst.getUTCDay();
    const secondSundayMarch = 1 + (7 - marchFirstDay) % 7 + 7;
    const dstStart = new Date(Date.UTC(year, 2, secondSundayMarch, 7)); // ~2:00 AM EST (07:00 UTC)

    // 1st Sunday in November
    const novFirst = new Date(Date.UTC(year, 10, 1));
    const novFirstDay = novFirst.getUTCDay();
    const firstSundayNov = 1 + (7 - novFirstDay) % 7;
    const dstEnd = new Date(Date.UTC(year, 10, firstSundayNov, 6)); // ~2:00 AM EDT (06:00 UTC)

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
    const [year, month, day] = dateStr.split('-').map(Number);
    const [hours, minutes] = timeStr.split(':').map(Number);

    // Approximate date to test DST
    const approxDate = new Date(year, month - 1, day, hours, minutes);
    const isDst = isWaterlooDaylightSaving(approxDate);
    const offsetHours = isDst ? 4 : 5; // EDT is UTC-4, EST is UTC-5

    // Build ISO offset string
    const offsetStr = isDst ? '-04:00' : '-05:00';
    const pad = (n: number) => String(n).padStart(2, '0');
    const localIsoWithTz = `${year}-${pad(month)}-${pad(day)}T${pad(hours)}:${pad(minutes)}:00${offsetStr}`;

    const parsedUtc = new Date(localIsoWithTz);
    return parsedUtc.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

/**
 * Formats a local 24h time 'HH:MM' into friendly 12h format with EDT/EST annotation.
 * E.g., '18:00' -> '6:00 PM EDT'
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
 * E.g. '18:00', '21:00' on '2026-10-24' -> '6:00 PM – 9:00 PM EDT'
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
 * E.g. 'Sat, Oct 24, 2026 (Waterloo Time · EDT)'
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
