import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBuddyNotificationSpec,
  buildNotificationDedupeKey,
  canCreateBuddyNotification,
  canSendBrowserPush,
  formatNotificationRelativeTime,
  incrementPushDailyCounter,
  isNotificationVisibleForSettings,
  isTorontoQuietHours
} from '../src/utils/buddyNotifications.js';
import {
  findBestMatchCandidate,
  findReplacementCandidate,
  getEventBuddyStatusText,
  getMatchConversationId,
  getPairingDisplayState
} from '../src/utils/pairingLogic.js';
import {
  CLOSED_POST_EVENT_TEXT,
  evaluatePostEventChatAccess
} from '../src/utils/postEventChat.js';
import {
  buildSanitizedSurveySubmission,
  canSubmitBuddySurvey,
  getSurveyQuestionVisibility,
  isEventEligibleForSurveyOffer,
  summarizeSurveyResponses
} from '../src/utils/surveyLogic.js';
import {
  formatSeekerCountText,
  formatSeekerFacultyYear,
  getFirstName,
  getSeedBuddySeekers,
  getShortCompatibilityLine
} from '../src/utils/buddySeeding.js';
import {
  createArchivedConversationRecord,
  derivePairingLifecycleState,
  getAllowedManageActions,
  getBuddyCommonLines,
  getManageBuddyOutcomePlan,
  isWithinLastMinuteWindow,
  purgeExpiredArchivedConversations,
  shouldShowLastMinuteReminder
} from '../src/utils/pairingLifecycle.js';
import { torontoWallClockToUtcMs } from '../src/utils/eventLifecycle.js';
import { BUDDY_POLICY } from '../src/config/buddyPolicy.js';
import { AttendeeProfile, Conversation, NotificationSettings } from '../src/types/index.js';

const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  interestedCategories: ['Food and student deals', 'University clubs'],
  types: {
    newEvents: true,
    upcomingRsvp: true,
    buddyMatches: true,
    registrationDeadlines: true,
    eventChanges: true,
    studentDiscounts: true
  },
  frequency: 'instant',
  quietHoursEnabled: true,
  avoidOverwhelming: true
};

const SAMPLE_ATTENDEES: Record<string, AttendeeProfile> = {
  maya_patel: {
    id: 'maya_patel',
    name: 'Maya P.',
    avatar: 'https://example.com/maya.jpg',
    faculty: 'Engineering',
    year: '2nd Year',
    isVerifiedUWStudent: true
  },
  marcus_zhao: {
    id: 'marcus_zhao',
    name: 'Marcus Z.',
    avatar: 'https://example.com/marcus.jpg',
    faculty: 'Environment',
    year: '4th Year',
    isVerifiedUWStudent: true
  },
  sarah_kim: {
    id: 'sarah_kim',
    name: 'Sarah K.',
    avatar: 'https://example.com/sarah.jpg',
    faculty: 'Mathematics',
    year: '3rd Year',
    isVerifiedUWStudent: true
  }
};

