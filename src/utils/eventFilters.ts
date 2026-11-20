import { EventFilterTag, EventItem, SavedFilterType } from '../types';

export type LocationBucket = 'all' | 'slc' | 'eng' | 'mc_dc' | 'pac_cif' | 'online' | 'off_campus';

export const LOCATION_BUCKETS: { id: LocationBucket; label: string }[] = [
  { id: 'all', label: 'All Locations' },
  { id: 'slc', label: 'Student Life Centre (SLC)' },
  { id: 'eng', label: 'Engineering (E5 / E7)' },
  { id: 'mc_dc', label: 'Math & Davis (MC / DC)' },
  { id: 'pac_cif', label: 'Athletics (PAC / CIF)' },
  { id: 'online', label: 'Online / Virtual' },
  { id: 'off_campus', label: 'Off-Campus & Uptown' }
];

export const SAVABLE_LOCATION_BUCKETS = LOCATION_BUCKETS.filter((b) => b.id !== 'all');

export const PRICE_FILTER_OPTIONS: { value: 'free' | 'paid'; label: string }[] = [
  { value: 'free', label: 'Free only' },
  { value: 'paid', label: 'Paid only' }
];

export interface TaggedActiveFilter extends EventFilterTag {
  key: string;
  isSaved: boolean;
}

export function getFilterTagKey(type: SavedFilterType, value: string): string {
  return `${type}:${value}`;
}

export function matchesLocationBucket(ev: EventItem, bucket: LocationBucket): boolean {
  if (bucket === 'all') return true;
  const loc = (ev.location + ' ' + (ev.venueName || '')).toLowerCase();
  if (bucket === 'online') {
    return ev.isOnline || loc.includes('online') || loc.includes('virtual') || loc.includes('zoom');
  }
  if (bucket === 'slc') {
    return (
      loc.includes('slc') ||
      loc.includes('student life') ||
      loc.includes('great hall') ||
      loc.includes('black and gold') ||
      loc.includes('multi-purpose')
    );
  }
  if (bucket === 'eng') {
    return (
      loc.includes('e7') ||
      loc.includes('e5') ||
      loc.includes('e2') ||
      loc.includes('engineering') ||
      loc.includes('cph')
    );
  }
  if (bucket === 'mc_dc') {
    return (
      loc.includes('mc ') ||
      loc.includes('mc,') ||
      loc.includes('math') ||
      loc.includes('davis') ||
      loc.includes('dc ')
    );
  }
  if (bucket === 'pac_cif') {
    return (
      loc.includes('pac') ||
      loc.includes('cif') ||
      loc.includes('icefield') ||
      loc.includes('physical activities') ||
      loc.includes('gym')
    );
  }
  if (bucket === 'off_campus') {
    return (
      !ev.isOnline &&
      !matchesLocationBucket(ev, 'slc') &&
      !matchesLocationBucket(ev, 'eng') &&
      !matchesLocationBucket(ev, 'mc_dc') &&
      !matchesLocationBucket(ev, 'pac_cif')
    );
  }
  return true;
}

/**
 * Derives the deduplicated union of savedFilters and temporaryFilters.
 * Saved filters always take precedence and appear first so there are never duplicate pills.
 */
export function mergeSavedAndTemporaryFilters(
  savedFilters: EventFilterTag[],
  temporaryFilters: EventFilterTag[]
): TaggedActiveFilter[] {
  const seen = new Set<string>();
  const result: TaggedActiveFilter[] = [];

  for (const tag of savedFilters) {
    const key = getFilterTagKey(tag.type, tag.value);
    if (!seen.has(key)) {
      seen.add(key);
      result.push({ ...tag, key, isSaved: true });
    }
  }

  for (const tag of temporaryFilters) {
    const key = getFilterTagKey(tag.type, tag.value);
    if (!seen.has(key)) {
      seen.add(key);
      result.push({ ...tag, key, isSaved: false });
    }
  }

  return result;
}

/**
 * Filters events using the combined set of saved + temporary filters.
 * Multiple selections within the same facet (e.g. 2 categories) match via OR;
 * selections across different facets (e.g. category + price) match via AND.
 */
export function filterEventsByTags(
  events: EventItem[],
  activeFilters: EventFilterTag[],
  searchQuery: string
): EventItem[] {
  let filtered = [...events];

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    filtered = filtered.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.organizer.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.location.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q)
    );
  }

  const categories = activeFilters.filter((f) => f.type === 'category').map((f) => f.value);
  const faculties = activeFilters.filter((f) => f.type === 'faculty').map((f) => f.value);
  const locations = activeFilters.filter((f) => f.type === 'location').map((f) => f.value as LocationBucket);
  const prices = activeFilters.filter((f) => f.type === 'price').map((f) => f.value);

  if (categories.length > 0) {
    filtered = filtered.filter((e) => categories.includes(e.category));
  }

  if (faculties.length > 0) {
    filtered = filtered.filter(
      (e) =>
        !e.facultyAffiliation ||
        e.facultyAffiliation === 'All Faculties' ||
        faculties.includes(e.facultyAffiliation)
    );
  }

  if (locations.length > 0) {
    filtered = filtered.filter((e) => locations.some((loc) => matchesLocationBucket(e, loc)));
  }

  if (prices.length > 0) {
    const wantFree = prices.includes('free');
    const wantPaid = prices.includes('paid');
    if (wantFree && !wantPaid) {
      filtered = filtered.filter((e) => e.isFree);
    } else if (wantPaid && !wantFree) {
      filtered = filtered.filter((e) => !e.isFree);
    }
  }

  return filtered;
}
