import { BUDDY_POLICY } from '../config/buddyPolicy';
import {
  ArchivedChatMessage,
  ArchivedConversationRecord,
  AttendeeProfile,
  BuddyManageAction,
  BuddyPairingLifecycleState,
  ChatMessage,
  Conversation,
  UserProfile
} from '../types';
import {
  evaluateDealbreakers,
  normalizeQuizProfile,
  QuizQuestionKey
} from './compatibilityEngine';
import { EventLifecycleShape, getEventStartUtcMs } from './eventLifecycle';
import { getPairingDisplayState } from './pairingLogic';

/**
 * Pure state machine & lifecycle rules for WatHive buddy pairings:
 * - States: searching -> provisional -> confirmed -> ended
 * - Allowed manage actions per state
 * - Toronto-time <24h last-minute reminder guard (confirmed pairings only)
 * - Anonymized 30-day archive retention
 * - Percentage-free common compatibility lines for first-open chat intro card
 */

export function derivePairingLifecycleState(params: {
  isBuddyMatchingActive: boolean;
  conversation?: Pick<
    Conversation,
    'pairingStatus' | 'userConfirmed' | 'partnerConfirmed'
  > | null;
}): BuddyPairingLifecycleState {
  const { isBuddyMatchingActive, conversation } = params;
  if (!conversation) {
    return isBuddyMatchingActive ? 'searching' : 'ended';
  }
  const { isConfirmed } = getPairingDisplayState(conversation);
  return isConfirmed ? 'confirmed' : 'provisional';
}

export function getAllowedManageActions(
  state: BuddyPairingLifecycleState,
  userConfirmed = false
): BuddyManageAction[] {
  switch (state) {
    case 'searching':
      return ['no_longer_need', 'unable_to_attend'];
    case 'provisional':
      return userConfirmed
        ? ['find_another', 'no_longer_need', 'unable_to_attend', 'block_or_report']
        : [
            'confirm_buddy',
            'find_another',
            'no_longer_need',
            'unable_to_attend',
            'block_or_report'
          ];
    case 'confirmed':
      return ['find_another', 'no_longer_need', 'unable_to_attend', 'block_or_report'];
    case 'ended':
      return [];
  }
}

export function isWithinLastMinuteWindow(
  event: EventLifecycleShape | null | undefined,
  nowMs: number = Date.now(),
  thresholdHours: number = BUDDY_POLICY.lastMinuteReminderHours
): boolean {
  if (!event) return false;
  const startMs = getEventStartUtcMs(event);
  if (!Number.isFinite(startMs)) return false;
  const remainingMs = startMs - nowMs;
  return remainingMs > 0 && remainingMs < thresholdHours * 60 * 60 * 1000;
}

export function shouldShowLastMinuteReminder(params: {
  conversation?: Pick<
    Conversation,
    'pairingStatus' | 'userConfirmed' | 'partnerConfirmed'
  > | null;
  event?: EventLifecycleShape | null;
  nowMs?: number;
  thresholdHours?: number;
}): boolean {
  const {
    conversation,
    event,
    nowMs = Date.now(),
    thresholdHours = BUDDY_POLICY.lastMinuteReminderHours
  } = params;
  if (!conversation) return false;
  const { isConfirmed } = getPairingDisplayState(conversation);
  if (!isConfirmed) return false;
  return isWithinLastMinuteWindow(event, nowMs, thresholdHours);
}

export function getArchiveRetentionMs(
  retentionDays: number = BUDDY_POLICY.archiveRetentionDays
): number {
  return retentionDays * 24 * 60 * 60 * 1000;
}