describe('Buddy notifications rules', () => {
  it('builds exact notification copy with only event title (no private names or reasons)', () => {
    const provisional = buildBuddyNotificationSpec('provisional_match', 'Tech Mixer');
    assert.equal(provisional.title, "You've been matched!");
    assert.equal(
      provisional.message,
      "We've found a potential buddy for Tech Mixer. Say hello and get to know each other!"
    );

    const confirmed = buildBuddyNotificationSpec('mutual_confirmation', 'Tech Mixer');
    assert.equal(confirmed.title, "You're officially buddies!");
    assert.equal(
      confirmed.message,
      "You and your buddy have both confirmed that you'd like to attend Tech Mixer together."
    );

    const ended = buildBuddyNotificationSpec('pairing_ended', 'Tech Mixer');
    assert.equal(ended.title, 'Your buddy pairing has changed');
    assert.equal(
      ended.message,
      "Your previous pairing has ended. We're prioritizing finding you another buddy for Tech Mixer."
    );

    const cancelled = buildBuddyNotificationSpec('buddy_cancelled', 'Tech Mixer');
    assert.equal(cancelled.title, 'Buddy availability update');
    assert.equal(
      cancelled.message,
      "Your buddy is no longer able to attend Tech Mixer. We'll do our best to find you another buddy."
    );

    const replacement = buildBuddyNotificationSpec('replacement_found', 'Tech Mixer');
    assert.equal(replacement.title, "We've found you another buddy!");
    assert.equal(replacement.message, 'Your new potential buddy is ready to connect.');

    const noMatch = buildBuddyNotificationSpec('no_match_found', 'Tech Mixer');
    assert.equal(noMatch.title, 'Buddy matching update');
    assert.equal(
      noMatch.message,
      "We weren't able to find you a buddy for Tech Mixer. Your RSVP is still active, and you're welcome to attend."
    );
  });

  it('enforces preference toggle, RSVP guard, dedupeKey uniqueness, and no_match_found 24h window', () => {
    const key = buildNotificationDedupeKey('provisional_match', 'ev_1', 'conv_match_ev_1_maya');
    assert.equal(
      canCreateBuddyNotification({
        kind: 'provisional_match',
        dedupeKey: key,
        usedDedupeKeys: [],
        buddyMatchesEnabled: false,
        isAttendingEvent: true
      }),
      false
    );

    assert.equal(
      canCreateBuddyNotification({
        kind: 'provisional_match',
        dedupeKey: key,
        usedDedupeKeys: [],
        buddyMatchesEnabled: true,
        isAttendingEvent: false
      }),
      false
    );

    assert.equal(
      canCreateBuddyNotification({
        kind: 'provisional_match',
        dedupeKey: key,
        usedDedupeKeys: [key],
        buddyMatchesEnabled: true,
        isAttendingEvent: true
      }),
      false
    );

    const startMs = torontoWallClockToUtcMs('2026-12-01', '18:00:00');
    const noMatchKey = buildNotificationDedupeKey('no_match_found', 'ev_1');

    // Before start -> false
    assert.equal(
      canCreateBuddyNotification({
        kind: 'no_match_found',
        dedupeKey: noMatchKey,
        usedDedupeKeys: [],
        buddyMatchesEnabled: true,
        isAttendingEvent: true,
        optedInBeforeStart: true,
        hasActivePairingForEvent: false,
        eventStartMs: startMs,
        nowMs: startMs - 60_000
      }),
      false
    );

    // 1 hour after start -> true
    assert.equal(
      canCreateBuddyNotification({
        kind: 'no_match_found',
        dedupeKey: noMatchKey,
        usedDedupeKeys: [],
        buddyMatchesEnabled: true,
        isAttendingEvent: true,
        optedInBeforeStart: true,
        hasActivePairingForEvent: false,
        eventStartMs: startMs,
        nowMs: startMs + 60 * 60 * 1000
      }),
      true
    );

    // >= 24h after start -> false
    assert.equal(
      canCreateBuddyNotification({
        kind: 'no_match_found',
        dedupeKey: noMatchKey,
        usedDedupeKeys: [],
        buddyMatchesEnabled: true,
        isAttendingEvent: true,
        optedInBeforeStart: true,
        hasActivePairingForEvent: false,
        eventStartMs: startMs,
        nowMs: startMs + 24 * 60 * 60 * 1000
      }),
      false
    );

    // Opted in after start -> false
    assert.equal(
      canCreateBuddyNotification({
        kind: 'no_match_found',
        dedupeKey: noMatchKey,
        usedDedupeKeys: [],
        buddyMatchesEnabled: true,
        isAttendingEvent: true,
        optedInBeforeStart: false,
        hasActivePairingForEvent: false,
        eventStartMs: startMs,
        nowMs: startMs + 60_000
      }),
      false
    );
  });

  it('respects Toronto quiet hours (23:00-08:00) and daily push cap (2/day)', () => {
    const quietNight = new Date(torontoWallClockToUtcMs('2026-11-25', '23:30:00'));
    const quietEarly = new Date(torontoWallClockToUtcMs('2026-11-26', '07:45:00'));
    const daytime = new Date(torontoWallClockToUtcMs('2026-11-26', '14:15:00'));

    assert.equal(isTorontoQuietHours(quietNight), true);
    assert.equal(isTorontoQuietHours(quietEarly), true);
    assert.equal(isTorontoQuietHours(daytime), false);

    assert.equal(
      canSendBrowserPush({
        browserAlertsEnabled: true,
        permission: 'granted',
        settings: DEFAULT_NOTIFICATION_SETTINGS,
        pushDailyCounter: null,
        nowDate: quietNight
      }),
      false
    );

    let counter = incrementPushDailyCounter(null, '2026-11-26');
    counter = incrementPushDailyCounter(counter, '2026-11-26');
    assert.equal(counter.count, 2);

    assert.equal(
      canSendBrowserPush({
        browserAlertsEnabled: true,
        permission: 'granted',
        settings: DEFAULT_NOTIFICATION_SETTINGS,
        pushDailyCounter: counter,
        nowDate: daytime
      }),
      false
    );

    // Next day resets cap
    const nextDay = new Date(torontoWallClockToUtcMs('2026-11-27', '14:15:00'));
    assert.equal(
      canSendBrowserPush({
        browserAlertsEnabled: true,
        permission: 'granted',
        settings: DEFAULT_NOTIFICATION_SETTINGS,
        pushDailyCounter: counter,
        nowDate: nextDay
      }),
      true
    );
  });

  it('formats relative times and filters notifications by preference', () => {
    const base = 1_700_000_000_000;
    assert.equal(formatNotificationRelativeTime(base, base + 10_000), 'Just now');
    assert.equal(formatNotificationRelativeTime(base, base + 5 * 60_000), '5m ago');
    assert.equal(formatNotificationRelativeTime(base, base + 3 * 3600_000), '3h ago');
    assert.equal(formatNotificationRelativeTime(base, base + 2 * 86400_000), '2d ago');

    assert.equal(
      isNotificationVisibleForSettings(
        {
          id: 'n1',
          type: 'buddy_match',
          title: 't',
          message: 'm',
          timestamp: 'Just now',
          read: false
        },
        {
          ...DEFAULT_NOTIFICATION_SETTINGS,
          types: { ...DEFAULT_NOTIFICATION_SETTINGS.types, buddyMatches: false }
        }
      ),
      false
    );
  });
});

