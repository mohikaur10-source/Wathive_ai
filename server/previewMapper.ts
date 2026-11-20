import { WusaStoredEvent } from './types.js';
import { sanitizeHttpUrl, stripHtmlToText, capString } from './htmlParser.js';

/**
 * Known Waterloo venues to coordinates lookup
 */
const KNOWN_COORDINATES: Array<{ pattern: RegExp; coords: { lat: number; lng: number } }> = [
  { pattern: /\b(slc|student life centre|great hall|black and gold|mates)\b/i, coords: { lat: 43.47175, lng: -80.54535 } },
  { pattern: /\b(dc|davis centre|davis)\b/i, coords: { lat: 43.47290, lng: -80.54220 } },
  { pattern: /\b(pac|physical activities complex|warrior)\b/i, coords: { lat: 43.47250, lng: -80.54630 } },
  { pattern: /\b(stc|science teaching)\b/i, coords: { lat: 43.47055, lng: -80.54350 } },
  { pattern: /\b(mc|math|mathematics)\b/i, coords: { lat: 43.47228, lng: -80.54395 } },
  { pattern: /\b(e7|engineering 7|ideas clinic)\b/i, coords: { lat: 43.47304, lng: -80.53965 } },
  { pattern: /\b(hh|hagey hall|humanities)\b/i, coords: { lat: 43.46810, lng: -80.54580 } },
  { pattern: /\b(cif|columbia icefield)\b/i, coords: { lat: 43.47640, lng: -80.55110 } },
  { pattern: /\b(bingeman|screampark)\b/i, coords: { lat: 43.47280, lng: -80.45320 } },
  { pattern: /\b(emmanuel)\b/i, coords: { lat: 43.47950, lng: -80.52840 } },
  { pattern: /\b(culinary studio)\b/i, coords: { lat: 43.45020, lng: -80.49250 } }
];

export function resolveCoordinates(venueName?: string | null, address?: string | null): { lat: number; lng: number } | undefined {
  const combined = `${venueName || ''} ${address || ''}`;
  for (const item of KNOWN_COORDINATES) {
    if (item.pattern.test(combined)) {
      return item.coords;
    }
  }
  // Default to main Waterloo campus hub
  return { lat: 43.47175, lng: -80.54535 };
}

/**
 * Category mapping from WUSA taxonomy to WatHive categories
 */
export function mapWusaCategoryToWatHive(wusaCategory: string): {
  category: 'Arts and culture' | 'Technology' | 'Career and networking' | 'Sports and recreation' | 'Social events' | 'Volunteering' | 'Academic workshops' | 'Research participation';
  organizerType: 'Clubs' | 'Student societies' | 'WUSA' | 'Faculties' | 'Research studies';
} {
  const cat = (wusaCategory || '').toLowerCase();

  if (cat.includes('mates') || cat.includes('social') || cat.includes('life') || cat.includes('gathering') || cat.includes('thrift') || cat.includes('market')) {
    return { category: 'Social events', organizerType: 'WUSA' };
  }
  if (cat.includes('tech') || cat.includes('hack') || cat.includes('comput') || cat.includes('ai') || cat.includes('code')) {
    return { category: 'Technology', organizerType: 'Clubs' };
  }
  if (cat.includes('career') || cat.includes('network') || cat.includes('resume') || cat.includes('co-op') || cat.includes('job') || cat.includes('advocacy') || cat.includes('election')) {
    return { category: 'Career and networking', organizerType: 'WUSA' };
  }
  if (cat.includes('art') || cat.includes('music') || cat.includes('theatre') || cat.includes('dance') || cat.includes('concert') || cat.includes('film')) {
    return { category: 'Arts and culture', organizerType: 'Clubs' };
  }
  if (cat.includes('sport') || cat.includes('fitness') || cat.includes('recreation') || cat.includes('yoga') || cat.includes('run') || cat.includes('hockey')) {
    return { category: 'Sports and recreation', organizerType: 'Clubs' };
  }
  if (cat.includes('academic') || cat.includes('workshop') || cat.includes('conference') || cat.includes('lecture') || cat.includes('debate') || cat.includes('chess') || cat.includes('trial')) {
    return { category: 'Academic workshops', organizerType: 'Student societies' };
  }
  if (cat.includes('volunteer') || cat.includes('charity') || cat.includes('fundraiser') || cat.includes('food support')) {
    return { category: 'Volunteering', organizerType: 'Student societies' };
  }
  if (cat.includes('research') || cat.includes('study')) {
    return { category: 'Research participation', organizerType: 'Research studies' };
  }

  return { category: 'Social events', organizerType: 'WUSA' };
}

function getDefaultCoverImage(category: string): string {
  switch (category) {
    case 'Technology':
      return '/src/assets/images/wathive_hackathon_1792617946142.jpg';
    case 'Career and networking':
      return '/src/assets/images/wathive_career_fair_1792617948325.jpg';
    case 'Sports and recreation':
      return '/src/assets/images/wathive_sports_intramural_1792617947784.jpg';
    case 'Academic workshops':
    case 'Research participation':
      return '/src/assets/images/wathive_research_lab_1792617948983.jpg';
    case 'Social events':
    case 'Arts and culture':
    case 'Volunteering':
    default:
      return '/src/assets/images/wathive_campus_social_1792617947412.jpg';
  }
}

const DIRECT_WATHIVE_CATEGORIES = new Set([
  'Arts and culture',
  'Technology',
  'Career and networking',
  'Sports and recreation',
  'Social events',
  'Volunteering',
  'Academic workshops',
  'Research participation'
]);

