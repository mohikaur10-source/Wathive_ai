import { BUDDY_POLICY } from '../config/buddyPolicy';
import {
  BuddyAttendanceAnswer,
  BuddyLikertAnswer,
  BuddySurveySubmission,
  BuddyUseAgainAnswer
} from '../types';
import { EventLifecycleShape, getEventEndUtcMs, isEventPast } from './eventLifecycle';

export interface SurveyOfferEligibilityParams {
  event: EventLifecycleShape & { id: string };
  nowMs: number;
  optedInForEvent: boolean;
  dismissedEventIds: string[];
  surveysByEventId: Record<string, BuddySurveySubmission>;
  windowDays?: number;
}

export function isEventWithinSurveyWindow(
  event: EventLifecycleShape,
  nowMs: number,
  windowDays: number = BUDDY_POLICY.surveyOfferWindowDays
): boolean {
  if (!isEventPast(event, new Date(nowMs))) return false;
  const endMs = getEventEndUtcMs(event);
  if (!Number.isFinite(endMs)) return false;
  const elapsedMs = nowMs - endMs;
  if (elapsedMs < 0) return false;
  return elapsedMs <= windowDays * 24 * 60 * 60 * 1000;
}

export function isEventEligibleForSurveyOffer(params: SurveyOfferEligibilityParams): boolean {
  const {
    event,
    nowMs,
    optedInForEvent,
    dismissedEventIds,
    surveysByEventId,
    windowDays = BUDDY_POLICY.surveyOfferWindowDays
  } = params;

  if (!optedInForEvent) return false;
  if (dismissedEventIds.includes(event.id)) return false;
  if (surveysByEventId[event.id]) return false;

  return isEventWithinSurveyWindow(event, nowMs, windowDays);
}

export function getSurveyQuestionVisibility(
  hadBuddyPairing: boolean,
  attendedWithBuddy?: BuddyAttendanceAnswer | null
): { showQ2: boolean; showQ3: boolean } {
  return {
    showQ2: hadBuddyPairing && attendedWithBuddy === 'yes',
    showQ3: hadBuddyPairing
  };
}

export function canSubmitBuddySurvey(params: {
  hadBuddyPairing: boolean;
  attendedWithBuddy: BuddyAttendanceAnswer | null;
  comfortableWithBuddy: BuddyLikertAnswer | null;
  matchedAppropriately: BuddyLikertAnswer | null;
  useMatchingAgain: BuddyUseAgainAnswer | null;
}): boolean {
  const {
    hadBuddyPairing,
    attendedWithBuddy,
    comfortableWithBuddy,
    matchedAppropriately,
    useMatchingAgain
  } = params;

  if (!attendedWithBuddy || !useMatchingAgain) return false;
  const { showQ2, showQ3 } = getSurveyQuestionVisibility(hadBuddyPairing, attendedWithBuddy);
  if (showQ2 && !comfortableWithBuddy) return false;
  if (showQ3 && !matchedAppropriately) return false;
  return true;
}

export function buildSanitizedSurveySubmission(params: {
  eventId: string;
  hadBuddyPairing: boolean;
  attendedWithBuddy: BuddyAttendanceAnswer;
  comfortableWithBuddy?: BuddyLikertAnswer | null;
  matchedAppropriately?: BuddyLikertAnswer | null;
  useMatchingAgain: BuddyUseAgainAnswer;
  feedbackText?: string;
  submittedAtIso?: string;
}): BuddySurveySubmission {
  const {
    eventId,
    hadBuddyPairing,
    attendedWithBuddy,
    comfortableWithBuddy,
    matchedAppropriately,
    useMatchingAgain,
    feedbackText,
    submittedAtIso = new Date().toISOString()
  } = params;

  const { showQ2, showQ3 } = getSurveyQuestionVisibility(hadBuddyPairing, attendedWithBuddy);
  const trimmedText = (feedbackText || '').trim().slice(0, 1000);

  return {
    eventId,
    submittedAt: submittedAtIso,
    hadBuddyPairing,
    attendedWithBuddy,
    ...(showQ2 && comfortableWithBuddy ? { comfortableWithBuddy } : {}),
    ...(showQ3 && matchedAppropriately ? { matchedAppropriately } : {}),
    useMatchingAgain,
    ...(trimmedText ? { feedbackText: trimmedText } : {})
  };
}

export interface AggregateSurveySummary {
  totalResponses: number;
  attendedWithBuddyCounts: Record<BuddyAttendanceAnswer, number>;
  comfortableWithBuddyCounts: Record<BuddyLikertAnswer, number>;
  matchedAppropriatelyCounts: Record<BuddyLikertAnswer, number>;
  useMatchingAgainCounts: Record<BuddyUseAgainAnswer, number>;
}

export function summarizeSurveyResponses(
  submissions: BuddySurveySubmission[]
): AggregateSurveySummary {
  const summary: AggregateSurveySummary = {
    totalResponses: submissions.length,
    attendedWithBuddyCounts: { yes: 0, independent: 0, did_not_attend: 0 },
    comfortableWithBuddyCounts: { yes: 0, somewhat: 0, no: 0, not_applicable: 0 },
    matchedAppropriatelyCounts: { yes: 0, somewhat: 0, no: 0, not_applicable: 0 },
    useMatchingAgainCounts: { definitely: 0, maybe: 0, probably_not: 0 }
  };

  for (const sub of submissions) {
    summary.attendedWithBuddyCounts[sub.attendedWithBuddy] += 1;
    if (sub.comfortableWithBuddy) {
      summary.comfortableWithBuddyCounts[sub.comfortableWithBuddy] += 1;
    }
    if (sub.matchedAppropriately) {
      summary.matchedAppropriatelyCounts[sub.matchedAppropriately] += 1;
    }
    summary.useMatchingAgainCounts[sub.useMatchingAgain] += 1;
  }

  return summary;
}