describe('Pairing confirmation privacy, deterministic IDs & replacement', () => {
  it('never reveals partner confirmation before both confirm and produces deterministic match IDs', () => {
    assert.equal(getMatchConversationId('ev_1', 'maya_patel'), 'conv_match_ev_1_maya_patel');

    const partnerConfirmedOnly = getPairingDisplayState({
      pairingStatus: 'provisional',
      userConfirmed: false,
      partnerConfirmed: true
    });
    assert.equal(partnerConfirmedOnly.isConfirmed, false);
    assert.equal(partnerConfirmedOnly.userConfirmed, false);

    const bothConfirmed = getPairingDisplayState({
      pairingStatus: 'confirmed',
      userConfirmed: true,
      partnerConfirmed: true
    });
    assert.equal(bothConfirmed.isConfirmed, true);
    assert.equal(bothConfirmed.userConfirmed, true);
  });

  it('computes EventDetailModal buddy status text without leaking partner confirmation', () => {
    assert.deepEqual(
      getEventBuddyStatusText({ isBuddyMatchingActive: false, conversationsForEvent: [] }),
      { statusText: null, conversationId: null }
    );

    assert.deepEqual(
      getEventBuddyStatusText({ isBuddyMatchingActive: true, conversationsForEvent: [] }),
      { statusText: 'Looking for your buddy.', conversationId: null }
    );

    assert.deepEqual(
      getEventBuddyStatusText({
        isBuddyMatchingActive: true,
        conversationsForEvent: [
          { id: 'c1', pairingStatus: 'provisional', userConfirmed: false, partnerConfirmed: true }
        ]
      }),
      { statusText: "You've been matched. Say hello.", conversationId: 'c1' }
    );

    assert.deepEqual(
      getEventBuddyStatusText({
        isBuddyMatchingActive: true,
        conversationsForEvent: [
          { id: 'c1', pairingStatus: 'confirmed', userConfirmed: true, partnerConfirmed: true }
        ]
      }),
      { statusText: "You're officially buddies.", conversationId: 'c1' }
    );
  });

  it('skips blocked, removed, and excluded attendees when picking a replacement candidate', () => {
    const result = findReplacementCandidate({
      eventId: 'ev_1',
      eventTitle: 'Tech Mixer',
      attendeeIds: ['maya_patel', 'marcus_zhao', 'sarah_kim'],
      attendeesById: SAMPLE_ATTENDEES,
      user: null,
      conversations: [],
      removedChats: [
        {
          partnerId: 'sarah_kim',
          eventId: 'ev_1',
          reason: 'left',
          removedAt: '2026-11-25T12:00:00Z'
        }
      ],
      blockedUserIds: [],
      excludePartnerIds: ['maya_patel']
    });

    assert.ok(result);
    assert.equal(result.attendee.id, 'marcus_zhao');
  });

  it('breaks compatibility score ties deterministically by person id and selects highest compatibility candidate', () => {
    const tieA: AttendeeProfile = {
      id: 'alpha_student',
      name: 'Alpha S.',
      avatar: 'https://example.com/a.jpg',
      faculty: 'Engineering',
      year: '2nd Year',
      isVerifiedUWStudent: true
    };
    const tieB: AttendeeProfile = {
      id: 'zeta_student',
      name: 'Zeta S.',
      avatar: 'https://example.com/z.jpg',
      faculty: 'Engineering',
      year: '2nd Year',
      isVerifiedUWStudent: true
    };
    const higherCompat: AttendeeProfile = {
      id: 'beta_match',
      name: 'Beta M.',
      avatar: 'https://example.com/b.jpg',
      faculty: 'Mathematics',
      year: '3rd Year',
      defaultSocialBattery: 'Chill & Observing',
      isVerifiedUWStudent: true,
      personalityQuiz: {
        completed: true,
        answers: {
          q1: 'B',
          q2: 'B',
          q3: 'C',
          q4: 'A',
          q5: 'A',
          q6: 'A',
          q7: 'B',
          q8: 'B'
        },
        preferenceBubbles: ['Same faculty', 'Alcohol-free hangouts', 'Strictly platonic']
      }
    };

    const attendeesById: Record<string, AttendeeProfile> = {
      zeta_student: tieB,
      alpha_student: tieA,
      beta_match: higherCompat
    };

    // Identical compatibility scores -> stable tie-break chooses alpha_student over zeta_student regardless of input order
    const tieWinner = findBestMatchCandidate({
      eventId: 'ev_tie',
      eventTitle: 'Tie Event',
      attendeeIds: ['zeta_student', 'alpha_student'],
      attendeesById,
      user: null,
      conversations: [],
      removedChats: [],
      blockedUserIds: []
    });
    assert.ok(tieWinner);
    assert.equal(tieWinner.attendee.id, 'alpha_student');

    // Best match skips signed-in user / active / ended and chooses highest compatibility score
    const bestWinner = findBestMatchCandidate({
      eventId: 'ev_best',
      eventTitle: 'Best Match Event',
      attendeeIds: ['zeta_student', 'beta_match', 'alpha_student'],
      attendeesById,
      user: {
        id: 'user_self',
        name: 'Alex Chen',
        avatar: '',
        school: 'University of Waterloo',
        faculty: 'Mathematics',
        program: 'CS',
        year: '3rd Year',
        bio: '',
        dob: '2004-01-01',
        email: 'alex@uwaterloo.ca',
        isVerifiedUWStudent: true,
        onboarded: true,
        preferences: {
          categories: ['Technology'],
          noPreferences: false,
          preferredFaculties: ['Mathematics'],
          preferredYears: ['3rd Year']
        },
        personalityQuiz: {
          completed: true,
          answers: {
            q1: 'B',
            q2: 'B',
            q3: 'C',
            q4: 'A',
            q5: 'A',
            q6: 'A',
            q7: 'B',
            q8: 'B'
          },
          preferenceBubbles: ['Same faculty', 'Alcohol-free hangouts', 'Strictly platonic']
        }
      },
      conversations: [],
      removedChats: [],
      blockedUserIds: [],
      reportedUserIds: [],
      userEventBattery: 'Chill & Observing'
    });
    assert.ok(bestWinner);
    assert.equal(bestWinner.attendee.id, 'beta_match');
  });

  it('prevents duplicate provisional match notifications across retries and blocks withdrawn RSVPs', () => {
    const convId = getMatchConversationId('ev_retry', 'maya_patel');
    const dedupeKey = buildNotificationDedupeKey('provisional_match', 'ev_retry', convId);

    // First attempt allowed
    assert.equal(
      canCreateBuddyNotification({
        kind: 'provisional_match',
        dedupeKey,
        usedDedupeKeys: [],
        buddyMatchesEnabled: true,
        isAttendingEvent: true
      }),
      true
    );

    // Retry with persisted dedupeKey -> blocked
    assert.equal(
      canCreateBuddyNotification({
        kind: 'provisional_match',
        dedupeKey,
        usedDedupeKeys: [dedupeKey],
        buddyMatchesEnabled: true,
        isAttendingEvent: true
      }),
      false
    );

    // Withdrawn RSVP -> blocked
    assert.equal(
      canCreateBuddyNotification({
        kind: 'replacement_found',
        dedupeKey: buildNotificationDedupeKey('replacement_found', 'ev_retry', 'conv_match_ev_retry_sarah'),
        usedDedupeKeys: [],
        buddyMatchesEnabled: true,
        isAttendingEvent: false
      }),
      false
    );
  });
});

