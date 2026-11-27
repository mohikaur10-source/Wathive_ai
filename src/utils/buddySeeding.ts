import {
  AttendeeProfile,
  CompatibilityMatch,
  RemovedChatRecord,
  UserProfile
} from '../types';
import { isChatRemovedForPair } from './chatRemoval';

export interface SeedBuddySeekersOptions {
  pool: AttendeeProfile[];
  isPast?: boolean;
  isResearchStudy?: boolean;
  status?: string;
  signedInUserId?: string | null;
  blockedUserIds?: string[];
  reportedUserIds?: string[];
  removedChats?: RemovedChatRecord[];
  activePairingPartnerIds?: string[];
  endedPartnerIds?: string[];
}

/**
 * Deterministic 32-bit FNV-1a hash for stable per-event seeding.
 */
export function hashEventSeed(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Deterministically selects 5 or more (5 to 8) verified UW buddy seekers for an event.
 * - Past, ended, cancelled, or research events are never populated.
 * - Never picks the signed-in user or anyone blocked/reported globally.
 * - Spreads people across events via per-(eventId, studentId) hashing.
 * - Applies event-scoped exclusions (active pairing, ended pairing, left chat for this event)
 *   after selecting the event's base seekers so ending a pairing does not invent extra seekers.
 */
export function getSeedBuddySeekers(
  eventId: string,
  options: SeedBuddySeekersOptions
): AttendeeProfile[] {
  if (!eventId) return [];
  if (
    options.isPast ||
    options.isResearchStudy ||
    options.status === 'cancelled' ||
    options.status === 'ended'
  ) {
    return [];
  }

  const blockedSet = new Set(options.blockedUserIds || []);
  const reportedSet = new Set(options.reportedUserIds || []);
  const removedChats = options.removedChats || [];
  const activeSet = new Set(options.activePairingPartnerIds || []);
  const endedSet = new Set(options.endedPartnerIds || []);

  const globalRemovedIds = new Set(
    removedChats.filter((r) => r.eventId === null).map((r) => r.partnerId)
  );

  // Deduplicate and filter global exclusions first
  const seenIds = new Set<string>();
  const eligiblePool: AttendeeProfile[] = [];
  for (const att of options.pool) {
    if (!att || !att.id || seenIds.has(att.id)) continue;
    seenIds.add(att.id);
    if (!att.isVerifiedUWStudent) continue;
    if (options.signedInUserId && att.id === options.signedInUserId) continue;
    if (blockedSet.has(att.id) || reportedSet.has(att.id) || globalRemovedIds.has(att.id)) {
      continue;
    }
    eligiblePool.push(att);
  }

  if (eligiblePool.length === 0) return [];

  // Deterministic count >= 5 (5, 6, 7, or 8 when pool size allows)
  const eventHash = hashEventSeed(eventId);
  const desiredCount = 5 + (eventHash % 4);
  const count = Math.min(desiredCount, eligiblePool.length);

  // Spread students across events deterministically
  const rankedPool = [...eligiblePool].sort((a, b) => {
    const ha = hashEventSeed(`${eventId}::${a.id}`);
    const hb = hashEventSeed(`${eventId}::${b.id}`);
    if (ha !== hb) return ha - hb;
    return a.id.localeCompare(b.id);
  });

  const baseSeekers = rankedPool.slice(0, count);

  return baseSeekers.filter(
    (att) =>
      !activeSet.has(att.id) &&
      !endedSet.has(att.id) &&
      !isChatRemovedForPair(att.id, eventId, removedChats, options.blockedUserIds || [])
  );
}

export function getFirstName(fullName: string | null | undefined): string {
  const clean = typeof fullName === 'string' ? fullName.trim() : '';
  if (!clean) return 'Student';
  return clean.split(/\s+/)[0] || clean;
}

export function formatSeekerFacultyYear(
  seeker: Pick<AttendeeProfile, 'faculty' | 'year' | 'showFaculty' | 'showYear'>
): string | null {
  const parts: string[] = [];
  if (seeker.showFaculty !== false && seeker.faculty) {
    parts.push(seeker.faculty);
  }
  if (seeker.showYear !== false && seeker.year) {
    parts.push(seeker.year);
  }
  return parts.length > 0 ? parts.join(' · ') : null;
}

export function formatSeekerCountText(count: number): string {
  return count === 1
    ? '1 person is looking for a buddy'
    : `${count} people are looking for a buddy`;
}

export function getShortCompatibilityLine(
  compatibility: Pick<CompatibilityMatch, 'icebreakerPill' | 'reasons'>,
  user?: Pick<UserProfile, 'faculty' | 'year'> | null,
  seeker?: Pick<AttendeeProfile, 'faculty' | 'year' | 'showFaculty' | 'showYear'> | null
): string {
  if (
    user?.faculty &&
    seeker?.showFaculty !== false &&
    seeker?.faculty &&
    user.faculty === seeker.faculty
  ) {
    return `Both in ${seeker.faculty}`;
  }

  const rawPill = (compatibility.icebreakerPill || '').trim();
  if (rawPill) {
    if (rawPill.startsWith('You both picked ')) {
      const rest = rawPill.slice('You both picked '.length).split('&')[0]?.trim();
      if (rest) return `Both like ${rest.toLowerCase()}`;
    }
    if (!/\d+%/.test(rawPill) && rawPill.length <= 42 && !rawPill.includes('·')) {
      return rawPill;
    }
  }

  if (
    user?.year &&
    seeker?.showYear !== false &&
    seeker?.year &&
    user.year === seeker.year
  ) {
    return `Both in ${seeker.year}`;
  }

  return 'Similar campus vibe';
}