export function createArchivedConversationRecord(params: {
  conversation: Pick<
    Conversation,
    'id' | 'eventId' | 'eventTitle' | 'eventDate' | 'eventLocation'
  >;
  messages: ChatMessage[];
  userId?: string | null;
  closedAtMs?: number;
}): ArchivedConversationRecord {
  const { conversation, messages, userId } = params;
  const closedAtMs =
    typeof params.closedAtMs === 'number' && Number.isFinite(params.closedAtMs)
      ? params.closedAtMs
      : Date.now();
  const safeMessages = Array.isArray(messages) ? messages : [];

  const anonymizedMessages: ArchivedChatMessage[] = safeMessages
    .filter((msg): msg is ChatMessage => Boolean(msg && typeof msg === 'object' && typeof msg.id === 'string'))
    .map((msg) => ({
      id: msg.id,
      senderRole:
        msg.senderId === 'system'
          ? 'system'
          : userId && msg.senderId === userId
          ? 'me'
          : 'buddy',
      text: typeof msg.text === 'string' ? msg.text : '',
      timestamp: typeof msg.timestamp === 'string' ? msg.timestamp : ''
    }));

  return {
    id: `arch_${conversation.id}_${closedAtMs}`,
    eventId: typeof conversation.eventId === 'string' ? conversation.eventId : '',
    eventTitle:
      typeof conversation.eventTitle === 'string' && conversation.eventTitle
        ? conversation.eventTitle
        : 'Campus Event',
    eventDate: typeof conversation.eventDate === 'string' ? conversation.eventDate : '',
    eventLocation:
      typeof conversation.eventLocation === 'string' && conversation.eventLocation
        ? conversation.eventLocation
        : 'Campus Venue',
    closedAtMs,
    messages: anonymizedMessages
  };
}

export function purgeExpiredArchivedConversations(
  archives: ArchivedConversationRecord[],
  nowMs: number = Date.now(),
  retentionDays: number = BUDDY_POLICY.archiveRetentionDays
): ArchivedConversationRecord[] {
  if (!Array.isArray(archives)) return [];
  const safeNowMs = Number.isFinite(nowMs) ? nowMs : Date.now();
  const cutoffMs = getArchiveRetentionMs(retentionDays);
  const valid: ArchivedConversationRecord[] = [];
  for (const entry of archives) {
    if (!entry || typeof entry !== 'object') continue;
    if (typeof entry.id !== 'string' || !entry.id) continue;
    if (typeof entry.closedAtMs !== 'number' || !Number.isFinite(entry.closedAtMs)) continue;
    if (safeNowMs - entry.closedAtMs >= cutoffMs) continue;
    const msgs = Array.isArray(entry.messages)
      ? entry.messages.filter(
          (m): m is ArchivedChatMessage =>
            Boolean(m && typeof m === 'object' && typeof m.id === 'string')
        )
      : [];
    valid.push({
      ...entry,
      eventTitle:
        typeof entry.eventTitle === 'string' && entry.eventTitle
          ? entry.eventTitle
          : 'Campus Event',
      eventDate: typeof entry.eventDate === 'string' ? entry.eventDate : '',
      eventLocation:
        typeof entry.eventLocation === 'string' && entry.eventLocation
          ? entry.eventLocation
          : 'Campus Venue',
      messages: msgs
    });
  }
  return valid;
}

export interface ManageBuddyOutcomePlan {
  action: 'find_another' | 'no_longer_need' | 'unable_to_attend';
  keepRsvp: boolean;
  keepBuddyMatchingActive: boolean;
  excludePartnerForEvent: boolean;
  triggerUserReplacementSearch: boolean;
  partnerNoticeKind: 'pairing_ended' | 'buddy_cancelled';
  triggerPartnerReplacementSearch: boolean;
  userToast: string;
}

export function getManageBuddyOutcomePlan(
  action: 'find_another' | 'no_longer_need' | 'unable_to_attend'
): ManageBuddyOutcomePlan {
  switch (action) {
    case 'find_another':
      return {
        action,
        keepRsvp: true,
        keepBuddyMatchingActive: true,
        excludePartnerForEvent: true,
        triggerUserReplacementSearch: true,
        partnerNoticeKind: 'pairing_ended',
        triggerPartnerReplacementSearch: true,
        userToast: 'Looking for another buddy.'
      };
    case 'no_longer_need':
      return {
        action,
        keepRsvp: true,
        keepBuddyMatchingActive: false,
        excludePartnerForEvent: true,
        triggerUserReplacementSearch: false,
        partnerNoticeKind: 'pairing_ended',
        triggerPartnerReplacementSearch: true,
        userToast: 'Removed from buddy matching. Your RSVP is still active.'
      };
    case 'unable_to_attend':
      return {
        action,
        keepRsvp: false,
        keepBuddyMatchingActive: false,
        excludePartnerForEvent: true,
        triggerUserReplacementSearch: false,
        partnerNoticeKind: 'buddy_cancelled',
        triggerPartnerReplacementSearch: true,
        userToast: 'Event RSVP cancelled.'
      };
  }
}