describe('Post-event chat access policy', () => {
  const baseConv: Pick<
    Conversation,
    'stayConnectedUser' | 'stayConnectedPartner' | 'isChatClosedPostEvent'
  > = {
    stayConnectedUser: false,
    stayConnectedPartner: false,
    isChatClosedPostEvent: false
  };

  it('keeps chat open for 48h after event end, then closes unless both stay connected', () => {
    const endMs = torontoWallClockToUtcMs('2026-11-25', '18:00:00');

    // Before end -> upcoming
    const beforeEnd = evaluatePostEventChatAccess(baseConv, endMs, endMs - 60_000);
    assert.equal(beforeEnd.isEventEnded, false);
    assert.equal(beforeEnd.isChatClosed, false);

    // 10h after end -> ~38h left
    const withinWindow = evaluatePostEventChatAccess(
      baseConv,
      endMs,
      endMs + 10 * 60 * 60 * 1000
    );
    assert.equal(withinWindow.isEventEnded, true);
    assert.equal(withinWindow.isChatClosed, false);
    assert.equal(withinWindow.showStayConnectedBar, true);
    assert.equal(withinWindow.remainingHours, 38);
    assert.ok(withinWindow.statusLineText?.includes('about 38h'));

    // 49h after end, only user tapped stay connected -> closed
    const pastWindowOneSide = evaluatePostEventChatAccess(
      { ...baseConv, stayConnectedUser: true, stayConnectedPartner: false },
      endMs,
      endMs + 49 * 60 * 60 * 1000
    );
    assert.equal(pastWindowOneSide.isChatClosed, true);
    assert.equal(pastWindowOneSide.closedBannerText, CLOSED_POST_EVENT_TEXT);

    // 49h after end, both tapped stay connected -> open
    const pastWindowBoth = evaluatePostEventChatAccess(
      { ...baseConv, stayConnectedUser: true, stayConnectedPartner: true },
      endMs,
      endMs + 49 * 60 * 60 * 1000
    );
    assert.equal(pastWindowBoth.isChatClosed, false);
    assert.equal(pastWindowBoth.showStayConnectedBar, false);

    // closed_at_event_end mode
    const immediateClose = evaluatePostEventChatAccess(baseConv, endMs, endMs + 1000, {
      policy: { ...BUDDY_POLICY, postEventChatAccess: 'closed_at_event_end' }
    });
    assert.equal(immediateClose.isChatClosed, true);

    // always_open mode
    const alwaysOpen = evaluatePostEventChatAccess(baseConv, endMs, endMs + 100 * 3600_000, {
      policy: { ...BUDDY_POLICY, postEventChatAccess: 'always_open' }
    });
    assert.equal(alwaysOpen.isChatClosed, false);
  });
});

