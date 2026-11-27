import {
  AttendeeProfile,
  CompatibilityMatch,
  Conversation,
  RemovedChatRecord,
  SocialBatteryTag,
  UserProfile
} from '../types';
import { calculateCompatibility, DEFAULT_ALEX_QUIZ } from './compatibilityEngine';
import { isChatRemovedForPair } from './chatRemoval';

export function getMatchConversationId(eventId: string, partnerId: string): string {
  return `conv_match_${eventId}_${partnerId}`;
}

export function getPairingDisplayState(
  conversation: Pick<Conversation, 'pairingStatus' | 'userConfirmed' | 'partnerConfirmed'> | null | undefined
): {
  isConfirmed: boolean;
  userConfirmed: boolean;
} {
  if (!conversation) {
    return { isConfirmed: false, userConfirmed: false };
  }
  const isConfirmed =
    conversation.pairingStatus === 'confirmed' ||
    (Boolean(conversation.userConfirmed) && Boolean(conversation.partnerConfirmed));
  const userConfirmed = Boolean(conversation.userConfirmed) || isConfirmed;
  return {
    isConfirmed,
    userConfirmed
  };
}

export function getEventBuddyStatusText(params: {
  isBuddyMatchingActive: boolean;
  conversationsForEvent: Pick<
    Conversation,
    'id' | 'pairingStatus' | 'userConfirmed' | 'partnerConfirmed'
  >[];
}): {
  statusText: string | null;
  conversationId: string | null;
} {
  const { isBuddyMatchingActive, conversationsForEvent } = params;
  if (!isBuddyMatchingActive) {
    return { statusText: null, conversationId: null };
  }

  if (conversationsForEvent.length === 0) {
    return { statusText: 'Looking for your buddy.', conversationId: null };
  }

  const confirmedConv = conversationsForEvent.find(
    (c) => getPairingDisplayState(c).isConfirmed
  );
  if (confirmedConv) {
    return {
      statusText: "You're officially buddies.",
      conversationId: confirmedConv.id
    };
  }

  return {
    statusText: "You've been matched. Say hello.",
    conversationId: conversationsForEvent[0].id
  };
}

export interface ReplacementCandidateResult {
  attendee: AttendeeProfile;
  compatibility: CompatibilityMatch;
}

export function findReplacementCandidate(params: {
  eventId: string;
  eventTitle: string;
  attendeeIds: string[];
  attendeesById: Record<string, AttendeeProfile>;
  user: UserProfile | null;
  conversations: Conversation[];
  removedChats: RemovedChatRecord[];
  blockedUserIds: string[];
  reportedUserIds?: string[];
  excludePartnerIds?: string[];
  userEventBattery?: SocialBatteryTag;
}): ReplacementCandidateResult | null {
  const {
    eventId,
    eventTitle,
    attendeeIds,
    attendeesById,
    user,
    conversations,
    removedChats,
    blockedUserIds,
    reportedUserIds = [],
    excludePartnerIds = [],
    userEventBattery
  } = params;

  const activePartnerIdsForEvent = new Set(
    (Array.isArray(conversations) ? conversations : [])
      .filter((c) => c && c.eventId === eventId && c.partner?.id)
      .map((c) => c.partner.id)
  );
  const excludedSet = new Set(Array.isArray(excludePartnerIds) ? excludePartnerIds : []);
  const reportedSet = new Set(Array.isArray(reportedUserIds) ? reportedUserIds : []);

  const candidates: ReplacementCandidateResult[] = [];

  for (const id of Array.isArray(attendeeIds) ? attendeeIds : []) {
    if (user && id === user.id) continue;
    if (activePartnerIdsForEvent.has(id) || excludedSet.has(id) || reportedSet.has(id)) continue;

    const attendee = attendeesById[id];
    if (!attendee || !attendee.isVerifiedUWStudent) continue;
    if (isChatRemovedForPair(id, eventId, removedChats, blockedUserIds)) continue;

    const compatibility = calculateCompatibility(
      user?.personalityQuiz || DEFAULT_ALEX_QUIZ,
      attendee.personalityQuiz,
      user,
      attendee,
      userEventBattery,
      eventId,
      eventTitle
    );

    if (!compatibility.filteredOut) {
      candidates.push({ attendee, compatibility });
    }
  }

  candidates.sort((a, b) => {
    if (b.compatibility.score !== a.compatibility.score) {
      return b.compatibility.score - a.compatibility.score;
    }
    return a.attendee.id.localeCompare(b.attendee.id);
  });
  return candidates[0] || null;
}

export const findBestMatchCandidate = findReplacementCandidate;
