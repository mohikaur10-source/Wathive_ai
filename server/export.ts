import { WusaStoredEvent } from './types.js';

export function exportToJson(events: WusaStoredEvent[]): string {
  return JSON.stringify(events, null, 2);
}

function escapeCsvField(val: any): string {
  if (val === null || val === undefined) return '""';
  let str = typeof val === 'object' ? JSON.stringify(val) : String(val);
  str = str.replace(/"/g, '""');
  return `"${str}"`;
}

export function exportToCsv(events: WusaStoredEvent[]): string {
  const headers = [
    'id',
    'title',
    'start_date',
    'end_date',
    'start_iso',
    'end_iso',
    'timezone',
    'all_day',
    'category',
    'cost',
    'venue_name',
    'venue_room',
    'venue_address',
    'venue_city',
    'venue_province',
    'venue_postal_code',
    'organizer_name',
    'organizer_email',
    'registration_url',
    'registration_deadline',
    'cancellation_status',
    'temporal_status',
    'is_multi_day',
    'is_recurring',
    'series_id',
    'review_status',
    'review_flags',
    'approval_status',
    'original_wusa_url',
    'first_imported_at',
    'last_checked_at',
    'last_changed_at'
  ];

  const lines = [headers.join(',')];

  for (const ev of events) {
    const row = [
      escapeCsvField(ev.id),
      escapeCsvField(ev.title),
      escapeCsvField(ev.start_date),
      escapeCsvField(ev.end_date),
      escapeCsvField(ev.start_iso),
      escapeCsvField(ev.end_iso),
      escapeCsvField(ev.timezone),
      escapeCsvField(ev.all_day ? 'true' : 'false'),
      escapeCsvField(ev.category),
      escapeCsvField(ev.cost),
      escapeCsvField(ev.venue?.name),
      escapeCsvField(ev.venue?.room),
      escapeCsvField(ev.venue?.address),
      escapeCsvField(ev.venue?.city),
      escapeCsvField(ev.venue?.province),
      escapeCsvField(ev.venue?.postal_code),
      escapeCsvField(ev.organizer?.name),
      escapeCsvField(ev.organizer?.email),
      escapeCsvField(ev.registration_url),
      escapeCsvField(ev.registration_deadline),
      escapeCsvField(ev.cancellation_status),
      escapeCsvField(ev.temporal_status),
      escapeCsvField(ev.is_multi_day ? 'true' : 'false'),
      escapeCsvField(ev.is_recurring ? 'true' : 'false'),
      escapeCsvField(ev.series_id),
      escapeCsvField(ev.review_status),
      escapeCsvField((ev.review_flags || []).join('; ')),
      escapeCsvField(ev.approval_status),
      escapeCsvField(ev.original_wusa_url),
      escapeCsvField(ev.first_imported_at),
      escapeCsvField(ev.last_checked_at),
      escapeCsvField(ev.last_changed_at)
    ];
    lines.push(row.join(','));
  }

  return lines.join('\n');
}