describe('Post-event survey eligibility, conditional visibility & privacy', () => {
  const endedEv = { id: 'ev_1', date: '2026-11-20', endTime: '18:00', status: 'published' };
  const endMs = torontoWallClockToUtcMs('2026-11-20', '18:00:00');

  it('offers survey only after event ends, within 14 days, once, and stops after dismiss or submit', () => {
    assert.equal(
      isEventEligibleForSurveyOffer({
        event: endedEv,
        nowMs: endMs - 1000,
        optedInForEvent: true,
        dismissedEventIds: [],
        surveysByEventId: {}
      }),
      false
    );

    assert.equal(
      isEventEligibleForSurveyOffer({
        event: endedEv,
        nowMs: endMs + 3 * 86400_000,
        optedInForEvent: true,
        dismissedEventIds: [],
        surveysByEventId: {}
      }),
      true
    );

    assert.equal(
      isEventEligibleForSurveyOffer({
        event: endedEv,
        nowMs: endMs + 15 * 86400_000,
        optedInForEvent: true,
        dismissedEventIds: [],
        surveysByEventId: {}
      }),
      false
    );

    assert.equal(
      isEventEligibleForSurveyOffer({
        event: endedEv,
        nowMs: endMs + 2 * 86400_000,
        optedInForEvent: true,
        dismissedEventIds: ['ev_1'],
        surveysByEventId: {}
      }),
      false
    );
  });

  it('enforces conditional visibility for Q2/Q3 and strips private/inapplicable fields on submit', () => {
    assert.deepEqual(getSurveyQuestionVisibility(false, 'yes'), { showQ2: false, showQ3: false });
    assert.deepEqual(getSurveyQuestionVisibility(true, 'independent'), { showQ2: false, showQ3: true });
    assert.deepEqual(getSurveyQuestionVisibility(true, 'yes'), { showQ2: true, showQ3: true });

    assert.equal(
      canSubmitBuddySurvey({
        hadBuddyPairing: false,
        attendedWithBuddy: 'independent',
        comfortableWithBuddy: null,
        matchedAppropriately: null,
        useMatchingAgain: 'definitely'
      }),
      true
    );

    const sanitized = buildSanitizedSurveySubmission({
      eventId: 'ev_1',
      hadBuddyPairing: true,
      attendedWithBuddy: 'independent',
      comfortableWithBuddy: 'yes',
      matchedAppropriately: 'somewhat',
      useMatchingAgain: 'maybe',
      feedbackText: 'a'.repeat(1200)
    });

    assert.equal(sanitized.comfortableWithBuddy, undefined);
    assert.equal(sanitized.matchedAppropriately, 'somewhat');
    assert.equal(sanitized.feedbackText?.length, 1000);

    const summary = summarizeSurveyResponses([sanitized]);
    assert.equal(summary.totalResponses, 1);
    assert.equal(summary.attendedWithBuddyCounts.independent, 1);
    assert.equal(summary.matchedAppropriatelyCounts.somewhat, 1);
    assert.equal('studentId' in summary, false);
  });
});

