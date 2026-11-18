import { EventItem } from '../types';

export function downloadEventIcs(event: EventItem): void {
  // Parse date and times
  // event.date is YYYY-MM-DD, startTime is HH:MM
  const [year, month, day] = event.date.split('-').map(Number);
  const [startHour, startMin] = event.startTime.split(':').map(Number);
  const [endHour, endMin] = event.endTime.split(':').map(Number);

  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

  // Format to iCalendar local datetime YYYYMMDDTHHMMSS
  const dtStart = `${year}${pad(month)}${pad(day)}T${pad(startHour)}${pad(startMin)}00`;
  const dtEnd = `${year}${pad(month)}${pad(day)}T${pad(endHour)}${pad(endMin)}00`;

  const now = new Date();
  const dtStamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;

  const cleanDescription = (event.description || '')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');

  const cleanLocation = (event.location || '')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');

  const cleanSummary = (event.title || '')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');

  const uid = `wathive-${event.id}-${Date.now()}@uwaterloo.ca`;

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//WatHive//Campus Events//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${cleanSummary}`,
    `DESCRIPTION:${cleanDescription}\\n\\nOrganizer: ${event.organizer}\\nRegistration: ${event.registrationUrl}`,
    `LOCATION:${cleanLocation}`,
    `URL:${event.registrationUrl || 'https://uwaterloo.ca'}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const safeFilename = event.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 40);
  link.setAttribute('download', `${safeFilename || 'event'}.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generates a 1-click Google Calendar web creation URL.
 * Requires no API keys or OAuth credentials.
 */
export function getGoogleCalendarUrl(event: EventItem): string {
  try {
    const [year, month, day] = event.date.split('-').map(Number);
    const [startHour, startMin] = event.startTime.split(':').map(Number);
    const [endHour, endMin] = event.endTime.split(':').map(Number);

    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

    // Create local dates
    const startDate = new Date(year, month - 1, day, startHour, startMin);
    const endDate = new Date(year, month - 1, day, endHour, endMin);

    // Format ISO string for Google Calendar (YYYYMMDDTHHmmssZ)
    const formatUtc = (d: Date) =>
      `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;

    const dates = `${formatUtc(startDate)}/${formatUtc(endDate)}`;
    const title = encodeURIComponent(event.title);
    const details = encodeURIComponent(
      `${event.description}\n\nOrganizer: ${event.organizer}\nRegistration / Ticket Info: ${event.registrationUrl || 'Check organizer website'}\n\nSynced via WatHive (University of Waterloo)`
    );
    const location = encodeURIComponent(
      event.venueName
        ? `${event.venueName}, ${event.address || 'University of Waterloo'}`
        : event.location || 'University of Waterloo, ON'
    );

    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}&location=${location}`;
  } catch {
    return 'https://calendar.google.com/';
  }
}

/**
 * Generates an Outlook Web Calendar URL
 */
export function getOutlookCalendarUrl(event: EventItem): string {
  try {
    const [year, month, day] = event.date.split('-').map(Number);
    const [startHour, startMin] = event.startTime.split(':').map(Number);
    const [endHour, endMin] = event.endTime.split(':').map(Number);

    const startDate = new Date(year, month - 1, day, startHour, startMin);
    const endDate = new Date(year, month - 1, day, endHour, endMin);

    const subject = encodeURIComponent(event.title);
    const body = encodeURIComponent(
      `${event.description}\n\nOrganizer: ${event.organizer}\nRegistration: ${event.registrationUrl || 'uwaterloo.ca'}\n\nSynced via WatHive`
    );
    const location = encodeURIComponent(event.location || 'University of Waterloo');

    return `https://outlook.live.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent&subject=${subject}&startdt=${startDate.toISOString()}&enddt=${endDate.toISOString()}&body=${body}&location=${location}`;
  } catch {
    return 'https://outlook.live.com/calendar/';
  }
}

/**
 * Downloads a combined .ics calendar file containing all of a user's RSVP'd events.
 * Compatible with Apple Calendar, Google Calendar import, Outlook, and mobile calendar apps.
 */
export function downloadAllEventsIcs(events: EventItem[], filename = 'wathive-schedule.ics'): void {
  if (!events || events.length === 0) return;

  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  const now = new Date();
  const dtStamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;

  const vevents = events.map((event) => {
    const [year, month, day] = event.date.split('-').map(Number);
    const [startHour, startMin] = event.startTime.split(':').map(Number);
    const [endHour, endMin] = event.endTime.split(':').map(Number);

    const dtStart = `${year}${pad(month)}${pad(day)}T${pad(startHour)}${pad(startMin)}00`;
    const dtEnd = `${year}${pad(month)}${pad(day)}T${pad(endHour)}${pad(endMin)}00`;

    const cleanDescription = (event.description || '')
      .replace(/\n/g, '\\n')
      .replace(/,/g, '\\,')
      .replace(/;/g, '\\;');

    const cleanLocation = (event.location || '')
      .replace(/,/g, '\\,')
      .replace(/;/g, '\\;');

    const cleanSummary = (event.title || '')
      .replace(/,/g, '\\,')
      .replace(/;/g, '\\;');

    const uid = `wathive-${event.id}-${year}${pad(month)}${pad(day)}@uwaterloo.ca`;

    return [
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${dtStamp}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${cleanSummary}`,
      `DESCRIPTION:${cleanDescription}\\n\\nOrganizer: ${event.organizer}\\nRegistration: ${event.registrationUrl || 'Check organizer portal'}`,
      `LOCATION:${cleanLocation}`,
      `URL:${event.registrationUrl || 'https://uwaterloo.ca'}`,
      'STATUS:CONFIRMED',
      'END:VEVENT'
    ].join('\r\n');
  });

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//WatHive//Campus Events Schedule//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:WatHive Campus Schedule',
    'X-WR-TIMEZONE:America/Toronto',
    ...vevents,
    'END:VCALENDAR'
  ].join('\r\n');

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