const QUIZ_COMMON_CHECK_LINES: Record<QuizQuestionKey, Record<string, string>> = {
  q1: {
    A: 'Enjoy lively social events',
    B: 'Enjoy relaxed cafe hangouts'
  },
  q2: {
    A: 'Enjoy meeting new people',
    B: 'Prefer smaller social groups'
  },
  q3: {
    A: 'Like planning details ahead',
    B: 'Enjoy bringing people together',
    C: 'Easygoing and go with the flow'
  },
  q4: {
    A: 'Enjoy trying new experiences',
    B: 'Enjoy cozy weekend hobbies',
    C: 'Enjoy staying active together'
  },
  q5: {
    A: 'Up for spontaneous plans',
    B: 'Prefer planning ahead'
  },
  q6: {
    A: 'Like lively conversation',
    B: 'Enjoy thoughtful conversation'
  },
  q7: {
    A: 'Up for trying something new',
    B: "Match each other's comfort level"
  },
  q8: {
    A: 'Prefer daytime coffee hangouts',
    B: 'Up for late-night campus hangs'
  }
};

/**
 * Generates up to 3 short, score-free check lines for the first-open intro card
 * in Buddy Buzz, derived from the compatibility engine without any percentages.
 */
export function getBuddyCommonLines(params: {
  user?: UserProfile | null;
  partner?: AttendeeProfile | null;
}): string[] {
  const { user, partner } = params;
  const userQuiz = normalizeQuizProfile(user?.personalityQuiz);
  const partnerQuiz = normalizeQuizProfile(partner?.personalityQuiz);

  const lines: string[] = [];
  const addLine = (text: string) => {
    const clean = text.trim();
    if (clean && !lines.includes(clean) && !/\d+%/.test(clean)) {
      lines.push(clean);
    }
  };

  if (userQuiz?.answers && partnerQuiz?.answers) {
    const priorityOrder: QuizQuestionKey[] = ['q2', 'q4', 'q1', 'q3', 'q7', 'q5', 'q8', 'q6'];
    for (const qId of priorityOrder) {
      if (lines.length >= 3) break;
      if (userQuiz.answers[qId] === partnerQuiz.answers[qId]) {
        const line = QUIZ_COMMON_CHECK_LINES[qId]?.[userQuiz.answers[qId]];
        if (line) addLine(line);
      }
    }

    if (
      lines.length < 3 &&
      ((userQuiz.answers.q6 === 'A' && partnerQuiz.answers.q6 === 'B') ||
        (userQuiz.answers.q6 === 'B' && partnerQuiz.answers.q6 === 'A'))
    ) {
      addLine('Balanced talker and listener vibe');
    }
  }

  if (lines.length < 3 && user?.faculty && partner?.faculty && user.faculty === partner.faculty) {
    addLine(`Both in ${user.faculty}`);
  }

  if (lines.length < 3 && user?.year && partner?.year && user.year === partner.year) {
    addLine(`Both in ${user.year}`);
  }

  if (lines.length < 3) {
    const dealbreakers = evaluateDealbreakers(
      userQuiz?.preferenceBubbles || [],
      user,
      partner
    );
    for (const tag of dealbreakers.softMatched) {
      if (lines.length >= 3) break;
      if (tag === 'Alcohol-free hangouts') addLine('Prefer alcohol-free hangouts');
      else if (tag === 'Strictly platonic') addLine('Looking for a strictly platonic buddy');
      else if (tag === 'Study-focused') addLine('Share study-focused goals');
      else if (tag === 'Punctual / No flakes') addLine('Value reliable meetups');
      else if (tag === 'Lives on campus') addLine('Both live on campus');
      else if (tag === 'Commuter-friendly') addLine('Commuter-friendly timing');
      else if (tag === 'Group match (3–4 people)') addLine('Open to small-group hangouts');
    }
  }

  if (lines.length === 0) {
    addLine('Both verified Waterloo students');
    addLine('Heading to the same campus event');
  }

  return lines.slice(0, 3);
}