describe('Deterministic buddy seeker seeding & minimal formatting', () => {
  const POOL: AttendeeProfile[] = [
    {
      id: 'maya_patel',
      name: 'Maya Patel',
      avatar: 'https://example.com/maya.jpg',
      faculty: 'Engineering',
      year: '2nd Year',
      showFaculty: true,
      showYear: true,
      isVerifiedUWStudent: true
    },
    {
      id: 'liam_campbell',
      name: 'Liam Campbell',
      avatar: 'https://example.com/liam.jpg',
      faculty: 'Mathematics',
      year: '3rd Year',
      showFaculty: true,
      showYear: false,
      isVerifiedUWStudent: true
    },
    {
      id: 'chloe_nguyen',
      name: 'Chloe Nguyen',
      avatar: 'https://example.com/chloe.jpg',
      faculty: 'Science',
      year: '1st Year',
      showFaculty: false,
      showYear: true,
      isVerifiedUWStudent: true
    },
    {
      id: 'marcus_zhao',
      name: 'Marcus Zhao',
      avatar: 'https://example.com/marcus.jpg',
      faculty: 'Environment',
      year: '4th Year',
      showFaculty: true,
      showYear: true,
      isVerifiedUWStudent: true
    },
    {
      id: 'sarah_kim',
      name: 'Sarah Kim',
      avatar: 'https://example.com/sarah.jpg',
      faculty: 'Arts',
      year: '2nd Year',
      showFaculty: true,
      showYear: true,
      isVerifiedUWStudent: true
    },
    {
      id: 'ethan_bhatia',
      name: 'Ethan Bhatia',
      avatar: 'https://example.com/ethan.jpg',
      faculty: 'Health',
      year: '3rd Year',
      showFaculty: true,
      showYear: true,
      isVerifiedUWStudent: true
    },
    {
      id: 'nadia_hassan',
      name: 'Nadia Hassan',
      avatar: 'https://example.com/nadia.jpg',
      faculty: 'Mathematics',
      year: '4th Year',
      showFaculty: true,
      showYear: true,
      isVerifiedUWStudent: true
    },
    {
      id: 'owen_reid',
      name: 'Owen Reid',
      avatar: 'https://example.com/owen.jpg',
      faculty: 'Arts',
      year: '2nd Year',
      showFaculty: true,
      showYear: true,
      isVerifiedUWStudent: true
    },
    {
      id: 'tessa_morales',
      name: 'Tessa Morales',
      avatar: 'https://example.com/tessa.jpg',
      faculty: 'Science',
      year: '1st Year',
      showFaculty: true,
      showYear: true,
      isVerifiedUWStudent: true
    }
  ];

  it('deterministically assigns 5+ seekers to every active event and spreads pool members', () => {
    const counts = new Set<number>();
    const firstNamesSeen = new Set<string>();
    const allChosenIds = new Set<string>();

    const eventIds = [
      'wusa_253953',
      'wusa_252286',
      'wusa_246689',
      'wusa_255978',
      ...Array.from({ length: 46 }, (_, i) => `future_wusa_${1000 + i}`)
    ];

    for (const id of eventIds) {
      const firstRun = getSeedBuddySeekers(id, { pool: POOL });
      const secondRun = getSeedBuddySeekers(id, { pool: POOL });
      assert.deepEqual(firstRun, secondRun);
      assert.ok(firstRun.length >= 5, `Expected >= 5 for ${id}, got ${firstRun.length}`);
      counts.add(firstRun.length);
      firstNamesSeen.add(firstRun[0].id);
      for (const s of firstRun) allChosenIds.add(s.id);
    }

    // Multiple distinct counts >= 5 and spread across events
    assert.ok(counts.size >= 2);
    assert.ok(firstNamesSeen.size >= 5);
    assert.equal(allChosenIds.size, POOL.length);
  });

  it('excludes past, ended, cancelled, research events, signed-in, blocked, reported, left, active, and ended partners', () => {
    assert.deepEqual(getSeedBuddySeekers('ev_past', { pool: POOL, isPast: true }), []);
    assert.deepEqual(getSeedBuddySeekers('ev_ended', { pool: POOL, status: 'ended' }), []);
    assert.deepEqual(getSeedBuddySeekers('ev_cancelled', { pool: POOL, status: 'cancelled' }), []);
    assert.deepEqual(getSeedBuddySeekers('ev_research', { pool: POOL, isResearchStudy: true }), []);

    const filtered = getSeedBuddySeekers('wusa_253953', {
      pool: POOL,
      signedInUserId: 'maya_patel',
      blockedUserIds: ['marcus_zhao'],
      reportedUserIds: ['sarah_kim'],
      removedChats: [{ partnerId: 'ethan_bhatia', eventId: null, reason: 'left', removedAt: '2026-11-25T12:00:00Z' }]
    });
    const ids = new Set(filtered.map((s) => s.id));
    assert.equal(ids.has('maya_patel'), false);
    assert.equal(ids.has('marcus_zhao'), false);
    assert.equal(ids.has('sarah_kim'), false);
    assert.equal(ids.has('ethan_bhatia'), false);
    assert.ok(filtered.length >= 5);
  });

  it('never invents new seekers or replacements once all selected seekers for an event are excluded', () => {
    const eventId = 'wusa_253953';
    const initialSeekers = getSeedBuddySeekers(eventId, { pool: POOL });
    assert.ok(initialSeekers.length >= 5);

    const remainingSeekers = getSeedBuddySeekers(eventId, {
      pool: POOL,
      endedPartnerIds: initialSeekers.map((s) => s.id)
    });
    assert.equal(remainingSeekers.length, 0);

    const replacement = findReplacementCandidate({
      eventId,
      eventTitle: 'Sample Event',
      attendeeIds: remainingSeekers.map((s) => s.id),
      attendeesById: Object.fromEntries(POOL.map((p) => [p.id, p])),
      user: null,
      conversations: [],
      removedChats: [],
      blockedUserIds: [],
      excludePartnerIds: initialSeekers.map((s) => s.id)
    });
    assert.equal(replacement, null);
  });

  it('formats first name, shared faculty/year, count line, and percentage-free compatibility lines safely', () => {
    assert.equal(getFirstName('Maya Patel'), 'Maya');
    assert.equal(formatSeekerFacultyYear(POOL[0]), 'Engineering · 2nd Year');
    assert.equal(formatSeekerFacultyYear(POOL[1]), 'Mathematics'); // showYear: false
    assert.equal(formatSeekerFacultyYear(POOL[2]), '1st Year'); // showFaculty: false
    assert.equal(
      formatSeekerFacultyYear({ faculty: 'Arts', year: '1st Year', showFaculty: false, showYear: false }),
      null
    );
    assert.equal(formatSeekerCountText(1), '1 person is looking for a buddy');
    assert.equal(formatSeekerCountText(5), '5 people are looking for a buddy');

    const line = getShortCompatibilityLine(
      { icebreakerPill: '88% match · Same faculty', reasons: [] },
      { faculty: 'Science', year: '1st Year' },
      POOL[2] // Science hidden via showFaculty: false
    );
    assert.equal(/\d+%/.test(line), false);
    assert.equal(line.includes('Science'), false);
  });
});