/**
 * Transforms a WUSA or community stored event into the exact EventItem schema consumed by WatHive
 */
export function mapToWatHiveEventItem(stored: WusaStoredEvent): any {
  const isCommunity = stored.source === 'community_sheet' || stored.source === 'community_ics';
  const mappedWusa = mapWusaCategoryToWatHive(stored.category);
  const category = isCommunity && DIRECT_WATHIVE_CATEGORIES.has(stored.category)
    ? (stored.category as ReturnType<typeof mapWusaCategoryToWatHive>['category'])
    : mappedWusa.category;
  const organizerType = isCommunity ? 'Clubs' : mappedWusa.organizerType;

  // Parse start date & time
  const [datePart, timePart] = stored.start_date.split(' ');
  const startTime = stored.all_day ? '00:00' : (timePart ? timePart.slice(0, 5) : '00:00');

  let endDatePart: string | undefined;
  let endTime = '23:59';
  if (stored.end_date) {
    const [parsedEndDate, endTimePart] = stored.end_date.split(' ');
    if (parsedEndDate && parsedEndDate > datePart) {
      endDatePart = parsedEndDate;
    }
    if (stored.all_day) {
      endTime = '23:59';
    } else if (endTimePart) {
      endTime = endTimePart.slice(0, 5);
    }
  }

  const normalizedCost = (stored.cost || '').trim().toLowerCase();
  const isFree =
    !normalizedCost ||
    normalizedCost === 'free' ||
    normalizedCost.includes('free') ||
    normalizedCost === '$0' ||
    normalizedCost === '$0.00';
  const priceDisplay = isFree ? 'Free' : (stored.cost || 'Paid');

  // Status mapping
  let status: 'published' | 'draft' | 'cancelled' | 'ended' = 'published';
  if (stored.cancellation_status === 'cancelled') {
    status = 'cancelled';
  } else if (stored.temporal_status === 'past') {
    status = 'ended';
  }

  const coordinates = stored.venue?.latitude && stored.venue?.longitude
    ? { lat: stored.venue.latitude, lng: stored.venue.longitude }
    : resolveCoordinates(stored.venue?.name, stored.venue?.address);

  const safeImage = sanitizeHttpUrl(stored.source_image_url);
  const coverImage = safeImage || getDefaultCoverImage(category);
  const safeOriginalUrl = isCommunity
    ? (sanitizeHttpUrl(stored.original_wusa_url) || '')
    : (sanitizeHttpUrl(stored.original_wusa_url) || 'https://wusa.ca/events/');
  const safeRegUrl = isCommunity
    ? (sanitizeHttpUrl(stored.registration_url) || '')
    : (sanitizeHttpUrl(stored.registration_url) || safeOriginalUrl);
  const plainDescription = capString(
    stripHtmlToText(stored.description_text || stored.description || ''),
    10_000
  );

  const moderationStatus: 'approved' | 'rejected' | 'pending_review' = isCommunity
    ? (stored.approval_status === 'approved'
        ? 'approved'
        : stored.approval_status === 'rejected'
          ? 'rejected'
          : 'pending_review')
    : (stored.approval_status === 'rejected' ? 'rejected' : 'approved');

  return {
    id: isCommunity ? stored.id : `wusa_${stored.id}`,
    title: capString(stored.title, 300),
    coverImage,
    organizer: stored.organizer?.name || (isCommunity ? 'Campus Club' : 'Waterloo Undergraduate Student Association'),
    organizerType,
    isOrganizationAccount: true,
    category,
    facultyAffiliation: 'All Faculties',
    description: plainDescription,
    date: datePart,
    endDate: endDatePart,
    startTime,
    endTime,
    isOnline: !stored.venue || stored.venue.name.toLowerCase().includes('online') || stored.venue.name.toLowerCase().includes('virtual') || stored.venue.name.toLowerCase().includes('zoom'),
    location: stored.venue ? (stored.venue.room ? `${stored.venue.name} (${stored.venue.room})` : stored.venue.name) : 'University of Waterloo Campus',
    coordinates,
    venueName: stored.venue?.name || 'Waterloo Campus',
    address: stored.venue?.address || '200 University Ave W, Waterloo, ON N2L 3G1',
    roomNumber: stored.venue?.room || undefined,
    arrivalInstructions: stored.venue?.address ? `Located at ${stored.venue.address}. Please bring your WatCard.` : 'Please arrive 10 minutes before start time with your WatCard.',
    isFree,
    price: priceDisplay,
    eligibility: 'Open to all University of Waterloo undergraduate students',
    registrationUrl: safeRegUrl,
    registrationDeadline: stored.registration_deadline || undefined,
    isResearchStudy: false,
    creatorId: isCommunity ? 'system_community_collector' : 'system_wusa_collector',
    status,
    sourceVerification: isCommunity ? 'community_partner' : 'wusa_official',
    moderationStatus,
    isExternalConfirmedTicket: Boolean(sanitizeHttpUrl(stored.registration_url)),
    utcIsoString: stored.start_utc || stored.start_iso,
    endUtcIso: stored.end_utc || stored.end_iso || undefined,
    createdAt: stored.first_imported_at,
    
    // Metadata for transparency
    _wusaMeta: {
      sourceEventId: stored.id,
      canonicalUrl: safeOriginalUrl,
      temporalStatus: stored.temporal_status,
      isRecurring: stored.is_recurring,
      seriesId: stored.series_id,
      reviewFlags: stored.review_flags
    }
  };
}
