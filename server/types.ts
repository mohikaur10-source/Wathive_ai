/**
 * Types for WatHive WUSA Event Collector
 */

export interface OrganizerData {
  id?: number | string | null;
  name: string;
  email: string | null;
  website: string | null;
  phone: string | null;
  url?: string | null;
}

export interface VenueData {
  id?: number | string | null;
  name: string;
  room: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  website: string | null;
}

export interface WusaStoredEvent {
  id: string; // Stable source event ID (e.g., "245501")
  title: string;
  slug: string | null;
  description: string; // Sanitized HTML
  description_text: string; // Plain text extraction
  excerpt: string | null;
  
  // Organizer
  organizer: OrganizerData | null;
  
  // Timing
  start_date: string; // "2026-11-09 17:00:00" or ISO
  end_date: string | null; // "2026-11-09 18:00:00" or ISO
  start_iso: string; // Full ISO 8601 with offset
  end_iso: string | null;
  timezone: string; // "America/Toronto"
  all_day: boolean;
  
  // Venue
  venue: VenueData | null;
  
  // Classification & Pricing
  category: string;
  categories: string[];
  cost: string | null; // Preserves raw ranges like "$15.00 – $20.00", "Free", or null
  
  // Registration
  registration_url: string | null;
  registration_deadline: string | null;
  
  // Media & Links
  source_image_url: string | null;
  original_wusa_url: string;
  
  // Status & Classification
  cancellation_status: 'scheduled' | 'cancelled' | 'postponed';
  temporal_status: 'upcoming' | 'ongoing' | 'past';
  is_multi_day: boolean;
  is_recurring: boolean;
  series_id: string | null;
  recurrence_rule: string | null;
  
  // Data Integrity & Review
  review_status: 'clean' | 'needs_review';
  review_flags: string[]; // Reasons for review, e.g. ["Missing end time", "Source page returned 404"]
  approval_status: 'pending' | 'approved' | 'rejected';
  admin_notes: string | null;
  
  // Timestamps
  content_hash: string;
  first_imported_at: string;
  last_checked_at: string;
  last_changed_at: string;
  
  // Raw source payload for transparency
  raw_payload?: string | null;
}

export interface RecurringSeries {
  id: string; // e.g. "series_fruit-veggie-market"
  title: string;
  slug_base: string;
  recurrence_description: string | null;
  total_occurrences: number;
  first_occurrence: string | null;
  last_occurrence: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChangeHistoryEntry {
  id?: number;
  event_id: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  changed_at: string;
  sync_run_id: string | null;
}

export interface SyncRun {
  id: string;
  trigger_type: 'manual' | 'scheduled';
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  status: 'in_progress' | 'completed' | 'failed' | 'incomplete';
  events_found: number;
  events_new: number;
  events_updated: number;
  events_unchanged: number;
  events_failed: number;
  pages_crawled: number;
  page_limit_reached: boolean;
  error_message: string | null;
  logs: string[];
}

export interface CollectorConfig {
  past_days_scope: number; // default: 30
  future_days_scope: number; // default: 180
  daily_sync_time: string; // default: "06:00" America/Toronto
  frequency_mode: 'daily' | 'hourly' | 'every_6h' | 'every_12h';
  page_limit: number; // default: 20
  request_delay_ms: number; // default: 350ms
  auto_sync_enabled: boolean;
  detail_enrichment_enabled: boolean; // Visit individual event page for JSON-LD/tickets
}

/**
 * Target format for future WatHive frontend integration
 */
export interface WatHivePreviewEvent {
  id: string;
  title: string;
  description: string;
  category: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  location: string;
  room?: string;
  coordinates?: { lat: number; lng: number };
  imageUrl?: string;
  organizer: string;
  price: string;
  externalLink?: string;
  status: 'upcoming' | 'ongoing' | 'past' | 'cancelled';
  tags: string[];
  source: 'wusa_official';
  sourceUrl: string;
  sourceEventId: string;
  approvalStatus: 'approved' | 'pending';
}