describe('Full buddy journey lifecycle, Manage options, <24h guard & 30-day anonymized archive', () => {
  it('derives lifecycle states and allowed manage actions without exposing partner confirmation', () => {
    assert.equal(
      derivePairingLifecycleState({ isBuddyMatchingActive: true, conversation: null }),
      'searching'
    );
    assert.equal(
      derivePairingLifecycleState({ isBuddyMatchingActive: false, conversation: null }),
      'ended'
    );
    assert.equal(
      derivePairingLifecycleState({
        isBuddyMatchingActive: true,
        conversation: { pairingStatus: 'provisional', userConfirmed: false, partnerConfirmed: true }
      }),
      'provisional'
    );
    assert.equal(
      derivePairingLifecycleState({
        isBuddyMatchingActive: true,
        conversation: { pairingStatus: 'confirmed', userConfirmed: true, partnerConfirmed: true }
      }),
      'confirmed'
    );

    assert.deepEqual(getAllowedManageActions('searching'), ['no_longer_need', 'unable_to_attend']);
    assert.equal(getAllowedManageActions('provisional', false).includes('confirm_buddy'), true);
    assert.equal(getAllowedManageActions('provisional', true).includes('confirm_buddy'), false);
    assert.equal(getAllowedManageActions('confirmed', true).includes('confirm_buddy'), false);
    assert.deepEqual(getAllowedManageActions('ended'), []);
  });

  it('defines exact RSVP, matching, and partner simulation outcomes for Manage actions', () => {
    const rematch = getManageBuddyOutcomePlan('find_another');
    assert.equal(rematch.keepRsvp, true);
    assert.equal(rematch.keepBuddyMatchingActive, true);
    assert.equal(rematch.excludePartnerForEvent, true);
    assert.equal(rematch.triggerUserReplacementSearch, true);
    assert.equal(rematch.partnerNoticeKind, 'pairing_ended');

    const noLongerNeed = getManageBuddyOutcomePlan('no_longer_need');
    assert.equal(noLongerNeed.keepRsvp, true);
    assert.equal(noLongerNeed.keepBuddyMatchingActive, false);
    assert.equal(noLongerNeed.triggerUserReplacementSearch, false);
    assert.equal(noLongerNeed.partnerNoticeKind, 'pairing_ended');

    const unableToAttend = getManageBuddyOutcomePlan('unable_to_attend');
    assert.equal(unableToAttend.keepRsvp, false);
    assert.equal(unableToAttend.keepBuddyMatchingActive, false);
    assert.equal(unableToAttend.triggerUserReplacementSearch, false);
    assert.equal(unableToAttend.partnerNoticeKind, 'buddy_cancelled');
  });

  it('shows <24h last-minute reminder ONLY for confirmed pairings within 24h in Toronto time', () => {
    const eventShape = { date: '2026-11-28', startTime: '18:00', endTime: '20:00' };
    const startMs = torontoWallClockToUtcMs('2026-11-28', '18:00:00');
    const confirmedConv = { pairingStatus: 'confirmed' as const, userConfirmed: true, partnerConfirmed: true };
    const provisionalConv = { pairingStatus: 'provisional' as const, userConfirmed: true, partnerConfirmed: false };

    assert.equal(isWithinLastMinuteWindow(eventShape, startMs - 25 * 3600_000), false);
    assert.equal(isWithinLastMinuteWindow(eventShape, startMs - 2 * 3600_000), true);
    assert.equal(isWithinLastMinuteWindow(eventShape, startMs + 60_000), false);

    // 2h before start -> true only for confirmed, false for provisional
    assert.equal(
      shouldShowLastMinuteReminder({
        conversation: confirmedConv,
        event: eventShape,
        nowMs: startMs - 2 * 3600_000
      }),
      true
    );
    assert.equal(
      shouldShowLastMinuteReminder({
        conversation: provisionalConv,
        event: eventShape,
        nowMs: startMs - 2 * 3600_000
      }),
      false
    );

    // 25h before start -> false even if confirmed
    assert.equal(
      shouldShowLastMinuteReminder({
        conversation: confirmedConv,
        event: eventShape,
        nowMs: startMs - 25 * 3600_000
      }),
      false
    );
  });

  it('archives closed conversations anonymously without partner identity/reason and purges at 30 days', () => {
    const closedAtMs = 1_750_000_000_000;
    const record = createArchivedConversationRecord({
      conversation: {
        id: 'conv_1',
        eventId: 'ev_1',
        eventTitle: 'SLC Board Games',
        eventDate: '2026-11-28',
        eventLocation: 'SLC'
      },
      messages: [
        { id: 'm1', conversationId: 'conv_1', senderId: 'system', text: 'Matched', timestamp: '10:00' },
        { id: 'm2', conversationId: 'conv_1', senderId: 'user_alex', text: 'Hey!', timestamp: '10:01' },
        { id: 'm3', conversationId: 'conv_1', senderId: 'maya_patel', text: 'Hi there!', timestamp: '10:02' }
      ],
      userId: 'user_alex',
      closedAtMs
    });

    assert.equal('partner' in record, false);
    assert.equal('reason' in record, false);
    assert.deepEqual(
      record.messages.map((m) => m.senderRole),
      ['system', 'me', 'buddy']
    );

    // Retained at 29 days, purged at >= 30 days
    assert.equal(
      purgeExpiredArchivedConversations([record], closedAtMs + 29 * 86_400_000, 30).length,
      1
    );
    assert.equal(
      purgeExpiredArchivedConversations([record], closedAtMs + 30 * 86_400_000, 30).length,
      0
    );
  });

  it('generates up to 3 percentage-free common intro lines for first-open chat card', () => {
    const lines = getBuddyCommonLines({
      user: {
        id: 'u1',
        name: 'Alex Chen',
        avatar: '',
        school: 'University of Waterloo',
        faculty: 'Mathematics',
        program: 'CS',
        year: '3rd Year',
        bio: '',
        dob: '2004-01-01',
        email: 'alex@uwaterloo.ca',
        isVerifiedUWStudent: true,
        onboarded: true,
        preferences: {
          categories: ['Technology'],
          noPreferences: false,
          preferredFaculties: [],
          preferredYears: []
        },
        personalityQuiz: {
          completed: true,
          answers: {
            q1: 'B',
            q2: 'B',
            q3: 'C',
            q4: 'A',
            q5: 'A',
            q6: 'A',
            q7: 'B',
            q8: 'A'
          },
          preferenceBubbles: ['Alcohol-free hangouts']
        }
      },
      partner: {
        ...SAMPLE_ATTENDEES.maya_patel,
        faculty: 'Mathematics',
        year: '3rd Year',
        personalityQuiz: {
          completed: true,
          answers: {
            q1: 'B',
            q2: 'B',
            q3: 'C',
            q4: 'A',
            q5: 'A',
            q6: 'B',
            q7: 'B',
            q8: 'A'
          }
        }
      }
    });

    assert.ok(lines.length >= 1 && lines.length <= 3);
    for (const line of lines) {
      assert.equal(/\d+%/.test(line), false);
    }
  });
});

