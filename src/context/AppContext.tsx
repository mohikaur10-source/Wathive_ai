import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  UserProfile,
  EventItem,
  ConnectionRequest,
  Conversation,
  ChatMessage,
  AttendeeProfile,
  UserPreferences,
  ReportSubmission,
  PersonalityQuizProfile,
  CompatibilityMatch,
  NotificationSettings,
  InAppNotification,
  NotificationItemType,
  NotificationInterestCategory,
  AggregationSource,
  DuplicateDetectionResult,
  SyncCycleReport,
  StudentDiscount,
  AdminAuditLog,
  RemovedChatReason,
  RemovedChatRecord,
  SocialBatteryTag,
  EventFilterTag,
  BuddyNotificationKind,
  BuddyOptInRecord,
  BuddySurveySubmission,
  PushDailyCounter,
  ArchivedConversationRecord,
  PartnerSimulationNotice
} from '../types';
import {
  INITIAL_USER,
  INITIAL_EVENTS,
  INITIAL_EVENT_ATTENDEES,
  INITIAL_USER_ATTENDING,
  INITIAL_USER_SAVED,
  INITIAL_USER_VISIBILITY,
  INITIAL_REQUESTS,
  INITIAL_CONVERSATIONS,
  INITIAL_CHAT_MESSAGES,
  SAMPLE_ATTENDEES,
  formatPublicName,
  DEFAULT_NOTIFICATION_SETTINGS,
  INITIAL_NOTIFICATIONS,
  INITIAL_AGGREGATION_SOURCES,
  INITIAL_SYNC_REPORT,
  INITIAL_DUPLICATES,
  INITIAL_STUDENT_DISCOUNTS,
  INITIAL_AUDIT_LOGS
} from '../data/mockData';
import {
  calculateCompatibility,
  DEFAULT_ALEX_QUIZ,
  computeBuddyArchetype,
  normalizeQuizProfile
} from '../utils/compatibilityEngine';
import { getFilterTagKey } from '../utils/eventFilters';
import { runTwoHourRefreshCycle, detectDuplicateEvents } from '../utils/eventAggregationEngine';
import { toWaterlooUtcIso, getTorontoNow, TorontoNowInfo } from '../utils/timeZone';
import { getEventEndUtcMs, getEventStartUtcMs, isEventPast } from '../utils/eventLifecycle';
import {
  ChatStateSnapshot,
  RemoveConversationsParams,
  applyRemoveConversations,
  applyUnblockUser,
  getRequestRejectionForRemovedChat,
  isChatRemovedForPair,
  isPartnerBlockedOrReported,
  sanitizeChatSnapshot
} from '../utils/chatRemoval';
import { BUDDY_POLICY } from '../config/buddyPolicy';
import {
  buildNotificationDedupeKey,
  canCreateBuddyNotification,
  canSendBrowserPush,
  createBuddyNotificationItem,
  getBrowserNotificationPermission,
  incrementPushDailyCounter,
  isNotificationVisibleForSettings,
  requestBrowserNotificationPermission,
  showBrowserNotification
} from '../utils/buddyNotifications';
import {
  findReplacementCandidate,
  getMatchConversationId
} from '../utils/pairingLogic';
import {
  getEffectiveNowMs,
  readDemoClockMs,
  writeDemoClockMs
} from '../utils/demoClock';
import {
  getFirstName,
  getSeedBuddySeekers
} from '../utils/buddySeeding';
import {
  createArchivedConversationRecord,
  getManageBuddyOutcomePlan,
  purgeExpiredArchivedConversations
} from '../utils/pairingLifecycle';

export interface BuddyPrivacySettings {
  showFaculty: boolean;
  showYear: boolean;
  shortIntro: string;
}

export interface SuggestedMatchItem {
  attendee: AttendeeProfile;
  compatibility: CompatibilityMatch;
}

interface AppContextType {
  user: UserProfile | null;
  isLoggedIn: boolean;
  onboardingStep: 1 | 2 | 3 | null;
  events: EventItem[];
  upcomingEvents: EventItem[];
  savedEventIds: string[];
  attendingEventIds: string[];
  attendeeVisibility: Record<string, boolean>; // eventId -> buddy matching enabled (default false)
  eventBuddySettings: Record<string, BuddyPrivacySettings>; // eventId -> custom privacy details
  connectionRequests: ConnectionRequest[];
  conversations: Conversation[];
  chatMessages: Record<string, ChatMessage[]>;
  typingConversationIds: Record<string, boolean>;
  chatErrors: Record<string, string>;
  blockedUserIds: string[];
  removedChats: RemovedChatRecord[];
  reportedUserIds: string[];
  reportedEventIds: string[];
  reportsList: ReportSubmission[];
  allAttendees: Record<string, AttendeeProfile>;
  dailyBuddyRequestsCount: number;
  maxDailyRequests: number;
  savedFilters: EventFilterTag[];
  eventSocialBattery: Record<string, SocialBatteryTag>;

  // Actions
  loginDemoUser: (asNewUser?: boolean) => void;
  logout: () => void;
  updateOnboardingProfile: (data: Partial<UserProfile>) => void;
  completeOnboardingPreferences: (prefs: UserPreferences) => void;
  updatePersonalityQuiz: (quiz: PersonalityQuizProfile) => void;
  completeQuizAndPopulateMatches: (quiz: PersonalityQuizProfile) => void;
  toggleSavedFilter: (tag: EventFilterTag) => void;
  removeSavedFilter: (tag: EventFilterTag) => void;
  clearSavedFilters: () => void;
  setEventSocialBattery: (eventId: string, battery: SocialBatteryTag) => void;
  verifyUWStudent: (email: string) => { success: boolean; message: string };
  updateProfile: (data: Partial<UserProfile>) => void;
  updatePreferences: (prefs: UserPreferences) => void;
  toggleSaveEvent: (eventId: string) => void;
  toggleGoing: (eventId: string) => void; // Strictly marks attendance; if cancelled, removes matching eligibility
  enableBuddyMatching: (eventId: string, settings: BuddyPrivacySettings) => { success: boolean; message: string };
  disableBuddyMatching: (eventId: string) => void;
  getEventAttendees: (eventId: string) => AttendeeProfile[];
  getSuggestedMatches: (eventId: string) => SuggestedMatchItem[];
  sendConnectionRequest: (eventId: string, recipientId: string, introMessage?: string) => { success: boolean; message: string };
  respondConnectionRequest: (requestId: string, action: 'accept' | 'decline') => void;
  withdrawConnectionRequest: (requestId: string) => void;
  sendMessage: (conversationId: string, text: string) => void;
  removeConversations: (params: { partnerId: string; eventId?: string; reason: RemovedChatReason }) => void;
  toggleStayConnected: (conversationId: string) => void;
  simulatePartnerStayConnected: (conversationId: string) => void;
  toggleChatPostEventClosed: (conversationId: string) => void;
  blockUser: (userId: string) => void;
  unblockUser: (userId: string) => void;
  reportItem: (
    targetType: 'user' | 'event',
    targetId: string,
    targetName: string,
    reason: string,
    description?: string
  ) => void;
  createEvent: (eventData: Omit<EventItem, 'id' | 'createdAt' | 'creatorId' | 'status'>, isDraft?: boolean) => EventItem;
  updateEvent: (eventId: string, updatedData: Partial<EventItem>) => void;
  cancelEvent: (eventId: string) => void;
  resetDemoData: () => void;
  notificationSettings: NotificationSettings;
  updateNotificationSettings: (settings: NotificationSettings) => void;
  notifications: InAppNotification[];
  unreadNotificationsCount: number;
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;
  deleteNotification: (id: string) => void;
  simulateTestNotification: (type?: NotificationItemType) => void;

  // Technical & Operational Capabilities (Requirement 8)
  aggregationSources: AggregationSource[];
  duplicateResults: DuplicateDetectionResult[];
  syncReports: SyncCycleReport[];
  studentDiscounts: StudentDiscount[];
  auditLogs: AdminAuditLog[];
  runScheduledRefresh: () => { success: boolean; message: string; report: SyncCycleReport };
  resolveDuplicate: (duplicateId: string, action: 'merge' | 'dismiss') => void;
  moderateEvent: (eventId: string, newStatus: 'approved' | 'rejected' | 'flagged') => void;
  resolveReport: (reportId: string, action: 'resolved_warning' | 'resolved_removed' | 'dismissed', notes?: string) => void;
  addCustomDiscount: (discount: Omit<StudentDiscount, 'id' | 'verifiedAt'>) => void;

  // Buddy notifications, pairing confirmation, post-event surveys & demo controls
  effectiveNowMs: number;
  demoClockMs: number | null;
  attendedEventSnapshots: Record<string, EventItem>;
  buddyOptInHistory: Record<string, BuddyOptInRecord>;
  pairingEventHistory: Record<string, boolean>;
  endedPairingsByEvent: Record<string, string[]>;
  searchingReplacementEventIds: Record<string, boolean>;
  eventSurveys: Record<string, BuddySurveySubmission>;
  surveyDismissedEventIds: string[];
  browserAlertsEnabled: boolean;
  browserAlertPermission: NotificationPermission | 'unsupported';
  visibleNotifications: InAppNotification[];
  getEventById: (eventId: string) => EventItem | undefined;
  markConversationRead: (conversationId: string) => void;
  confirmPairing: (conversationId: string) => void;
  rematchBuddyForEvent: (conversationId: string) => { ok: boolean; message: string };
  leaveBuddyMatchingFromChat: (conversationId: string) => { ok: boolean; message: string };
  cancelRsvpFromChat: (conversationId: string) => { ok: boolean; message: string };
  archivedConversations: ArchivedConversationRecord[];
  partnerSimulationLog: PartnerSimulationNotice[];
  toggleBrowserAlerts: (enabled: boolean) => Promise<{ permission: NotificationPermission | 'unsupported' }>;
  submitPostEventSurvey: (submission: BuddySurveySubmission) => void;
  dismissSurveyOffer: (eventId: string) => void;
  demoGetMatched: () => { ok: boolean; message: string };
  demoSimulatePairingEnded: () => { ok: boolean; message: string };
  demoSimulateBuddyCancelled: () => { ok: boolean; message: string };
  demoAdvanceWithin24Hours: () => { ok: boolean; message: string };
  demoAdvanceToEventStart: () => { ok: boolean; message: string };
  demoAdvanceToEventEnd: () => { ok: boolean; message: string };
  demoResetClock: () => void;
}

const STORAGE_KEY = 'wathive_app_state_v17';
const SAVED_FILTERS_STORAGE_KEY = 'wathive_saved_filters_v1';
const MAX_DAILY_REQUESTS = 5;

const AppContext = createContext<AppContextType | undefined>(undefined);

const stripLegacyConversationFlags = (convs: any[]): Conversation[] =>
  (Array.isArray(convs) ? convs : [])
    .filter((c) => Boolean(c && typeof c === 'object'))
    .map(({ isBlocked: _b, isDisconnected: _d, ...rest }) => rest as Conversation);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const loadState = () => {
    try {
      const legacyKeys = [
        'wathive_app_state_v7',
        'wathive_app_state_v8',
        'wathive_app_state_v9',
        'wathive_app_state_v10',
        'wathive_app_state_v11',
        'wathive_app_state_v12',
        'wathive_app_state_v13',
        'wathive_app_state_v14',
        'wathive_app_state_v15',
        'wathive_app_state_v16'
      ];

      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        legacyKeys.forEach((k) => {
          try { localStorage.removeItem(k); } catch {}
        });
        const parsed = JSON.parse(stored);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
      }

      // Preserve removals/blocks from v16 while starting cleanly on updated v17 event seeds
      const prevV16Raw = localStorage.getItem('wathive_app_state_v16');
      legacyKeys.forEach((k) => {
        try { localStorage.removeItem(k); } catch {}
      });
      if (prevV16Raw) {
        const prevV16 = JSON.parse(prevV16Raw);
        return {
          removedChats: Array.isArray(prevV16?.removedChats) ? prevV16.removedChats : [],
          blockedUserIds: Array.isArray(prevV16?.blockedUserIds) ? prevV16.blockedUserIds : [],
          reportedUserIds: Array.isArray(prevV16?.reportedUserIds) ? prevV16.reportedUserIds : []
        };
      }
    } catch (e) {
      console.warn('Error reading stored state:', e);
    }
    return null;
  };

  const initialCached = loadState();

  const [user, setUser] = useState<UserProfile | null>(() => {
    if (initialCached?.user === undefined) return INITIAL_USER;
    if (initialCached.user === null) return null;
    if (typeof initialCached.user !== 'object' || Array.isArray(initialCached.user)) {
      return INITIAL_USER;
    }
    const cachedUser = initialCached.user as UserProfile;
    const normalizedQuiz = normalizeQuizProfile(cachedUser.personalityQuiz);
    const baseUser: UserProfile = {
      ...cachedUser,
      id: typeof cachedUser.id === 'string' && cachedUser.id ? cachedUser.id : INITIAL_USER.id,
      name: typeof cachedUser.name === 'string' ? cachedUser.name : INITIAL_USER.name,
      personalityQuiz: normalizedQuiz
    };
    if (
      baseUser.id === 'user_alex_chen' &&
      (typeof baseUser.avatar !== 'string' || !baseUser.avatar || baseUser.avatar.includes('unsplash.com'))
    ) {
      return { ...baseUser, avatar: INITIAL_USER.avatar };
    }
    return baseUser;
  });
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(
    initialCached?.isLoggedIn !== undefined ? initialCached.isLoggedIn : true
  );
  const [onboardingStep, setOnboardingStep] = useState<1 | 2 | 3 | null>(
    initialCached?.onboardingStep !== undefined ? initialCached.onboardingStep : null
  );
  const [torontoNow, setTorontoNow] = useState<TorontoNowInfo>(() => getTorontoNow());
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [demoClockMs, setDemoClockMs] = useState<number | null>(() => readDemoClockMs());
  const lastGoodApiEventsRef = React.useRef<EventItem[]>([]);
  const lastFetchAtRef = React.useRef<number>(0);

  // Events always start empty and load dynamically from /api/collector/preview (never cached in localStorage)
  const [events, setEvents] = useState<EventItem[]>(() => [...INITIAL_EVENTS]);
  const [savedEventIds, setSavedEventIds] = useState<string[]>(
    initialCached?.savedEventIds || INITIAL_USER_SAVED
  );
  const [attendingEventIds, setAttendingEventIds] = useState<string[]>(
    initialCached?.attendingEventIds || INITIAL_USER_ATTENDING
  );
  // Separate attendance from buddy matching: default OFF for every event
  const [attendeeVisibility, setAttendeeVisibilityMap] = useState<Record<string, boolean>>(
    initialCached?.attendeeVisibility || INITIAL_USER_VISIBILITY
  );
  const [eventBuddySettings, setEventBuddySettings] = useState<Record<string, BuddyPrivacySettings>>(
    initialCached?.eventBuddySettings || {}
  );
  const [eventSocialBattery, setEventSocialBatteryMap] = useState<Record<string, SocialBatteryTag>>(
    initialCached?.eventSocialBattery || {}
  );
  const [savedFilters, setSavedFilters] = useState<EventFilterTag[]>(() => {
    try {
      const dedicated = localStorage.getItem(SAVED_FILTERS_STORAGE_KEY);
      if (dedicated) {
        const parsed = JSON.parse(dedicated);
        if (Array.isArray(parsed)) return parsed as EventFilterTag[];
      }
    } catch {
      // ignore storage errors
    }
    return Array.isArray(initialCached?.savedFilters) ? initialCached.savedFilters : [];
  });

  const [chatStore, setChatStore] = useState<ChatStateSnapshot>(() => {
    const rawBlocked: string[] = Array.isArray(initialCached?.blockedUserIds)
      ? initialCached.blockedUserIds.filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)
      : [];
    const rawRemoved: RemovedChatRecord[] = Array.isArray(initialCached?.removedChats)
      ? initialCached.removedChats
      : [];
    const rawConvs: any[] = Array.isArray(initialCached?.conversations)
      ? initialCached.conversations
      : INITIAL_CONVERSATIONS;
    const rawMsgs: Record<string, ChatMessage[]> =
      initialCached?.chatMessages &&
      typeof initialCached.chatMessages === 'object' &&
      !Array.isArray(initialCached.chatMessages)
        ? initialCached.chatMessages
        : INITIAL_CHAT_MESSAGES;
    const rawReqs: ConnectionRequest[] = Array.isArray(initialCached?.connectionRequests)
      ? initialCached.connectionRequests
      : INITIAL_REQUESTS;

    // Migrate any legacy isBlocked/isDisconnected conversations into removedChats so they stay gone
    const migratedRemoved = [...rawRemoved];
    for (const c of rawConvs) {
      const partnerId = typeof c?.partner?.id === 'string' ? c.partner.id : '';
      if (!partnerId) continue;
      if (c?.isBlocked) {
        if (!rawBlocked.includes(partnerId)) rawBlocked.push(partnerId);
        migratedRemoved.push({
          partnerId,
          eventId: null,
          reason: 'blocked',
          removedAt: new Date().toISOString()
        });
      } else if (c?.isDisconnected) {
        migratedRemoved.push({
          partnerId,
          eventId: c.eventId ?? null,
          reason: 'left',
          removedAt: new Date().toISOString()
        });
      }
    }

    return sanitizeChatSnapshot({
      conversations: stripLegacyConversationFlags(rawConvs),
      chatMessages: rawMsgs,
      connectionRequests: rawReqs,
      removedChats: migratedRemoved,
      blockedUserIds: rawBlocked
    });
  });

  const {
    conversations,
    chatMessages,
    connectionRequests,
    removedChats,
    blockedUserIds
  } = chatStore;

  const [typingConversationIds, setTypingConversationIds] = useState<Record<string, boolean>>({});
  const [chatErrors, setChatErrors] = useState<Record<string, string>>({});
  const chatReplySeqRef = React.useRef<Record<string, number>>({});

  const [reportedUserIds, setReportedUserIds] = useState<string[]>(
    initialCached?.reportedUserIds || []
  );
  const [reportedEventIds, setReportedEventIds] = useState<string[]>(
    initialCached?.reportedEventIds || []
  );
  const [reportsList, setReportsList] = useState<ReportSubmission[]>(
    initialCached?.reportsList || []
  );
  const [declinedHistory, setDeclinedHistory] = useState<string[]>(
    initialCached?.declinedHistory || [] // format: `${eventId}_${senderId}_${recipientId}`
  );
  const [dailyBuddyRequestsCount, setDailyBuddyRequestsCount] = useState<number>(
    initialCached?.dailyBuddyRequestsCount ?? 0
  );
  const [eventAttendeesMap, setEventAttendeesMap] = useState<Record<string, string[]>>(
    initialCached?.eventAttendeesMap || INITIAL_EVENT_ATTENDEES
  );
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(
    initialCached?.notificationSettings || DEFAULT_NOTIFICATION_SETTINGS
  );
  const [notifications, setNotifications] = useState<InAppNotification[]>(() => {
    const raw = Array.isArray(initialCached?.notifications)
      ? (initialCached.notifications as InAppNotification[])
      : INITIAL_NOTIFICATIONS;
    return raw.filter((n) => !/^notif_[1-6]$/.test(n.id));
  });
  const [usedNotificationDedupeKeys, setUsedNotificationDedupeKeys] = useState<string[]>(
    Array.isArray(initialCached?.usedNotificationDedupeKeys)
      ? initialCached.usedNotificationDedupeKeys
      : []
  );
  const [pushDailyCounter, setPushDailyCounter] = useState<PushDailyCounter | null>(
    initialCached?.pushDailyCounter || null
  );
  const [browserAlertsEnabled, setBrowserAlertsEnabled] = useState<boolean>(
    Boolean(initialCached?.browserAlertsEnabled)
  );
  const [browserAlertPermission, setBrowserAlertPermission] = useState<
    NotificationPermission | 'unsupported'
  >(() => getBrowserNotificationPermission());
  const [attendedEventSnapshots, setAttendedEventSnapshots] = useState<Record<string, EventItem>>(
    initialCached?.attendedEventSnapshots && typeof initialCached.attendedEventSnapshots === 'object'
      ? initialCached.attendedEventSnapshots
      : {}
  );
  const [buddyOptInHistory, setBuddyOptInHistory] = useState<Record<string, BuddyOptInRecord>>(
    initialCached?.buddyOptInHistory && typeof initialCached.buddyOptInHistory === 'object'
      ? initialCached.buddyOptInHistory
      : {}
  );
  const [pairingEventHistory, setPairingEventHistory] = useState<Record<string, boolean>>(() => {
    const cached: Record<string, boolean> =
      initialCached?.pairingEventHistory && typeof initialCached.pairingEventHistory === 'object'
        ? { ...initialCached.pairingEventHistory }
        : {};
    for (const c of chatStore.conversations) {
      cached[c.eventId] = true;
    }
    return cached;
  });
  const [endedPairingsByEvent, setEndedPairingsByEvent] = useState<Record<string, string[]>>(
    initialCached?.endedPairingsByEvent && typeof initialCached.endedPairingsByEvent === 'object'
      ? initialCached.endedPairingsByEvent
      : {}
  );
  const [searchingReplacementEventIds, setSearchingReplacementEventIds] = useState<
    Record<string, boolean>
  >({});
  const [eventSurveys, setEventSurveys] = useState<Record<string, BuddySurveySubmission>>(
    initialCached?.eventSurveys && typeof initialCached.eventSurveys === 'object'
      ? initialCached.eventSurveys
      : {}
  );
  const [surveyDismissedEventIds, setSurveyDismissedEventIds] = useState<string[]>(
    Array.isArray(initialCached?.surveyDismissedEventIds)
      ? initialCached.surveyDismissedEventIds
      : []
  );

  const [archivedConversations, setArchivedConversations] = useState<ArchivedConversationRecord[]>(() => {
    const raw = Array.isArray(initialCached?.archivedConversations)
      ? (initialCached.archivedConversations as ArchivedConversationRecord[])
      : [];
    const bootNowMs = getEffectiveNowMs(readDemoClockMs(), Date.now());
    return purgeExpiredArchivedConversations(raw, bootNowMs, BUDDY_POLICY.archiveRetentionDays);
  });
  const [partnerSimulationLog, setPartnerSimulationLog] = useState<PartnerSimulationNotice[]>(() =>
    Array.isArray(initialCached?.partnerSimulationLog)
      ? (initialCached.partnerSimulationLog as PartnerSimulationNotice[])
      : []
  );

  const initialMatchTimersRef = React.useRef<Record<string, number>>({});
  const replacementTimersRef = React.useRef<Record<string, number>>({});
  const partnerConfirmTimersRef = React.useRef<Record<string, number>>({});

  // Technical & Operational States (Requirement 8)
  const [aggregationSources, setAggregationSources] = useState<AggregationSource[]>(
    initialCached?.aggregationSources || INITIAL_AGGREGATION_SOURCES
  );
  const [duplicateResults, setDuplicateResults] = useState<DuplicateDetectionResult[]>(
    initialCached?.duplicateResults || INITIAL_DUPLICATES
  );
  const [syncReports, setSyncReports] = useState<SyncCycleReport[]>(
    initialCached?.syncReports || [INITIAL_SYNC_REPORT]
  );
  const [studentDiscounts, setStudentDiscounts] = useState<StudentDiscount[]>(
    initialCached?.studentDiscounts || INITIAL_STUDENT_DISCOUNTS
  );
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>(
    initialCached?.auditLogs || INITIAL_AUDIT_LOGS
  );

  const buildPersistedState = React.useCallback(
    (snapshot: ChatStateSnapshot) => ({
      user,
      isLoggedIn,
      onboardingStep,
      savedEventIds,
      attendingEventIds,
      attendeeVisibility,
      eventBuddySettings,
      eventSocialBattery,
      savedFilters,
      connectionRequests: snapshot.connectionRequests,
      conversations: snapshot.conversations,
      chatMessages: snapshot.chatMessages,
      removedChats: snapshot.removedChats,
      blockedUserIds: snapshot.blockedUserIds,
      reportedUserIds,
      reportedEventIds,
      reportsList,
      declinedHistory,
      dailyBuddyRequestsCount,
      eventAttendeesMap,
      notificationSettings,
      notifications,
      usedNotificationDedupeKeys,
      pushDailyCounter,
      browserAlertsEnabled,
      attendedEventSnapshots,
      buddyOptInHistory,
      pairingEventHistory,
      endedPairingsByEvent,
      archivedConversations,
      partnerSimulationLog,
      eventSurveys,
      surveyDismissedEventIds,
      aggregationSources,
      duplicateResults,
      syncReports,
      studentDiscounts,
      auditLogs
    }),
    [
      user,
      isLoggedIn,
      onboardingStep,
      savedEventIds,
      attendingEventIds,
      attendeeVisibility,
      eventBuddySettings,
      eventSocialBattery,
      savedFilters,
      reportedUserIds,
      reportedEventIds,
      reportsList,
      declinedHistory,
      dailyBuddyRequestsCount,
      eventAttendeesMap,
      notificationSettings,
      notifications,
      usedNotificationDedupeKeys,
      pushDailyCounter,
      browserAlertsEnabled,
      attendedEventSnapshots,
      buddyOptInHistory,
      pairingEventHistory,
      endedPairingsByEvent,
      archivedConversations,
      partnerSimulationLog,
      eventSurveys,
      surveyDismissedEventIds,
      aggregationSources,
      duplicateResults,
      syncReports,
      studentDiscounts,
      auditLogs
    ]
  );

  // Persist savedFilters under a dedicated key as well so they always survive reloads cleanly
  useEffect(() => {
    try {
      localStorage.setItem(SAVED_FILTERS_STORAGE_KEY, JSON.stringify(savedFilters));
    } catch (e) {
      console.error('Error saving default filters:', e);
    }
  }, [savedFilters]);

  // Save user preferences & buddy state to localStorage (never persist full events feed)
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(buildPersistedState(chatStore)));
    } catch (e) {
      console.error('Error saving state:', e);
    }
  }, [buildPersistedState, chatStore]);

  const updateChatStoreAndPersist = React.useCallback(
    (updater: (prev: ChatStateSnapshot) => ChatStateSnapshot) => {
      setChatStore((prev) => {
        const next = updater(prev);
        latestRef.current.chatStore = next;
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(buildPersistedState(next)));
        } catch (e) {
          console.error('Error persisting state immediately:', e);
        }
        return next;
      });
    },
    [buildPersistedState]
  );

  const syncFromCollector = React.useCallback(async (force = false) => {
    const currentMs = Date.now();
    if (!force && currentMs - lastFetchAtRef.current < 30_000) return;
    lastFetchAtRef.current = currentMs;

    setNowMs(currentMs);
    setTorontoNow(getTorontoNow(new Date(currentMs)));

    try {
      const res = await fetch('/api/collector/preview');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.previewEvents)) {
        const fetched = (data.previewEvents as EventItem[]).filter(
          (e) => !isEventPast(e, new Date(currentMs))
        );
        lastGoodApiEventsRef.current = fetched;
        setEvents((prev) => {
          // Retain only active non-WUSA student-created events if any were added in-session
          const customActive = prev.filter(
            (e) => !e.id.startsWith('wusa_') && !isEventPast(e, new Date(currentMs))
          );
          return [...customActive, ...fetched];
        });
      }
    } catch (err) {
      console.warn('WUSA collector live sync check skipped:', err);
      if (lastGoodApiEventsRef.current.length > 0) {
        const fallbackActive = lastGoodApiEventsRef.current.filter(
          (e) => !isEventPast(e, new Date(currentMs))
        );
        setEvents((prev) => {
          const customActive = prev.filter(
            (e) => !e.id.startsWith('wusa_') && !isEventPast(e, new Date(currentMs))
          );
          return [...customActive, ...fallbackActive];
        });
      }
    }
  }, []);

  // Live collector fetch on mount + 10m backend refresh + 60s lifecycle clock + focus/visibility re-check
  useEffect(() => {
    void syncFromCollector(true);

    const apiIntervalId = window.setInterval(() => {
      void syncFromCollector(true);
    }, 10 * 60 * 1000);

    const clockIntervalId = window.setInterval(() => {
      const currentMs = Date.now();
      setNowMs(currentMs);
      setTorontoNow(getTorontoNow(new Date(currentMs)));
    }, 60 * 1000);

    const handleFocusOrVisible = () => {
      if (document.visibilityState === 'hidden') return;
      const currentMs = Date.now();
      setNowMs(currentMs);
      setTorontoNow(getTorontoNow(new Date(currentMs)));
      void syncFromCollector(false);
    };

    window.addEventListener('focus', handleFocusOrVisible);
    document.addEventListener('visibilitychange', handleFocusOrVisible);

    return () => {
      window.clearInterval(apiIntervalId);
      window.clearInterval(clockIntervalId);
      window.removeEventListener('focus', handleFocusOrVisible);
      document.removeEventListener('visibilitychange', handleFocusOrVisible);
    };
  }, [syncFromCollector]);

  // Re-evaluate Toronto current time cleanly at Toronto midnight
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const currentMs = Date.now();
      setNowMs(currentMs);
      setTorontoNow(getTorontoNow(new Date(currentMs)));
    }, torontoNow.msUntilMidnightToronto + 1000);
    return () => window.clearTimeout(timer);
  }, [torontoNow]);

  const effectiveNowMs = getEffectiveNowMs(demoClockMs, nowMs);

  const upcomingEvents = React.useMemo(() => {
    const nowDate = new Date(effectiveNowMs);
    return events.filter((e) => !isEventPast(e, nowDate));
  }, [events, effectiveNowMs]);

  const getEventById = React.useCallback(
    (eventId: string): EventItem | undefined =>
      events.find((e) => e.id === eventId) || attendedEventSnapshots[eventId],
    [events, attendedEventSnapshots]
  );

  // Snapshot any attended, saved, opted-in, or conversation event so ended events stay visible in My Events
  useEffect(() => {
    if (events.length === 0) return;
    const trackedIds = new Set<string>([
      ...attendingEventIds,
      ...savedEventIds,
      ...Object.keys(buddyOptInHistory),
      ...chatStore.conversations.map((c) => c.eventId)
    ]);

    setAttendedEventSnapshots((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const ev of events) {
        if (trackedIds.has(ev.id)) {
          const existing = prev[ev.id];
          if (
            !existing ||
            existing.date !== ev.date ||
            existing.endTime !== ev.endTime ||
            existing.status !== ev.status ||
            existing.title !== ev.title
          ) {
            next[ev.id] = ev;
            changed = true;
          }
        }
      }
      return changed ? next : prev;
    });
  }, [events, attendingEventIds, savedEventIds, buddyOptInHistory, chatStore.conversations]);

  // Clean up any scheduled initial/replacement/confirmation timers on unmount
  useEffect(() => {
    return () => {
      Object.values(initialMatchTimersRef.current).forEach((t) => window.clearTimeout(t));
      Object.values(replacementTimersRef.current).forEach((t) => window.clearTimeout(t));
      Object.values(partnerConfirmTimersRef.current).forEach((t) => window.clearTimeout(t));
    };
  }, []);

  // Purge archived conversations older than 30 days whenever effective clock advances
  useEffect(() => {
    setArchivedConversations((prev) => {
      const pruned = purgeExpiredArchivedConversations(
        prev,
        effectiveNowMs,
        BUDDY_POLICY.archiveRetentionDays
      );
      return pruned.length === prev.length ? prev : pruned;
    });
  }, [effectiveNowMs]);

  const latestRef = React.useRef({
    user,
    attendingEventIds,
    attendeeVisibility,
    buddyOptInHistory,
    endedPairingsByEvent,
    reportedUserIds,
    notificationSettings,
    usedNotificationDedupeKeys,
    pushDailyCounter,
    browserAlertsEnabled,
    chatStore,
    events,
    attendedEventSnapshots,
    eventSocialBattery,
    eventAttendeesMap,
    effectiveNowMs
  });

  latestRef.current = {
    user,
    attendingEventIds,
    attendeeVisibility,
    buddyOptInHistory,
    endedPairingsByEvent,
    reportedUserIds,
    notificationSettings,
    usedNotificationDedupeKeys,
    pushDailyCounter,
    browserAlertsEnabled,
    chatStore,
    events,
    attendedEventSnapshots,
    eventSocialBattery,
    eventAttendeesMap,
    effectiveNowMs
  };

  const emitBuddyNotification = React.useCallback(
    (params: {
      kind: BuddyNotificationKind;
      eventId: string;
      eventTitle: string;
      conversationId?: string;
      partnerId?: string;
      dedupeSubjectId?: string;
      requireAttending?: boolean;
    }): boolean => {
      const latest = latestRef.current;
      const {
        kind,
        eventId,
        eventTitle,
        conversationId,
        partnerId,
        dedupeSubjectId,
        requireAttending = true
      } = params;

      const dedupeKey = buildNotificationDedupeKey(
        kind,
        eventId,
        dedupeSubjectId ?? conversationId ?? partnerId
      );

      const ev =
        latest.events.find((e) => e.id === eventId) ||
        latest.attendedEventSnapshots[eventId];
      const eventStartMs = ev ? getEventStartUtcMs(ev) : undefined;
      const hasActivePairing = latest.chatStore.conversations.some((c) => c.eventId === eventId);
      const optIn = latest.buddyOptInHistory[eventId];
      const optedInBeforeStart = Boolean(optIn?.active && optIn?.optedInBeforeStart);
      const isAttendingEvent = requireAttending
        ? latest.attendingEventIds.includes(eventId)
        : true;

      const allowed = canCreateBuddyNotification({
        kind,
        dedupeKey,
        usedDedupeKeys: latest.usedNotificationDedupeKeys,
        buddyMatchesEnabled: latest.notificationSettings.types.buddyMatches,
        isAttendingEvent,
        optedInBeforeStart,
        hasActivePairingForEvent: hasActivePairing,
        eventStartMs,
        nowMs: latest.effectiveNowMs
      });

      if (!allowed) return false;

      // Update ref synchronously to prevent duplicate triggers within same tick
      latestRef.current.usedNotificationDedupeKeys = [
        ...latest.usedNotificationDedupeKeys,
        dedupeKey
      ];
      setUsedNotificationDedupeKeys((prev) =>
        prev.includes(dedupeKey) ? prev : [...prev, dedupeKey]
      );

      const newNotif = createBuddyNotificationItem({
        kind,
        eventId,
        eventTitle,
        dedupeKey,
        conversationId,
        partnerId,
        nowMs: latest.effectiveNowMs
      });

      setNotifications((prev) => [newNotif, ...prev]);

      const nowDate = new Date(latest.effectiveNowMs);
      const permission = getBrowserNotificationPermission();
      setBrowserAlertPermission(permission);

      if (
        canSendBrowserPush({
          browserAlertsEnabled: latest.browserAlertsEnabled,
          permission,
          settings: latest.notificationSettings,
          pushDailyCounter: latest.pushDailyCounter,
          nowDate,
          cap: BUDDY_POLICY.pushDailyCap
        })
      ) {
        const sent = showBrowserNotification(newNotif.title, newNotif.message, dedupeKey);
        if (sent) {
          const todayStr = getTorontoNow(nowDate).dateStr;
          const nextCounter = incrementPushDailyCounter(latest.pushDailyCounter, todayStr);
          latestRef.current.pushDailyCounter = nextCounter;
          setPushDailyCounter(nextCounter);
        }
      }

      return true;
    },
    []
  );

  const archiveConversationsList = React.useCallback(
    (
      convsToArchive: Conversation[],
      chatMsgsSnapshot: Record<string, ChatMessage[]>,
      closedAtMs: number
    ) => {
      if (convsToArchive.length === 0) return;
      const currentUserId = latestRef.current.user?.id;
      const newRecords = convsToArchive.map((conv) =>
        createArchivedConversationRecord({
          conversation: conv,
          messages: chatMsgsSnapshot[conv.id] || [],
          userId: currentUserId,
          closedAtMs
        })
      );
      setArchivedConversations((prev) => {
        const existingIds = new Set(newRecords.map((r) => r.id));
        const combined = [...newRecords, ...prev.filter((r) => !existingIds.has(r.id))];
        return purgeExpiredArchivedConversations(
          combined,
          closedAtMs,
          BUDDY_POLICY.archiveRetentionDays
        );
      });
    },
    []
  );

  const quietlyEndPairingsForEvent = React.useCallback((eventId: string) => {
    if (initialMatchTimersRef.current[eventId]) {
      window.clearTimeout(initialMatchTimersRef.current[eventId]);
      delete initialMatchTimersRef.current[eventId];
    }
    if (replacementTimersRef.current[eventId]) {
      window.clearTimeout(replacementTimersRef.current[eventId]);
      delete replacementTimersRef.current[eventId];
    }
    setSearchingReplacementEventIds((prev) => {
      if (!prev[eventId]) return prev;
      const next = { ...prev };
      delete next[eventId];
      return next;
    });

    const activeConvsForEvent = latestRef.current.chatStore.conversations.filter(
      (c) => c.eventId === eventId
    );
    archiveConversationsList(
      activeConvsForEvent,
      latestRef.current.chatStore.chatMessages,
      latestRef.current.effectiveNowMs
    );
    for (const c of activeConvsForEvent) {
      if (partnerConfirmTimersRef.current[c.id]) {
        window.clearTimeout(partnerConfirmTimersRef.current[c.id]);
        delete partnerConfirmTimersRef.current[c.id];
      }
    }

    updateChatStoreAndPersist((prev) => {
      const removedConvIds = new Set(
        prev.conversations.filter((c) => c.eventId === eventId).map((c) => c.id)
      );
      if (removedConvIds.size === 0 && !prev.connectionRequests.some((r) => r.eventId === eventId && r.status === 'pending')) {
        return prev;
      }
      const nextMessages: Record<string, ChatMessage[]> = {};
      for (const [cid, msgs] of Object.entries(prev.chatMessages)) {
        if (!removedConvIds.has(cid)) {
          nextMessages[cid] = msgs;
        }
      }
      return {
        ...prev,
        conversations: prev.conversations.filter((c) => c.eventId !== eventId),
        chatMessages: nextMessages,
        connectionRequests: prev.connectionRequests.map((r) =>
          r.eventId === eventId && r.status === 'pending'
            ? { ...r, status: 'withdrawn' as const }
            : r
        )
      };
    });
  }, [archiveConversationsList, updateChatStoreAndPersist]);

  // Check for "no match found" notification when an opted-in upcoming event begins (< 24h elapsed)
  useEffect(() => {
    if (!user || !notificationSettings.types.buddyMatches) return;
    for (const eventId of attendingEventIds) {
      const optIn = buddyOptInHistory[eventId];
      if (!optIn?.active || !optIn.optedInBeforeStart) continue;
      if (chatStore.conversations.some((c) => c.eventId === eventId)) continue;
      const ev = events.find((e) => e.id === eventId) || attendedEventSnapshots[eventId];
      if (!ev || ev.isResearchStudy || ev.status === 'cancelled') continue;
      const startMs = getEventStartUtcMs(ev);
      if (!Number.isFinite(startMs)) continue;
      const elapsedMs = effectiveNowMs - startMs;
      if (elapsedMs >= 0 && elapsedMs < 24 * 60 * 60 * 1000) {
        emitBuddyNotification({
          kind: 'no_match_found',
          eventId,
          eventTitle: ev.title
        });
      }
    }
  }, [
    user,
    effectiveNowMs,
    events,
    attendedEventSnapshots,
    attendingEventIds,
    buddyOptInHistory,
    chatStore.conversations,
    notificationSettings.types.buddyMatches,
    emitBuddyNotification
  ]);

  const loginDemoUser = (asNewUser = false) => {
    if (asNewUser) {
      const newUser: UserProfile = {
        id: `user_${Date.now()}`,
        name: 'Jordan K.',
        avatar: INITIAL_USER.avatar,
        school: 'University of Waterloo',
        faculty: 'Engineering',
        program: 'Systems Design Engineering',
        year: '1st Year',
        bio: 'First year looking to connect for campus events!',
        dob: '2005-09-12',
        email: 'jordan.k@uwaterloo.ca',
        isVerifiedUWStudent: false, // Starts unverified to let users test the UW verification flow!
        uwEmail: '',
        onboarded: false,
        preferences: {
          categories: [],
          noPreferences: false,
          preferredFaculties: [],
          preferredYears: []
        },
        personalityQuiz: {
          completed: false,
          socialEnergy: 'ambivert',
          socialEnvironment: 'cozy_relaxed',
          hobbies: ['Tech & Coding', 'Foodie & Cafes'],
          groupSize: 'duo',
          experienceTypes: ['Casual Conversations']
        }
      };
      setUser(newUser);
      setIsLoggedIn(true);
      setOnboardingStep(1);
    } else {
      setUser(INITIAL_USER);
      setIsLoggedIn(true);
      setOnboardingStep(null);
    }
  };

  const logout = () => {
    setIsLoggedIn(false);
    setUser(null);
    setOnboardingStep(null);
  };

  const updateOnboardingProfile = (data: Partial<UserProfile>) => {
    if (!user) return;
    const updated = { ...user, ...data };
    setUser(updated);
    setOnboardingStep(2);
  };

  const completeOnboardingPreferences = (prefs: UserPreferences) => {
    if (!user) return;
    const updated: UserProfile = {
      ...user,
      preferences: prefs,
      onboarded: true
    };
    setUser(updated);
    setOnboardingStep(3); // Advance to Personality Quiz in onboarding
  };

  const updatePersonalityQuiz = (quiz: PersonalityQuizProfile) => {
    if (!user) return;
    const normalizedQuiz: PersonalityQuizProfile = {
      ...quiz,
      completed: true,
      archetype: quiz.archetype || computeBuddyArchetype(quiz.answers),
      preferenceBubbles: quiz.preferenceBubbles || [],
      updatedAt: new Date().toISOString()
    };
    setUser({
      ...user,
      personalityQuiz: normalizedQuiz
    });
  };

  const completeQuizAndPopulateMatches = (quiz: PersonalityQuizProfile) => {
    if (!user) return;
    const completedQuiz: PersonalityQuizProfile = {
      ...quiz,
      completed: true,
      archetype: quiz.archetype || computeBuddyArchetype(quiz.answers),
      preferenceBubbles: quiz.preferenceBubbles || [],
      updatedAt: new Date().toISOString()
    };

    const updatedUser: UserProfile = {
      ...user,
      personalityQuiz: completedQuiz
    };
    latestRef.current.user = updatedUser;
    setUser(updatedUser);

    // Refresh Icebreaker Hooks on active conversations without generating legacy request invitations
    updateChatStoreAndPersist((prev) => {
      const updatedConversations = prev.conversations.map((conv) => {
        const partnerId = conv?.partner?.id;
        const partnerProfile = (partnerId && SAMPLE_ATTENDEES[partnerId]) || conv.partner;
        const compat = calculateCompatibility(
          completedQuiz,
          partnerProfile?.personalityQuiz,
          updatedUser,
          partnerProfile,
          eventSocialBattery[conv.eventId] || conv.socialBattery,
          conv.eventId,
          conv.eventTitle
        );
        return {
          ...conv,
          partner: partnerProfile,
          icebreakerPill: compat.icebreakerPill,
          icebreakerBanner: compat.icebreakerBanner,
          icebreakerQuestion: compat.icebreakerQuestion
        };
      });

      return {
        ...prev,
        conversations: updatedConversations
      };
    });
  };

  const toggleSavedFilter = (tag: EventFilterTag) => {
    const targetKey = getFilterTagKey(tag.type, tag.value);
    setSavedFilters((prev) => {
      const exists = prev.some((f) => getFilterTagKey(f.type, f.value) === targetKey);
      if (exists) {
        return prev.filter((f) => getFilterTagKey(f.type, f.value) !== targetKey);
      }
      return [...prev, tag];
    });
  };

  const removeSavedFilter = (tag: EventFilterTag) => {
    const targetKey = getFilterTagKey(tag.type, tag.value);
    setSavedFilters((prev) => prev.filter((f) => getFilterTagKey(f.type, f.value) !== targetKey));
  };

  const clearSavedFilters = () => {
    setSavedFilters([]);
  };

  const setEventSocialBattery = (eventId: string, battery: SocialBatteryTag) => {
    setEventSocialBatteryMap((prev) => ({
      ...prev,
      [eventId]: battery
    }));
  };

  const verifyUWStudent = (email: string): { success: boolean; message: string } => {
    if (!user) return { success: false, message: 'Please log in first.' };
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail.endsWith('@uwaterloo.ca')) {
      return {
        success: false,
        message: 'Please provide a valid institutional University of Waterloo email ending in @uwaterloo.ca'
      };
    }

    setUser({
      ...user,
      isVerifiedUWStudent: true,
      uwEmail: cleanEmail
    });

    return {
      success: true,
      message: 'University of Waterloo student status verified successfully! Buddy matching unlocked.'
    };
  };

  const updateProfile = (data: Partial<UserProfile>) => {
    if (!user) return;
    setUser({ ...user, ...data });
  };

  const updatePreferences = (prefs: UserPreferences) => {
    if (!user) return;
    setUser({ ...user, preferences: prefs });
  };

  const toggleSaveEvent = (eventId: string) => {
    setSavedEventIds((prev) =>
      prev.includes(eventId) ? prev.filter((id) => id !== eventId) : [...prev, eventId]
    );
  };

  // Requirement B: "If an RSVP is cancelled, the user should no longer be eligible for a new match for that event."
  // If student leaves the event, quietly end their pairings and stop any replacement search with no matching notifications.
  const toggleGoing = (eventId: string) => {
    const isCurrentlyGoing = attendingEventIds.includes(eventId);
    if (isCurrentlyGoing) {
      latestRef.current.attendingEventIds = latestRef.current.attendingEventIds.filter(
        (id) => id !== eventId
      );
      setAttendingEventIds((prev) => prev.filter((id) => id !== eventId));

      const nextVis = { ...latestRef.current.attendeeVisibility };
      delete nextVis[eventId];
      latestRef.current.attendeeVisibility = nextVis;
      setAttendeeVisibilityMap((v) => {
        const next = { ...v };
        delete next[eventId];
        return next;
      });

      if (latestRef.current.buddyOptInHistory[eventId]) {
        latestRef.current.buddyOptInHistory = {
          ...latestRef.current.buddyOptInHistory,
          [eventId]: { ...latestRef.current.buddyOptInHistory[eventId], active: false }
        };
      }
      setBuddyOptInHistory((prev) =>
        prev[eventId] ? { ...prev, [eventId]: { ...prev[eventId], active: false } } : prev
      );
      quietlyEndPairingsForEvent(eventId);
    } else {
      const ev = getEventById(eventId);
      if (ev) {
        latestRef.current.attendedEventSnapshots = {
          ...latestRef.current.attendedEventSnapshots,
          [eventId]: ev
        };
        setAttendedEventSnapshots((prev) => ({ ...prev, [eventId]: ev }));
      }
      if (!latestRef.current.attendingEventIds.includes(eventId)) {
        latestRef.current.attendingEventIds = [...latestRef.current.attendingEventIds, eventId];
      }
      setAttendingEventIds((prev) => (prev.includes(eventId) ? prev : [...prev, eventId]));
    }
  };

  // One-tap automatic best-match opt-in per event
  const enableBuddyMatching = (
    eventId: string,
    settings: BuddyPrivacySettings
  ): { success: boolean; message: string } => {
    const activeUser = latestRef.current.user || user;
    if (!activeUser) return { success: false, message: 'Please sign in first.' };

    // Requirement C: Restrict buddy matching to verified UW students
    if (!activeUser.isVerifiedUWStudent) {
      return {
        success: false,
        message: 'Verification required: You must be a verified University of Waterloo student to enable buddy matching.'
      };
    }

    const ev = getEventById(eventId);
    if (ev) {
      latestRef.current.attendedEventSnapshots = {
        ...latestRef.current.attendedEventSnapshots,
        [eventId]: ev
      };
      setAttendedEventSnapshots((prev) => ({ ...prev, [eventId]: ev }));
    }

    // Requirement B: User must be RSVP'd to the event
    if (!latestRef.current.attendingEventIds.includes(eventId)) {
      latestRef.current.attendingEventIds = [...latestRef.current.attendingEventIds, eventId];
      setAttendingEventIds((prev) => (prev.includes(eventId) ? prev : [...prev, eventId]));
    }

    setEventBuddySettings((prev) => ({
      ...prev,
      [eventId]: settings
    }));

    latestRef.current.attendeeVisibility = {
      ...latestRef.current.attendeeVisibility,
      [eventId]: true
    };
    setAttendeeVisibilityMap((prev) => ({
      ...prev,
      [eventId]: true
    }));

    const startMs = ev ? getEventStartUtcMs(ev) : NaN;
    const optedInBeforeStart = Number.isFinite(startMs) ? effectiveNowMs < startMs : true;
    const prevOptIn = latestRef.current.buddyOptInHistory[eventId];
    const nextOptIn: BuddyOptInRecord = {
      optedInAtMs: prevOptIn?.optedInAtMs ?? effectiveNowMs,
      optedInBeforeStart: prevOptIn?.optedInBeforeStart ?? optedInBeforeStart,
      active: true
    };
    latestRef.current.buddyOptInHistory = {
      ...latestRef.current.buddyOptInHistory,
      [eventId]: nextOptIn
    };
    setBuddyOptInHistory((prev) => ({
      ...prev,
      [eventId]: {
        optedInAtMs: prev[eventId]?.optedInAtMs ?? effectiveNowMs,
        optedInBeforeStart: prev[eventId]?.optedInBeforeStart ?? optedInBeforeStart,
        active: true
      }
    }));

    // Enter brief searching state (~2s) before creating provisional best-match pairing
    if (
      ev &&
      !ev.isResearchStudy &&
      ev.status !== 'cancelled' &&
      !isEventPast(ev, new Date(latestRef.current.effectiveNowMs)) &&
      !latestRef.current.chatStore.conversations.some((c) => c.eventId === eventId)
    ) {
      if (initialMatchTimersRef.current[eventId]) {
        window.clearTimeout(initialMatchTimersRef.current[eventId]);
      }
      if (replacementTimersRef.current[eventId]) {
        window.clearTimeout(replacementTimersRef.current[eventId]);
        delete replacementTimersRef.current[eventId];
      }
      setSearchingReplacementEventIds((prev) => ({ ...prev, [eventId]: true }));

      initialMatchTimersRef.current[eventId] = window.setTimeout(() => {
        delete initialMatchTimersRef.current[eventId];
        setSearchingReplacementEventIds((prev) => {
          if (!prev[eventId]) return prev;
          const next = { ...prev };
          delete next[eventId];
          return next;
        });

        const latest = latestRef.current;
        if (!latest.user || !latest.user.isVerifiedUWStudent) return;
        if (!latest.attendingEventIds.includes(eventId)) return;
        if (!latest.attendeeVisibility[eventId]) return;
        if (latest.chatStore.conversations.some((c) => c.eventId === eventId)) return;

        const targetEv =
          latest.events.find((e) => e.id === eventId) ||
          latest.attendedEventSnapshots[eventId];
        if (!targetEv || targetEv.isResearchStudy || targetEv.status === 'cancelled') return;
        if (isEventPast(targetEv, new Date(latest.effectiveNowMs))) return;

        createProvisionalMatchForEvent(
          targetEv,
          'provisional_match',
          latest.endedPairingsByEvent[eventId] || []
        );
      }, BUDDY_POLICY.initialMatchDelayMs);
    }

    return {
      success: true,
      message: 'Finding your buddy.'
    };
  };

  // Turn off buddy matching visibility at any time: quietly end pairings & stop replacement search with no notifications
  const disableBuddyMatching = (eventId: string) => {
    latestRef.current.attendeeVisibility = {
      ...latestRef.current.attendeeVisibility,
      [eventId]: false
    };
    setAttendeeVisibilityMap((prev) => ({
      ...prev,
      [eventId]: false
    }));
    if (latestRef.current.buddyOptInHistory[eventId]) {
      latestRef.current.buddyOptInHistory = {
        ...latestRef.current.buddyOptInHistory,
        [eventId]: { ...latestRef.current.buddyOptInHistory[eventId], active: false }
      };
    }
    setBuddyOptInHistory((prev) =>
      prev[eventId] ? { ...prev, [eventId]: { ...prev[eventId], active: false } } : prev
    );
    quietlyEndPairingsForEvent(eventId);
  };

  // Deterministic 1–3 buddy seekers per active event (excludes signed-in user, blocked, reported, left, ended, already paired)
  const getEventAttendees = (eventId: string): AttendeeProfile[] => {
    const event = upcomingEvents.find((e) => e.id === eventId);
    if (!event) return [];

    return getSeedBuddySeekers(eventId, {
      pool: Object.values(SAMPLE_ATTENDEES),
      isPast: isEventPast(event, new Date(effectiveNowMs)),
      isResearchStudy: event.isResearchStudy,
      status: event.status,
      signedInUserId: user?.id,
      blockedUserIds,
      reportedUserIds,
      removedChats,
      activePairingPartnerIds: conversations
        .filter((c) => c.eventId === eventId && Boolean(c.partner?.id))
        .map((c) => c.partner.id),
      endedPartnerIds: endedPairingsByEvent[eventId] || []
    });
  };

  // Get prioritized compatible suggested matches for a specific event
  const getSuggestedMatches = (eventId: string): SuggestedMatchItem[] => {
    const event = upcomingEvents.find((e) => e.id === eventId);
    if (!event || event.isResearchStudy || event.status === 'cancelled' || event.status === 'ended') {
      return [];
    }

    const seekers = getEventAttendees(eventId);
    const userEventBattery = eventSocialBattery[eventId];
    const matches: SuggestedMatchItem[] = [];

    for (const attendee of seekers) {
      const compatibility = calculateCompatibility(
        user?.personalityQuiz || DEFAULT_ALEX_QUIZ,
        attendee.personalityQuiz,
        user,
        attendee,
        userEventBattery,
        eventId,
        event.title
      );
      if (!compatibility.filteredOut) {
        matches.push({ attendee, compatibility });
      }
    }

    return matches.sort((a, b) => {
      if (b.compatibility.score !== a.compatibility.score) {
        return b.compatibility.score - a.compatibility.score;
      }
      return a.attendee.id.localeCompare(b.attendee.id);
    });
  };

  // Send request immediately (no form or required text)
  const sendConnectionRequest = (
    eventId: string,
    recipientId: string,
    introMessage = ''
  ): { success: boolean; message: string } => {
    if (!user) return { success: false, message: 'Please sign in first.' };

    if (!user.isVerifiedUWStudent) {
      return {
        success: false,
        message: 'Verify your @uwaterloo.ca email to send buddy requests.'
      };
    }

    const event = upcomingEvents.find((e) => e.id === eventId);
    if (!event) return { success: false, message: 'Event not found.' };

    if (event.isResearchStudy) {
      return { success: false, message: 'Buddy matching is off for research studies.' };
    }

    if (event.status === 'ended' || event.status === 'cancelled') {
      return { success: false, message: 'Buddy requests are closed for this event.' };
    }

    // One active pairing per event
    if (conversations.some((c) => c.eventId === eventId)) {
      return { success: false, message: 'You already have a buddy for this event.' };
    }

    const removalCheck = getRequestRejectionForRemovedChat(
      recipientId,
      eventId,
      removedChats,
      blockedUserIds
    );
    if (removalCheck.blocked) {
      return { success: false, message: removalCheck.message || 'Cannot send request.' };
    }

    if (dailyBuddyRequestsCount >= MAX_DAILY_REQUESTS) {
      return {
        success: false,
        message: 'Daily limit reached.'
      };
    }

    const declineKey = `${eventId}_${user.id}_${recipientId}`;
    if (declinedHistory.includes(declineKey)) {
      return {
        success: false,
        message: 'Request declined for this event.'
      };
    }

    const existing = connectionRequests.find(
      (r) =>
        r.eventId === eventId &&
        r.senderId === user.id &&
        r.recipientId === recipientId &&
        (r.status === 'pending' || r.status === 'accepted')
    );

    if (existing) {
      return {
        success: false,
        message:
          existing.status === 'pending'
            ? 'Request already sent.'
            : 'Already matched for this event.'
      };
    }

    const recipient = SAMPLE_ATTENDEES[recipientId];
    if (!recipient || !recipient.isVerifiedUWStudent) {
      return {
        success: false,
        message: 'This student is not available for buddy matching.'
      };
    }

    // Ensure attending + opted-in so notifications and survey eligibility work cleanly
    setAttendedEventSnapshots((prev) => ({ ...prev, [eventId]: event }));
    if (!attendingEventIds.includes(eventId)) {
      latestRef.current.attendingEventIds = [...latestRef.current.attendingEventIds, eventId];
      setAttendingEventIds((prev) => (prev.includes(eventId) ? prev : [...prev, eventId]));
    }
    if (!attendeeVisibility[eventId]) {
      latestRef.current.attendeeVisibility = {
        ...latestRef.current.attendeeVisibility,
        [eventId]: true
      };
      setAttendeeVisibilityMap((prev) => ({ ...prev, [eventId]: true }));
      const startMs = getEventStartUtcMs(event);
      const optedInBeforeStart = Number.isFinite(startMs) ? effectiveNowMs < startMs : true;
      const optRec: BuddyOptInRecord = {
        optedInAtMs: effectiveNowMs,
        optedInBeforeStart,
        active: true
      };
      latestRef.current.buddyOptInHistory = {
        ...latestRef.current.buddyOptInHistory,
        [eventId]: optRec
      };
      setBuddyOptInHistory((prev) => ({ ...prev, [eventId]: optRec }));
    }

    const userSettings = eventBuddySettings[eventId] || {
      showFaculty: true,
      showYear: true,
      shortIntro: ''
    };

    const compatResult = calculateCompatibility(
      user.personalityQuiz || DEFAULT_ALEX_QUIZ,
      recipient.personalityQuiz,
      user,
      recipient,
      eventSocialBattery[eventId],
      eventId,
      event.title
    );

    const newReq: ConnectionRequest = {
      id: `req_${Date.now()}`,
      eventId,
      eventTitle: event.title,
      eventDate: event.date,
      senderId: user.id,
      senderName: formatPublicName(user.name),
      senderAvatar: user.avatar,
      senderFaculty: userSettings.showFaculty ? user.faculty : undefined,
      senderProgram: userSettings.showFaculty ? user.program : undefined,
      senderYear: userSettings.showYear ? user.year : undefined,
      recipientId,
      recipientName: recipient.name,
      introMessage,
      compatibilityScore: compatResult.score,
      compatibilityReasons: compatResult.reasons,
      icebreakerPill: compatResult.icebreakerPill,
      icebreakerBanner: compatResult.icebreakerBanner,
      icebreakerQuestion: compatResult.icebreakerQuestion,
      socialBattery: eventSocialBattery[eventId],
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    updateChatStoreAndPersist((prev) => ({
      ...prev,
      connectionRequests: [newReq, ...prev.connectionRequests]
    }));
    setDailyBuddyRequestsCount((prev) => prev + 1);

    // Simulated seeker accepts a few seconds later (creates one deterministic provisional conversation)
    window.setTimeout(() => {
      const convId = getMatchConversationId(eventId, recipientId);
      let createdMatch = false;
      const userFirst = getFirstName(user.name);
      const cleanGreeting = `Hey ${userFirst}! I'd love to head to ${event.title} together.`;

      updateChatStoreAndPersist((prev) => {
        const liveReq = prev.connectionRequests.find((r) => r.id === newReq.id);
        if (
          !liveReq ||
          liveReq.status !== 'pending' ||
          !latestRef.current.attendingEventIds.includes(eventId) ||
          !latestRef.current.attendeeVisibility[eventId] ||
          isChatRemovedForPair(recipientId, eventId, prev.removedChats, prev.blockedUserIds)
        ) {
          return prev;
        }

        // Enforce deterministic single pairing per event
        const alreadyPairedForEvent = prev.conversations.some(
          (c) => c.id === convId || c.eventId === eventId
        );
        if (alreadyPairedForEvent) {
          return {
            ...prev,
            connectionRequests: prev.connectionRequests.map((req) =>
              req.id === newReq.id ? { ...req, status: 'withdrawn' as const } : req
            )
          };
        }

        createdMatch = true;

        const newConv: Conversation = {
          id: convId,
          eventId,
          eventTitle: event.title,
          eventDate: event.date,
          eventLocation: event.location,
          partner: recipient,
          lastMessage: cleanGreeting,
          lastMessageTime: 'Just now',
          unreadCount: 1,
          pairingStatus: 'provisional',
          userConfirmed: false,
          partnerConfirmed: false,
          isReported: false,
          stayConnectedUser: false,
          stayConnectedPartner: false,
          isChatClosedPostEvent: false,
          icebreakerPill: compatResult.icebreakerPill,
          icebreakerBanner: compatResult.icebreakerBanner,
          icebreakerQuestion: compatResult.icebreakerQuestion,
          socialBattery: eventSocialBattery[eventId]
        };

        const msgs: ChatMessage[] = [
          {
            id: `m_sys_match_${convId}`,
            conversationId: convId,
            senderId: 'system',
            text: "You've been matched. Say hello. Nothing is final until you both confirm.",
            timestamp: 'Just now'
          },
          ...(introMessage
            ? [
                {
                  id: `m_intro_${Date.now()}`,
                  conversationId: convId,
                  senderId: user.id,
                  text: introMessage,
                  timestamp: 'Just now'
                }
              ]
            : []),
          {
            id: `m_reply_${Date.now() + 1}`,
            conversationId: convId,
            senderId: recipient.id,
            text: cleanGreeting,
            timestamp: 'Just now'
          }
        ];

        return {
          ...prev,
          connectionRequests: prev.connectionRequests.map((req) =>
            req.id === newReq.id ? { ...req, status: 'accepted' } : req
          ),
          conversations: [newConv, ...prev.conversations],
          chatMessages: {
            ...prev.chatMessages,
            [convId]: msgs
          }
        };
      });

      if (createdMatch) {
        setPairingEventHistory((prev) => ({ ...prev, [eventId]: true }));
        setSearchingReplacementEventIds((prev) => {
          if (!prev[eventId]) return prev;
          const next = { ...prev };
          delete next[eventId];
          return next;
        });
        emitBuddyNotification({
          kind: 'provisional_match',
          eventId,
          eventTitle: event.title,
          conversationId: convId,
          partnerId: recipientId
        });
      }
    }, 3500);

    return {
      success: true,
      message: 'Request sent.'
    };
  };

  // Accept or decline incoming request; accepting creates same provisional conversation with no extra notification
  const respondConnectionRequest = (requestId: string, action: 'accept' | 'decline') => {
    const req = connectionRequests.find((r) => r.id === requestId);
    if (!req) return;

    if (action === 'decline') {
      const declineKey = `${req.eventId}_${req.senderId}_${req.recipientId}`;
      setDeclinedHistory((prev) => [...prev, declineKey]);
      updateChatStoreAndPersist((prev) => ({
        ...prev,
        connectionRequests: prev.connectionRequests.map((r) =>
          r.id === requestId ? { ...r, status: 'declined' } : r
        )
      }));
      return;
    }

    const partner: AttendeeProfile = SAMPLE_ATTENDEES[req.senderId] || {
      id: req.senderId,
      name: req.senderName,
      avatar: req.senderAvatar,
      faculty: req.senderFaculty,
      program: req.senderProgram,
      year: req.senderYear,
      isVerifiedUWStudent: true
    };

    const liveCompat = calculateCompatibility(
      user?.personalityQuiz || DEFAULT_ALEX_QUIZ,
      partner.personalityQuiz,
      user,
      partner,
      eventSocialBattery[req.eventId] || req.socialBattery,
      req.eventId,
      req.eventTitle
    );

    const icebreakerPill = req.icebreakerPill || liveCompat.icebreakerPill;
    const icebreakerBanner = req.icebreakerBanner || liveCompat.icebreakerBanner;
    const icebreakerQuestion = req.icebreakerQuestion || liveCompat.icebreakerQuestion;

    const convId = getMatchConversationId(req.eventId, partner.id);
    const linkedEv = getEventById(req.eventId);

    if (linkedEv) {
      setAttendedEventSnapshots((prev) => ({ ...prev, [req.eventId]: linkedEv }));
    }
    if (!attendingEventIds.includes(req.eventId)) {
      latestRef.current.attendingEventIds = [...latestRef.current.attendingEventIds, req.eventId];
      setAttendingEventIds((prev) => (prev.includes(req.eventId) ? prev : [...prev, req.eventId]));
    }
    if (!attendeeVisibility[req.eventId]) {
      latestRef.current.attendeeVisibility = {
        ...latestRef.current.attendeeVisibility,
        [req.eventId]: true
      };
      setAttendeeVisibilityMap((prev) => ({ ...prev, [req.eventId]: true }));
      const startMs = linkedEv ? getEventStartUtcMs(linkedEv) : NaN;
      const beforeStart = Number.isFinite(startMs) ? effectiveNowMs < startMs : true;
      const optRec: BuddyOptInRecord = {
        optedInAtMs: effectiveNowMs,
        optedInBeforeStart: beforeStart,
        active: true
      };
      latestRef.current.buddyOptInHistory = {
        ...latestRef.current.buddyOptInHistory,
        [req.eventId]: optRec
      };
      setBuddyOptInHistory((prev) => ({ ...prev, [req.eventId]: optRec }));
    }

    updateChatStoreAndPersist((prev) => {
      if (isChatRemovedForPair(partner.id, req.eventId, prev.removedChats, prev.blockedUserIds)) {
        return prev;
      }
      const alreadyPairedForEvent = prev.conversations.some(
        (c) => c.id === convId || c.eventId === req.eventId
      );
      const replyGreeting = `Hey ${getFirstName(partner.name)}! Excited to check out ${req.eventTitle} together.`;
      const newConv: Conversation = {
        id: convId,
        eventId: req.eventId,
        eventTitle: req.eventTitle,
        eventDate: req.eventDate,
        eventLocation: linkedEv?.location || 'Campus Venue',
        partner,
        lastMessage: req.introMessage || replyGreeting,
        lastMessageTime: 'Just now',
        unreadCount: 0,
        pairingStatus: 'provisional',
        userConfirmed: false,
        partnerConfirmed: false,
        isReported: false,
        stayConnectedUser: false,
        stayConnectedPartner: false,
        isChatClosedPostEvent: false,
        icebreakerPill,
        icebreakerBanner,
        icebreakerQuestion,
        socialBattery: eventSocialBattery[req.eventId] || req.socialBattery
      };

      const msgs: ChatMessage[] = [
        {
          id: `m_sys_match_${convId}`,
          conversationId: convId,
          senderId: 'system',
          text: "You've been matched. Say hello. Nothing is final until you both confirm.",
          timestamp: 'Just now'
        },
        ...(req.introMessage
          ? [
              {
                id: `m_init_${Date.now() + 1}`,
                conversationId: convId,
                senderId: partner.id,
                text: req.introMessage,
                timestamp: 'Earlier'
              }
            ]
          : []),
        {
          id: `m_accept_${Date.now() + 2}`,
          conversationId: convId,
          senderId: user?.id || 'me',
          text: replyGreeting,
          timestamp: 'Just now'
        }
      ];

      return {
        ...prev,
        connectionRequests: prev.connectionRequests.map((r) =>
          r.id === requestId ? { ...r, status: 'accepted' } : r
        ),
        conversations: alreadyPairedForEvent
          ? prev.conversations
          : [newConv, ...prev.conversations],
        chatMessages: alreadyPairedForEvent
          ? prev.chatMessages
          : {
              ...prev.chatMessages,
              [convId]: msgs
            }
      };
    });
    setPairingEventHistory((prev) => ({ ...prev, [req.eventId]: true }));
  };

  const withdrawConnectionRequest = (requestId: string) => {
    updateChatStoreAndPersist((prev) => ({
      ...prev,
      connectionRequests: prev.connectionRequests.map((r) =>
        r.id === requestId ? { ...r, status: 'withdrawn' } : r
      )
    }));
  };

  const markConversationRead = React.useCallback(
    (conversationId: string) => {
      updateChatStoreAndPersist((prev) => {
        const target = prev.conversations.find((c) => c.id === conversationId);
        if (!target || !target.unreadCount || target.unreadCount <= 0) return prev;
        return {
          ...prev,
          conversations: prev.conversations.map((c) =>
            c.id === conversationId ? { ...c, unreadCount: 0 } : c
          )
        };
      });
    },
    [updateChatStoreAndPersist]
  );

  const removeConversations = (params: RemoveConversationsParams) => {
    const matchingConvs = latestRef.current.chatStore.conversations.filter(
      (c) =>
        c?.partner?.id === params.partnerId &&
        (params.reason !== 'left' || !params.eventId || c.eventId === params.eventId)
    );
    archiveConversationsList(
      matchingConvs,
      latestRef.current.chatStore.chatMessages,
      latestRef.current.effectiveNowMs
    );

    const affectedEventIds = new Set<string>();
    if (params.eventId) affectedEventIds.add(params.eventId);
    for (const c of matchingConvs) {
      affectedEventIds.add(c.eventId);
      if (partnerConfirmTimersRef.current[c.id]) {
        window.clearTimeout(partnerConfirmTimersRef.current[c.id]);
        delete partnerConfirmTimersRef.current[c.id];
      }
    }

    // Quietly cancel any active initial/replacement searches for affected events (no notifications)
    const eventIdsToCancel =
      params.reason === 'left'
        ? Array.from(affectedEventIds)
        : Array.from(
            new Set([
              ...Array.from(affectedEventIds),
              ...Object.keys(initialMatchTimersRef.current),
              ...Object.keys(replacementTimersRef.current)
            ])
          );

    for (const evId of eventIdsToCancel) {
      if (initialMatchTimersRef.current[evId]) {
        window.clearTimeout(initialMatchTimersRef.current[evId]);
        delete initialMatchTimersRef.current[evId];
      }
      if (replacementTimersRef.current[evId]) {
        window.clearTimeout(replacementTimersRef.current[evId]);
        delete replacementTimersRef.current[evId];
      }
    }
    if (eventIdsToCancel.length > 0) {
      setSearchingReplacementEventIds((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const evId of eventIdsToCancel) {
          if (next[evId]) {
            delete next[evId];
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }

    if (affectedEventIds.size > 0) {
      setEndedPairingsByEvent((prev) => {
        const next = { ...prev };
        let changed = false;
        for (const evId of affectedEventIds) {
          const list = next[evId] || [];
          if (!list.includes(params.partnerId)) {
            next[evId] = [...list, params.partnerId];
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }

    updateChatStoreAndPersist((prev) => applyRemoveConversations(prev, params));
  };

  const confirmPairing = (conversationId: string) => {
    const target = chatStore.conversations.find((c) => c.id === conversationId);
    if (!target) return;

    updateChatStoreAndPersist((prev) => ({
      ...prev,
      conversations: prev.conversations.map((c) =>
        c.id === conversationId ? { ...c, userConfirmed: true } : c
      )
    }));

    // If partner had already confirmed or once simulated partner confirmation arrives
    if (partnerConfirmTimersRef.current[conversationId]) {
      window.clearTimeout(partnerConfirmTimersRef.current[conversationId]);
    }

    const delayMs = target.partnerConfirmed ? 50 : BUDDY_POLICY.simulatedPartnerConfirmDelayMs;
    partnerConfirmTimersRef.current[conversationId] = window.setTimeout(() => {
      delete partnerConfirmTimersRef.current[conversationId];
      const latest = latestRef.current;
      const liveConv = latest.chatStore.conversations.find((c) => c.id === conversationId);
      if (!liveConv || !liveConv.userConfirmed) return;

      const confirmedAtIso = new Date(latest.effectiveNowMs).toISOString();
      const systemMsg: ChatMessage = {
        id: `m_confirmed_${Date.now()}`,
        conversationId,
        senderId: 'system',
        text: "You're both confirmed to attend together!",
        timestamp: 'Just now'
      };

      updateChatStoreAndPersist((prev) => {
        if (!prev.conversations.some((c) => c.id === conversationId)) return prev;
        return {
          ...prev,
          conversations: prev.conversations.map((c) =>
            c.id === conversationId
              ? {
                  ...c,
                  pairingStatus: 'confirmed',
                  userConfirmed: true,
                  partnerConfirmed: true,
                  confirmedAt: confirmedAtIso
                }
              : c
          ),
          chatMessages: {
            ...prev.chatMessages,
            [conversationId]: [
              ...(Array.isArray(prev.chatMessages[conversationId])
                ? prev.chatMessages[conversationId]
                : []),
              systemMsg
            ]
          }
        };
      });

      emitBuddyNotification({
        kind: 'mutual_confirmation',
        eventId: liveConv.eventId,
        eventTitle: liveConv.eventTitle,
        conversationId,
        partnerId: liveConv.partner?.id
      });
    }, delayMs);
  };

  const toggleStayConnected = (conversationId: string) => {
    updateChatStoreAndPersist((prev) => ({
      ...prev,
      conversations: prev.conversations.map((c) =>
        c.id === conversationId
          ? { ...c, stayConnectedUser: true }
          : c
      )
    }));
  };

  const simulatePartnerStayConnected = (conversationId: string) => {
    updateChatStoreAndPersist((prev) => ({
      ...prev,
      conversations: prev.conversations.map((c) =>
        c.id === conversationId
          ? { ...c, stayConnectedPartner: !c.stayConnectedPartner }
          : c
      )
    }));
  };

  const toggleChatPostEventClosed = (conversationId: string) => {
    updateChatStoreAndPersist((prev) => ({
      ...prev,
      conversations: prev.conversations.map((c) =>
        c.id === conversationId
          ? { ...c, isChatClosedPostEvent: !c.isChatClosedPostEvent }
          : c
      )
    }));
  };

  const sendMessage = (conversationId: string, text: string) => {
    const trimmed = typeof text === 'string' ? text.trim() : '';
    if (!user || !trimmed || !conversationId) return;

    const conv = conversations.find((c) => c && c.id === conversationId);
    const partnerId = conv?.partner?.id;
    if (
      !conv ||
      !partnerId ||
      isPartnerBlockedOrReported(partnerId, removedChats, blockedUserIds)
    ) {
      return;
    }

    const newMsg: ChatMessage = {
      id: `m_${Date.now()}`,
      conversationId,
      senderId: user.id,
      text: trimmed,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const rawPriorMsgs = chatMessages?.[conversationId];
    const priorMsgs = Array.isArray(rawPriorMsgs) ? rawPriorMsgs : [];
    const historyPayload = [...priorMsgs, newMsg]
      .filter((m) => m && typeof m.text === 'string' && m.senderId !== 'system')
      .slice(-16)
      .map((m) => ({
        role: m.senderId === user.id ? ('user' as const) : ('partner' as const),
        text: m.text
      }));

    updateChatStoreAndPersist((prev) => {
      if (!prev.conversations.some((c) => c.id === conversationId)) return prev;
      const existingMsgs = Array.isArray(prev.chatMessages?.[conversationId])
        ? prev.chatMessages[conversationId]
        : [];
      return {
        ...prev,
        chatMessages: {
          ...prev.chatMessages,
          [conversationId]: [...existingMsgs, newMsg]
        },
        conversations: prev.conversations.map((c) =>
          c.id === conversationId
            ? { ...c, lastMessage: trimmed, lastMessageTime: 'Just now' }
            : c
        )
      };
    });

    const seq = (chatReplySeqRef.current[conversationId] || 0) + 1;
    chatReplySeqRef.current[conversationId] = seq;

    setChatErrors((prev) => {
      if (!prev[conversationId]) return prev;
      const next = { ...prev };
      delete next[conversationId];
      return next;
    });
    setTypingConversationIds((prev) => ({ ...prev, [conversationId]: true }));

    const partnerProfile = SAMPLE_ATTENDEES[partnerId] || conv.partner;
    const isEnded = !upcomingEvents.some((e) => e.id === conv.eventId);

    void (async () => {
      try {
        const res = await fetch('/api/chat/reply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            latestMessage: trimmed,
            history: historyPayload,
            partner: {
              name: partnerProfile?.name || 'Waterloo Buddy',
              faculty: partnerProfile?.faculty,
              program: partnerProfile?.program,
              year: partnerProfile?.year,
              bio: partnerProfile?.bio,
              socialBattery:
                partnerProfile?.eventSocialBatteries?.[conv.eventId] ||
                partnerProfile?.defaultSocialBattery ||
                conv.socialBattery
            },
            user: {
              name: formatPublicName(user.name) || 'Alex',
              faculty: user.faculty,
              program: user.program,
              year: user.year
            },
            event: {
              title: conv.eventTitle || 'Campus Event',
              location: conv.eventLocation,
              date: conv.eventDate,
              isEnded
            }
          })
        });

        const data = (await res.json().catch(() => ({}))) as {
          success?: boolean;
          reply?: unknown;
          error?: unknown;
        };

        if (chatReplySeqRef.current[conversationId] !== seq) return;

        setTypingConversationIds((prev) => ({ ...prev, [conversationId]: false }));

        const replyText = typeof data.reply === 'string' ? data.reply.trim() : '';
        if (!res.ok || !data.success || !replyText) {
          const errMsg =
            typeof data.error === 'string' && data.error.trim()
              ? data.error
              : 'Could not get a reply right now. Please try again.';
          setChatErrors((prev) => ({
            ...prev,
            [conversationId]: errMsg
          }));
          return;
        }

        const replyMsg: ChatMessage = {
          id: `m_rep_${Date.now()}`,
          conversationId,
          senderId: partnerId,
          text: replyText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        updateChatStoreAndPersist((prev) => {
          if (!prev.conversations.some((c) => c.id === conversationId)) return prev;
          const existingMsgs = Array.isArray(prev.chatMessages?.[conversationId])
            ? prev.chatMessages[conversationId]
            : [];
          return {
            ...prev,
            chatMessages: {
              ...prev.chatMessages,
              [conversationId]: [...existingMsgs, replyMsg]
            },
            conversations: prev.conversations.map((c) =>
              c.id === conversationId
                ? { ...c, lastMessage: replyText, lastMessageTime: 'Just now' }
                : c
            )
          };
        });
      } catch {
        if (chatReplySeqRef.current[conversationId] !== seq) return;
        setTypingConversationIds((prev) => ({ ...prev, [conversationId]: false }));
        setChatErrors((prev) => ({
          ...prev,
          [conversationId]: 'Network error — could not get a reply. Please try again.'
        }));
      }
    })();
  };

  const blockUser = (userId: string) => {
    removeConversations({ partnerId: userId, reason: 'blocked' });
  };

  const unblockUser = (userId: string) => {
    updateChatStoreAndPersist((prev) => applyUnblockUser(prev, userId));
  };

  const reportItem = (
    targetType: 'user' | 'event',
    targetId: string,
    targetName: string,
    reason: string,
    description = ''
  ) => {
    const newReport: ReportSubmission = {
      id: `rep_${Date.now()}`,
      targetType,
      targetId,
      targetName,
      reason,
      description,
      status: 'pending',
      timestamp: new Date().toISOString()
    };

    setReportsList((prev) => [newReport, ...prev]);

    if (targetType === 'user') {
      setReportedUserIds((prev) => (prev.includes(targetId) ? prev : [...prev, targetId]));
      removeConversations({ partnerId: targetId, reason: 'reported' });
    } else {
      setReportedEventIds((prev) => (prev.includes(targetId) ? prev : [...prev, targetId]));
    }
  };

  const createEvent = (
    eventData: Omit<EventItem, 'id' | 'createdAt' | 'creatorId' | 'status'>,
    isDraft = false
  ): EventItem => {
    // Generate standardized UTC ISO string accounting for Waterloo timezone and DST
    const utcIso = toWaterlooUtcIso(eventData.date, eventData.startTime);

    const newEvent: EventItem = {
      ...eventData,
      id: `event_${Date.now()}`,
      creatorId: user?.id || 'demo_user',
      status: isDraft ? 'draft' : 'published',
      sourceVerification: eventData.sourceVerification || 'student_submitted',
      moderationStatus: 'approved',
      utcIsoString: utcIso,
      createdAt: new Date().toISOString()
    };

    setEvents((prev) => [newEvent, ...prev]);

    if (!isDraft) {
      setAttendingEventIds((prev) => [...prev, newEvent.id]);
    }

    // Run duplicate detection against newly created event
    const detected = detectDuplicateEvents([newEvent, ...events]);
    if (detected.length > 0) {
      setDuplicateResults((prev) => {
        const existingIds = new Set(prev.map((d) => d.id));
        const fresh = detected.filter((d) => !existingIds.has(d.id));
        return [...fresh, ...prev];
      });
    }

    return newEvent;
  };

  const updateEvent = (eventId: string, updatedData: Partial<EventItem>) => {
    setEvents((prev) =>
      prev.map((ev) => {
        if (ev.id === eventId) {
          const updatedDate = updatedData.date || ev.date;
          const updatedTime = updatedData.startTime || ev.startTime;
          return {
            ...ev,
            ...updatedData,
            utcIsoString: toWaterlooUtcIso(updatedDate, updatedTime)
          };
        }
        return ev;
      })
    );
  };

  const cancelEvent = (eventId: string) => {
    setEvents((prev) =>
      prev.map((ev) => (ev.id === eventId ? { ...ev, status: 'cancelled' } : ev))
    );
  };

  // Technical & Operational Methods (Requirement 8)
  const runScheduledRefresh = () => {
    const result = runTwoHourRefreshCycle(aggregationSources);
    setAggregationSources(result.updatedSources);
    setSyncReports((prev) => [result.syncReport, ...prev.slice(0, 9)]);

    // Check duplicate candidates
    const detected = detectDuplicateEvents(events);
    if (detected.length > 0) {
      setDuplicateResults((prev) => {
        const existingIds = new Set(prev.map((d) => d.id));
        const fresh = detected.filter((d) => !existingIds.has(d.id));
        return [...fresh, ...prev];
      });
    }

    setAuditLogs((prev) => [
      {
        id: `log_${Date.now()}`,
        action: 'Scheduled 2-Hour Refresh Executed',
        target: `${result.updatedSources.length} Feeds Synced`,
        performedBy: 'Automated Refresh Engine',
        timestamp: 'Just now',
        details: `Processed ${result.newEventsFound} incoming records. Duration: ${result.syncReport.durationMs}ms.`
      },
      ...prev
    ]);

    return {
      success: true,
      message: `Synchronized ${result.updatedSources.length} campus feeds. ${result.newEventsFound} listings ingested.`,
      report: result.syncReport
    };
  };

  const resolveDuplicate = (duplicateId: string, action: 'merge' | 'dismiss') => {
    setDuplicateResults((prev) =>
      prev.map((dup) => {
        if (dup.id === duplicateId) {
          return {
            ...dup,
            status: action === 'merge' ? 'merged' : 'rejected_as_duplicate'
          };
        }
        return dup;
      })
    );

    const targetDup = duplicateResults.find((d) => d.id === duplicateId);
    setAuditLogs((prev) => [
      {
        id: `log_${Date.now()}`,
        action: action === 'merge' ? 'Duplicate Merged with Primary' : 'Duplicate Flag Dismissed',
        target: targetDup?.duplicateCandidate.title || 'Duplicate Entry',
        performedBy: user?.name || 'Administrator',
        timestamp: 'Just now',
        details: `Resolution action: ${action}. Primary listing retained.`
      },
      ...prev
    ]);
  };

  const moderateEvent = (eventId: string, newStatus: 'approved' | 'rejected' | 'flagged') => {
    setEvents((prev) =>
      prev.map((ev) => {
        if (ev.id === eventId) {
          return {
            ...ev,
            moderationStatus: newStatus,
            status: newStatus === 'rejected' ? 'cancelled' : ev.status
          };
        }
        return ev;
      })
    );

    const ev = events.find((e) => e.id === eventId);
    setAuditLogs((prev) => [
      {
        id: `log_${Date.now()}`,
        action: `Event Moderation: ${newStatus.toUpperCase()}`,
        target: ev?.title || eventId,
        performedBy: user?.name || 'Moderator',
        timestamp: 'Just now',
        details: `Status set to ${newStatus}.`
      },
      ...prev
    ]);
  };

  const resolveReport = (
    reportId: string,
    action: 'resolved_warning' | 'resolved_removed' | 'dismissed',
    notes?: string
  ) => {
    setReportsList((prev) =>
      prev.map((rep) => {
        if (rep.id === reportId) {
          return {
            ...rep,
            status: action,
            moderatorNotes: notes || (action === 'dismissed' ? 'Report reviewed and found compliant.' : 'Action enforced per community guidelines.')
          };
        }
        return rep;
      })
    );

    const targetRep = reportsList.find((r) => r.id === reportId);
    if (targetRep) {
      if (action === 'resolved_removed' && targetRep.targetType === 'event') {
        cancelEvent(targetRep.targetId);
      }
      setAuditLogs((prev) => [
        {
          id: `log_${Date.now()}`,
          action: `Report Resolved: ${action}`,
          target: targetRep.targetName,
          performedBy: user?.name || 'Moderation Admin',
          timestamp: 'Just now',
          details: notes || `Report status transitioned to ${action}`
        },
        ...prev
      ]);
    }
  };

  const addCustomDiscount = (discountData: Omit<StudentDiscount, 'id' | 'verifiedAt'>) => {
    const newDiscount: StudentDiscount = {
      ...discountData,
      id: `disc_${Date.now()}`,
      verifiedAt: 'Verified by WatHive Admin'
    };
    setStudentDiscounts((prev) => [newDiscount, ...prev]);

    setAuditLogs((prev) => [
      {
        id: `log_${Date.now()}`,
        action: 'New Student Discount Added',
        target: newDiscount.businessName,
        performedBy: user?.name || 'Admin',
        timestamp: 'Just now',
        details: `Added ${newDiscount.discountValue} with proof requirement: ${newDiscount.verificationProof}`
      },
      ...prev
    ]);
  };

  const resetDemoData = () => {
    Object.values(initialMatchTimersRef.current).forEach((t) => window.clearTimeout(t));
    initialMatchTimersRef.current = {};
    Object.values(replacementTimersRef.current).forEach((t) => window.clearTimeout(t));
    replacementTimersRef.current = {};
    Object.values(partnerConfirmTimersRef.current).forEach((t) => window.clearTimeout(t));
    partnerConfirmTimersRef.current = {};
    writeDemoClockMs(null);
    setDemoClockMs(null);

    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(SAVED_FILTERS_STORAGE_KEY);
      [
        'wathive_app_state_v7',
        'wathive_app_state_v8',
        'wathive_app_state_v9',
        'wathive_app_state_v10',
        'wathive_app_state_v11',
        'wathive_app_state_v12',
        'wathive_app_state_v13',
        'wathive_app_state_v14',
        'wathive_app_state_v15',
        'wathive_app_state_v16'
      ].forEach((k) => localStorage.removeItem(k));
    } catch {
      // ignore storage errors
    }
    setUser(INITIAL_USER);
    setIsLoggedIn(true);
    setOnboardingStep(null);
    setEvents([]);
    void syncFromCollector(true);
    setSavedEventIds(INITIAL_USER_SAVED);
    setAttendingEventIds(INITIAL_USER_ATTENDING);
    setAttendeeVisibilityMap(INITIAL_USER_VISIBILITY);
    setEventBuddySettings({});
    setEventSocialBatteryMap({});
    setSavedFilters([]);
    setEventAttendeesMap(INITIAL_EVENT_ATTENDEES);
    setChatStore(
      sanitizeChatSnapshot({
        conversations: INITIAL_CONVERSATIONS,
        chatMessages: INITIAL_CHAT_MESSAGES,
        connectionRequests: INITIAL_REQUESTS,
        removedChats: [],
        blockedUserIds: []
      })
    );
    setReportedUserIds([]);
    setReportedEventIds([]);
    setReportsList([]);
    setDeclinedHistory([]);
    setDailyBuddyRequestsCount(0);
    setNotificationSettings(DEFAULT_NOTIFICATION_SETTINGS);
    setNotifications(INITIAL_NOTIFICATIONS);
    setUsedNotificationDedupeKeys([]);
    setPushDailyCounter(null);
    setBrowserAlertsEnabled(false);
    setAttendedEventSnapshots({});
    setBuddyOptInHistory({});
    setPairingEventHistory({});
    setEndedPairingsByEvent({});
    setArchivedConversations([]);
    setPartnerSimulationLog([]);
    setSearchingReplacementEventIds({});
    setEventSurveys({});
    setSurveyDismissedEventIds([]);
    setAggregationSources(INITIAL_AGGREGATION_SOURCES);
    setDuplicateResults(INITIAL_DUPLICATES);
    setSyncReports([INITIAL_SYNC_REPORT]);
    setStudentDiscounts(INITIAL_STUDENT_DISCOUNTS);
    setAuditLogs(INITIAL_AUDIT_LOGS);
  };

  const updateNotificationSettings = (settings: NotificationSettings) => {
    setNotificationSettings(settings);
    if (user) {
      setUser((prev) => (prev ? { ...prev, notificationSettings: settings } : null));
    }
  };

  const markNotificationAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllNotificationsAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const deleteNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const simulateTestNotification = (customType?: NotificationItemType) => {
    const categoriesPool = notificationSettings.interestedCategories.length > 0
      ? notificationSettings.interestedCategories
      : (['Sports and fitness', 'Food and student deals', 'University clubs', 'Networking and professional development'] as NotificationInterestCategory[]);
    const pickedCategory = categoriesPool[Math.floor(Math.random() * categoriesPool.length)];

    const samples: Record<NotificationItemType, Omit<InAppNotification, 'id' | 'timestamp' | 'read'>> = {
      new_event: {
        type: 'new_event',
        title: `New in ${pickedCategory}`,
        message: `A new campus gathering matching your interests was just announced at SLC.`,
        category: pickedCategory,
        actionLabel: 'View Event'
      },
      upcoming_reminder: {
        type: 'upcoming_reminder',
        title: 'Upcoming Event in 2 Hours',
        message: 'Reminder: An event on your campus schedule begins shortly. Check venue room details.',
        category: pickedCategory,
        actionLabel: 'View Schedule',
        urgent: true
      },
      buddy_match: {
        type: 'buddy_match',
        title: 'New Buddy Match Found',
        message: 'A verified Waterloo student with 92% social compatibility is attending the same event!',
        actionLabel: 'View Suggested Buddy',
        urgent: true
      },
      registration_deadline: {
        type: 'registration_deadline',
        title: 'Registration Deadline Today',
        message: `External registration closes tonight at 23:59. Remember to secure your organizer ticket.`,
        category: pickedCategory,
        actionLabel: 'Open Portal',
        urgent: true
      },
      schedule_change: {
        type: 'schedule_change',
        title: 'Campus Schedule Notice',
        message: 'Organizer updated arrival instructions for an upcoming event in your schedule.',
        category: pickedCategory,
        actionLabel: 'See Details'
      },
      student_discount: {
        type: 'student_discount',
        title: 'New Student Deal Available',
        message: 'Waterloo Student Deal: Show your WatCard for $2 off campus cafe orders this afternoon.',
        category: 'Food and student deals',
        discountDeal: '$2 Off with WatCard'
      }
    };

    const typeToUse = customType || (Object.keys(samples)[Math.floor(Math.random() * Object.keys(samples).length)] as NotificationItemType);
    const template = samples[typeToUse];

    const newNotif: InAppNotification = {
      id: `notif_${Date.now()}`,
      timestamp: 'Just now',
      read: false,
      ...template
    };

    setNotifications((prev) => [newNotif, ...prev]);
  };

  const toggleBrowserAlerts = async (
    enabled: boolean
  ): Promise<{ permission: NotificationPermission | 'unsupported' }> => {
    if (!enabled) {
      setBrowserAlertsEnabled(false);
      return { permission: getBrowserNotificationPermission() };
    }
    const perm = await requestBrowserNotificationPermission();
    setBrowserAlertPermission(perm);
    if (perm === 'granted') {
      setBrowserAlertsEnabled(true);
    } else {
      setBrowserAlertsEnabled(false);
    }
    return { permission: perm };
  };

  const submitPostEventSurvey = (submission: BuddySurveySubmission) => {
    setEventSurveys((prev) => ({
      ...prev,
      [submission.eventId]: submission
    }));
  };

  const dismissSurveyOffer = (eventId: string) => {
    setSurveyDismissedEventIds((prev) =>
      prev.includes(eventId) ? prev : [...prev, eventId]
    );
  };

  const createProvisionalMatchForEvent = React.useCallback(
    (
      ev: EventItem,
      kind: 'provisional_match' | 'replacement_found',
      excludePartnerIds: string[] = []
    ): Conversation | null => {
      const latest = latestRef.current;
      const seededSeekers = getSeedBuddySeekers(ev.id, {
        pool: Object.values(SAMPLE_ATTENDEES),
        isPast: isEventPast(ev, new Date(latest.effectiveNowMs)),
        isResearchStudy: ev.isResearchStudy,
        status: ev.status,
        signedInUserId: latest.user?.id,
        blockedUserIds: latest.chatStore.blockedUserIds,
        reportedUserIds: latest.reportedUserIds,
        removedChats: latest.chatStore.removedChats,
        activePairingPartnerIds: latest.chatStore.conversations
          .filter((c) => c.eventId === ev.id && Boolean(c.partner?.id))
          .map((c) => c.partner.id),
        endedPartnerIds: [
          ...(latest.endedPairingsByEvent[ev.id] || []),
          ...excludePartnerIds
        ]
      });

      const candidate = findReplacementCandidate({
        eventId: ev.id,
        eventTitle: ev.title,
        attendeeIds: seededSeekers.map((s) => s.id),
        attendeesById: SAMPLE_ATTENDEES,
        user: latest.user,
        conversations: latest.chatStore.conversations,
        removedChats: latest.chatStore.removedChats,
        blockedUserIds: latest.chatStore.blockedUserIds,
        reportedUserIds: latest.reportedUserIds,
        excludePartnerIds: [
          ...(latest.endedPairingsByEvent[ev.id] || []),
          ...excludePartnerIds
        ],
        userEventBattery: latest.eventSocialBattery[ev.id]
      });

      if (!candidate) return null;

      const { attendee, compatibility } = candidate;
      const convId = getMatchConversationId(ev.id, attendee.id);
      const userFirst = latest.user ? getFirstName(latest.user.name) : 'there';
      const greeting = `Hey ${userFirst}! Looks like we matched for ${ev.title}. Want to head over together?`;

      const newConv: Conversation = {
        id: convId,
        eventId: ev.id,
        eventTitle: ev.title,
        eventDate: ev.date,
        eventLocation: ev.location,
        partner: attendee,
        lastMessage: greeting,
        lastMessageTime: 'Just now',
        unreadCount: 1,
        pairingStatus: 'provisional',
        userConfirmed: false,
        partnerConfirmed: false,
        isReported: false,
        stayConnectedUser: false,
        stayConnectedPartner: false,
        isChatClosedPostEvent: false,
        icebreakerPill: compatibility.icebreakerPill,
        icebreakerBanner: compatibility.icebreakerBanner,
        icebreakerQuestion: compatibility.icebreakerQuestion,
        socialBattery: latest.eventSocialBattery[ev.id] || attendee.defaultSocialBattery
      };

      const sysMsg: ChatMessage = {
        id: `m_sys_match_${convId}`,
        conversationId: convId,
        senderId: 'system',
        text: "You've been matched. Say hello. Nothing is final until you both confirm.",
        timestamp: 'Just now'
      };

      const introMsg: ChatMessage = {
        id: `m_match_${Date.now()}`,
        conversationId: convId,
        senderId: attendee.id,
        text: greeting,
        timestamp: 'Just now'
      };

      const alreadyExistsInLatest = latest.chatStore.conversations.some(
        (c) => c.id === convId || c.eventId === ev.id
      );
      if (alreadyExistsInLatest) return null;

      // Update chatStore ref synchronously before emitting notification so checks & retries stay atomic
      latestRef.current.chatStore = {
        ...latest.chatStore,
        conversations: [newConv, ...latest.chatStore.conversations],
        chatMessages: {
          ...latest.chatStore.chatMessages,
          [convId]: [sysMsg, introMsg]
        }
      };

      updateChatStoreAndPersist((prev) => {
        const alreadyExists = prev.conversations.some(
          (c) => c.id === convId || c.eventId === ev.id
        );
        if (alreadyExists) return prev;
        return {
          ...prev,
          conversations: [newConv, ...prev.conversations],
          chatMessages: {
            ...prev.chatMessages,
            [convId]: [sysMsg, introMsg]
          }
        };
      });

      setPairingEventHistory((prev) => ({ ...prev, [ev.id]: true }));
      latestRef.current.attendedEventSnapshots = {
        ...latestRef.current.attendedEventSnapshots,
        [ev.id]: ev
      };
      setAttendedEventSnapshots((prev) => ({ ...prev, [ev.id]: ev }));
      setSearchingReplacementEventIds((prev) => {
        if (!prev[ev.id]) return prev;
        const next = { ...prev };
        delete next[ev.id];
        return next;
      });

      emitBuddyNotification({
        kind,
        eventId: ev.id,
        eventTitle: ev.title,
        conversationId: convId,
        partnerId: attendee.id
      });

      return newConv;
    },
    [emitBuddyNotification, updateChatStoreAndPersist]
  );

  const scheduleReplacementSearch = React.useCallback(
    (eventId: string, _eventTitle: string) => {
      if (replacementTimersRef.current[eventId]) {
        window.clearTimeout(replacementTimersRef.current[eventId]);
      }

      setSearchingReplacementEventIds((prev) => ({ ...prev, [eventId]: true }));

      replacementTimersRef.current[eventId] = window.setTimeout(() => {
        delete replacementTimersRef.current[eventId];
        setSearchingReplacementEventIds((prev) => {
          if (!prev[eventId]) return prev;
          const next = { ...prev };
          delete next[eventId];
          return next;
        });

        const latest = latestRef.current;
        if (!latest.user || !latest.user.isVerifiedUWStudent) return;
        if (!latest.attendingEventIds.includes(eventId)) return;
        if (!latest.attendeeVisibility[eventId]) return;
        if (latest.chatStore.conversations.some((c) => c.eventId === eventId)) return;

        const ev =
          latest.events.find((e) => e.id === eventId) ||
          latest.attendedEventSnapshots[eventId];
        if (!ev || ev.isResearchStudy || ev.status === 'cancelled') return;
        if (isEventPast(ev, new Date(latest.effectiveNowMs))) return;

        const excluded = latest.endedPairingsByEvent[eventId] || [];
        createProvisionalMatchForEvent(ev, 'replacement_found', excluded);
      }, BUDDY_POLICY.replacementSearchDelayMs);
    },
    [createProvisionalMatchForEvent]
  );

  const demoGetMatched = (): { ok: boolean; message: string } => {
    const candidates = upcomingEvents.filter(
      (e) => !e.isResearchStudy && e.status === 'published'
    );
    if (candidates.length === 0) {
      return { ok: false, message: 'No upcoming events available.' };
    }

    const activeEventIds = new Set(chatStore.conversations.map((c) => c.eventId));
    const targetEvent =
      candidates.find(
        (e) => attendingEventIds.includes(e.id) && attendeeVisibility[e.id] && !activeEventIds.has(e.id)
      ) ||
      candidates.find((e) => attendingEventIds.includes(e.id) && !activeEventIds.has(e.id)) ||
      candidates.find((e) => !activeEventIds.has(e.id)) ||
      candidates[0];

    // Ensure attending + buddy matching opted-in synchronously in ref + state
    if (!attendingEventIds.includes(targetEvent.id)) {
      latestRef.current.attendingEventIds = [...latestRef.current.attendingEventIds, targetEvent.id];
      setAttendingEventIds((prev) =>
        prev.includes(targetEvent.id) ? prev : [...prev, targetEvent.id]
      );
    }
    if (!attendeeVisibility[targetEvent.id]) {
      latestRef.current.attendeeVisibility = {
        ...latestRef.current.attendeeVisibility,
        [targetEvent.id]: true
      };
      setAttendeeVisibilityMap((prev) => ({ ...prev, [targetEvent.id]: true }));
      const startMs = getEventStartUtcMs(targetEvent);
      const beforeStart = Number.isFinite(startMs) ? effectiveNowMs < startMs : true;
      const optRec: BuddyOptInRecord = {
        optedInAtMs: effectiveNowMs,
        optedInBeforeStart: beforeStart,
        active: true
      };
      latestRef.current.buddyOptInHistory = {
        ...latestRef.current.buddyOptInHistory,
        [targetEvent.id]: optRec
      };
      setBuddyOptInHistory((prev) => ({ ...prev, [targetEvent.id]: optRec }));
    }

    const excluded = endedPairingsByEvent[targetEvent.id] || [];
    const created = createProvisionalMatchForEvent(targetEvent, 'provisional_match', excluded);
    if (!created) {
      return { ok: false, message: 'No eligible buddies available right now.' };
    }
    return { ok: true, message: `Matched for ${targetEvent.title}` };
  };

  const simulatePartnerTermination = (
    kind: 'pairing_ended' | 'buddy_cancelled'
  ): { ok: boolean; message: string } => {
    const targetConv =
      chatStore.conversations.find((c) =>
        upcomingEvents.some((e) => e.id === c.eventId)
      ) || chatStore.conversations[0];

    if (!targetConv) {
      return { ok: false, message: 'No active buddy chat yet.' };
    }

    if (partnerConfirmTimersRef.current[targetConv.id]) {
      window.clearTimeout(partnerConfirmTimersRef.current[targetConv.id]);
      delete partnerConfirmTimersRef.current[targetConv.id];
    }

    const prevExcluded = latestRef.current.endedPairingsByEvent[targetConv.eventId] || [];
    const targetPartnerId = targetConv.partner?.id;
    const nextExcluded =
      targetPartnerId && !prevExcluded.includes(targetPartnerId)
        ? [...prevExcluded, targetPartnerId]
        : prevExcluded;
    latestRef.current.endedPairingsByEvent = {
      ...latestRef.current.endedPairingsByEvent,
      [targetConv.eventId]: nextExcluded
    };
    setEndedPairingsByEvent((prev) => ({
      ...prev,
      [targetConv.eventId]: nextExcluded
    }));

    // Ensure student remains attending & opted-in so replacement search proceeds cleanly
    if (!attendingEventIds.includes(targetConv.eventId)) {
      latestRef.current.attendingEventIds = [
        ...latestRef.current.attendingEventIds,
        targetConv.eventId
      ];
      setAttendingEventIds((prev) =>
        prev.includes(targetConv.eventId) ? prev : [...prev, targetConv.eventId]
      );
    }
    if (!attendeeVisibility[targetConv.eventId]) {
      latestRef.current.attendeeVisibility = {
        ...latestRef.current.attendeeVisibility,
        [targetConv.eventId]: true
      };
      setAttendeeVisibilityMap((prev) => ({ ...prev, [targetConv.eventId]: true }));
    }

    archiveConversationsList(
      [targetConv],
      latestRef.current.chatStore.chatMessages,
      latestRef.current.effectiveNowMs
    );

    updateChatStoreAndPersist((prev) => {
      const nextMsgs: Record<string, ChatMessage[]> = {};
      for (const [cid, msgs] of Object.entries(prev.chatMessages)) {
        if (cid !== targetConv.id) nextMsgs[cid] = msgs;
      }
      return {
        ...prev,
        conversations: prev.conversations.filter((c) => c.id !== targetConv.id),
        chatMessages: nextMsgs,
        connectionRequests: prev.connectionRequests.map((r) =>
          r.eventId === targetConv.eventId &&
          (r.senderId === targetConv.partner.id || r.recipientId === targetConv.partner.id) &&
          r.status === 'pending'
            ? { ...r, status: 'withdrawn' as const }
            : r
        )
      };
    });

    // Update chatStore ref synchronously so emitBuddyNotification and replacement see removed chat
    latestRef.current.chatStore = {
      ...latestRef.current.chatStore,
      conversations: latestRef.current.chatStore.conversations.filter(
        (c) => c.id !== targetConv.id
      )
    };

    emitBuddyNotification({
      kind,
      eventId: targetConv.eventId,
      eventTitle: targetConv.eventTitle,
      dedupeSubjectId: targetConv.id
    });

    scheduleReplacementSearch(targetConv.eventId, targetConv.eventTitle);

    return {
      ok: true,
      message:
        kind === 'pairing_ended'
          ? 'Pairing ended. Looking for a replacement (5s)...'
          : 'Buddy cancelled. Looking for a replacement (5s)...'
    };
  };

  const executeManageOutcome = (
    conversationId: string,
    action: 'find_another' | 'no_longer_need' | 'unable_to_attend'
  ): { ok: boolean; message: string } => {
    const targetConv = latestRef.current.chatStore.conversations.find(
      (c) => c.id === conversationId
    );
    if (!targetConv) {
      return { ok: false, message: 'Conversation not found.' };
    }

    const plan = getManageBuddyOutcomePlan(action);
    const nowAtAction = latestRef.current.effectiveNowMs;

    if (partnerConfirmTimersRef.current[targetConv.id]) {
      window.clearTimeout(partnerConfirmTimersRef.current[targetConv.id]);
      delete partnerConfirmTimersRef.current[targetConv.id];
    }
    if (initialMatchTimersRef.current[targetConv.eventId]) {
      window.clearTimeout(initialMatchTimersRef.current[targetConv.eventId]);
      delete initialMatchTimersRef.current[targetConv.eventId];
    }
    if (replacementTimersRef.current[targetConv.eventId]) {
      window.clearTimeout(replacementTimersRef.current[targetConv.eventId]);
      delete replacementTimersRef.current[targetConv.eventId];
    }

    archiveConversationsList(
      [targetConv],
      latestRef.current.chatStore.chatMessages,
      nowAtAction
    );

    const prevExcluded = latestRef.current.endedPairingsByEvent[targetConv.eventId] || [];
    const targetPartnerId = targetConv.partner?.id;
    const nextExcluded =
      targetPartnerId && !prevExcluded.includes(targetPartnerId)
        ? [...prevExcluded, targetPartnerId]
        : prevExcluded;
    latestRef.current.endedPairingsByEvent = {
      ...latestRef.current.endedPairingsByEvent,
      [targetConv.eventId]: nextExcluded
    };
    setEndedPairingsByEvent((prev) => ({
      ...prev,
      [targetConv.eventId]: nextExcluded
    }));

    // Update chatStore ref synchronously so replacement checks see removed conversation
    const nextConvsSync = latestRef.current.chatStore.conversations.filter(
      (c) => c.id !== targetConv.id
    );
    const nextMsgsSync: Record<string, ChatMessage[]> = {};
    for (const [cid, msgs] of Object.entries(latestRef.current.chatStore.chatMessages)) {
      if (cid !== targetConv.id) nextMsgsSync[cid] = msgs;
    }
    latestRef.current.chatStore = {
      ...latestRef.current.chatStore,
      conversations: nextConvsSync,
      chatMessages: nextMsgsSync
    };

    updateChatStoreAndPersist((prev) => {
      const nextMsgs: Record<string, ChatMessage[]> = {};
      for (const [cid, msgs] of Object.entries(prev.chatMessages)) {
        if (cid !== targetConv.id) nextMsgs[cid] = msgs;
      }
      return {
        ...prev,
        conversations: prev.conversations.filter((c) => c.id !== targetConv.id),
        chatMessages: nextMsgs,
        connectionRequests: prev.connectionRequests.map((r) =>
          r.eventId === targetConv.eventId &&
          (r.senderId === targetConv.partner.id || r.recipientId === targetConv.partner.id) &&
          r.status === 'pending'
            ? { ...r, status: 'withdrawn' as const }
            : r
        )
      };
    });

    if (plan.keepRsvp) {
      if (!latestRef.current.attendingEventIds.includes(targetConv.eventId)) {
        latestRef.current.attendingEventIds = [
          ...latestRef.current.attendingEventIds,
          targetConv.eventId
        ];
        setAttendingEventIds((prev) =>
          prev.includes(targetConv.eventId) ? prev : [...prev, targetConv.eventId]
        );
      }
    } else {
      latestRef.current.attendingEventIds = latestRef.current.attendingEventIds.filter(
        (id) => id !== targetConv.eventId
      );
      setAttendingEventIds((prev) => prev.filter((id) => id !== targetConv.eventId));
    }

    if (plan.keepBuddyMatchingActive) {
      latestRef.current.attendeeVisibility = {
        ...latestRef.current.attendeeVisibility,
        [targetConv.eventId]: true
      };
      setAttendeeVisibilityMap((prev) => ({ ...prev, [targetConv.eventId]: true }));
    } else {
      const nextVis = { ...latestRef.current.attendeeVisibility };
      delete nextVis[targetConv.eventId];
      latestRef.current.attendeeVisibility = nextVis;
      setAttendeeVisibilityMap((prev) => {
        const next = { ...prev };
        delete next[targetConv.eventId];
        return next;
      });
      if (latestRef.current.buddyOptInHistory[targetConv.eventId]) {
        latestRef.current.buddyOptInHistory = {
          ...latestRef.current.buddyOptInHistory,
          [targetConv.eventId]: {
            ...latestRef.current.buddyOptInHistory[targetConv.eventId],
            active: false
          }
        };
      }
      setBuddyOptInHistory((prev) =>
        prev[targetConv.eventId]
          ? { ...prev, [targetConv.eventId]: { ...prev[targetConv.eventId], active: false } }
          : prev
      );
      setSearchingReplacementEventIds((prev) => {
        if (!prev[targetConv.eventId]) return prev;
        const next = { ...prev };
        delete next[targetConv.eventId];
        return next;
      });
    }

    // Record simulated partner-side notice (never pushed into acting student's notifications bell)
    const partnerNotice: PartnerSimulationNotice = {
      id: `sim_partner_${Date.now()}`,
      kind: plan.partnerNoticeKind,
      eventId: targetConv.eventId,
      eventTitle: targetConv.eventTitle,
      replacementSearchStarted: plan.triggerPartnerReplacementSearch,
      createdAtMs: nowAtAction
    };
    setPartnerSimulationLog((prev) => [partnerNotice, ...prev].slice(0, 20));

    if (plan.triggerUserReplacementSearch) {
      scheduleReplacementSearch(targetConv.eventId, targetConv.eventTitle);
    }

    return { ok: true, message: plan.userToast };
  };

  const rematchBuddyForEvent = (conversationId: string) =>
    executeManageOutcome(conversationId, 'find_another');

  const leaveBuddyMatchingFromChat = (conversationId: string) =>
    executeManageOutcome(conversationId, 'no_longer_need');

  const cancelRsvpFromChat = (conversationId: string) =>
    executeManageOutcome(conversationId, 'unable_to_attend');

  const demoSimulatePairingEnded = () => simulatePartnerTermination('pairing_ended');
  const demoSimulateBuddyCancelled = () => simulatePartnerTermination('buddy_cancelled');

  const demoAdvanceWithin24Hours = (): { ok: boolean; message: string } => {
    const allKnown = [
      ...events,
      ...Object.values(attendedEventSnapshots).filter(
        (snap) => !events.some((e) => e.id === snap.id)
      )
    ];
    const confirmedConvEventIds = new Set(
      chatStore.conversations
        .filter((c) => c.pairingStatus === 'confirmed' || (c.userConfirmed && c.partnerConfirmed))
        .map((c) => c.eventId)
    );
    const activeConvEventIds = new Set(chatStore.conversations.map((c) => c.eventId));

    const targetEvent =
      allKnown.find(
        (e) => confirmedConvEventIds.has(e.id) && !isEventPast(e, new Date(effectiveNowMs))
      ) ||
      allKnown.find(
        (e) => activeConvEventIds.has(e.id) && !isEventPast(e, new Date(effectiveNowMs))
      ) ||
      allKnown.find(
        (e) => attendingEventIds.includes(e.id) && !isEventPast(e, new Date(effectiveNowMs))
      ) ||
      upcomingEvents[0];

    if (!targetEvent) {
      return { ok: false, message: 'No upcoming event found.' };
    }

    const startMs = getEventStartUtcMs(targetEvent);
    if (!Number.isFinite(startMs)) {
      return { ok: false, message: 'Invalid event start time.' };
    }

    setAttendedEventSnapshots((prev) => ({ ...prev, [targetEvent.id]: targetEvent }));
    const nextClock = startMs - 2 * 60 * 60 * 1000;
    writeDemoClockMs(nextClock);
    setDemoClockMs(nextClock);
    setTorontoNow(getTorontoNow(new Date(nextClock)));
    return { ok: true, message: `Clock moved to 2h before ${targetEvent.title}` };
  };

  const demoAdvanceToEventStart = (): { ok: boolean; message: string } => {
    const candidateIds = Array.from(
      new Set([
        ...attendingEventIds,
        ...chatStore.conversations.map((c) => c.eventId),
        ...savedEventIds
      ])
    );
    const allKnown = [
      ...events,
      ...Object.values(attendedEventSnapshots).filter(
        (snap) => !events.some((e) => e.id === snap.id)
      )
    ];

    const targetEvent =
      allKnown.find(
        (e) =>
          candidateIds.includes(e.id) &&
          !isEventPast(e, new Date(effectiveNowMs)) &&
          !chatStore.conversations.some((c) => c.eventId === e.id)
      ) ||
      allKnown.find(
        (e) => candidateIds.includes(e.id) && !isEventPast(e, new Date(effectiveNowMs))
      ) ||
      upcomingEvents[0];

    if (!targetEvent) {
      return { ok: false, message: 'No upcoming student event found.' };
    }

    const startMs = getEventStartUtcMs(targetEvent);
    if (!Number.isFinite(startMs)) {
      return { ok: false, message: 'Invalid event start time.' };
    }

    setAttendedEventSnapshots((prev) => ({ ...prev, [targetEvent.id]: targetEvent }));
    const nextClock = startMs + 60_000;
    writeDemoClockMs(nextClock);
    setDemoClockMs(nextClock);
    setTorontoNow(getTorontoNow(new Date(nextClock)));
    return { ok: true, message: `Clock moved to start of ${targetEvent.title}` };
  };

  const demoAdvanceToEventEnd = (): { ok: boolean; message: string } => {
    const candidateIds = Array.from(
      new Set([
        ...chatStore.conversations.map((c) => c.eventId),
        ...attendingEventIds,
        ...savedEventIds
      ])
    );
    const allKnown = [
      ...events,
      ...Object.values(attendedEventSnapshots).filter(
        (snap) => !events.some((e) => e.id === snap.id)
      )
    ];

    const targetEvent =
      allKnown.find(
        (e) => candidateIds.includes(e.id) && !isEventPast(e, new Date(effectiveNowMs))
      ) ||
      upcomingEvents[0] ||
      allKnown.find((e) => candidateIds.includes(e.id));

    if (!targetEvent) {
      return { ok: false, message: 'No student event found.' };
    }

    const endMs = getEventEndUtcMs(targetEvent);
    if (!Number.isFinite(endMs)) {
      return { ok: false, message: 'Invalid event end time.' };
    }

    setAttendedEventSnapshots((prev) => ({ ...prev, [targetEvent.id]: targetEvent }));
    const nextClock = endMs + 60_000;
    writeDemoClockMs(nextClock);
    setDemoClockMs(nextClock);
    setTorontoNow(getTorontoNow(new Date(nextClock)));
    return { ok: true, message: `Clock moved to end of ${targetEvent.title}` };
  };

  const demoResetClock = () => {
    writeDemoClockMs(null);
    setDemoClockMs(null);
    const realNow = Date.now();
    setNowMs(realNow);
    setTorontoNow(getTorontoNow(new Date(realNow)));
  };

  const visibleNotifications = React.useMemo(
    () => notifications.filter((n) => isNotificationVisibleForSettings(n, notificationSettings)),
    [notifications, notificationSettings]
  );

  const unreadNotificationsCount = visibleNotifications.filter((n) => !n.read).length;

  return (
    <AppContext.Provider
      value={{
        user,
        isLoggedIn,
        onboardingStep,
        events: upcomingEvents,
        upcomingEvents,
        savedEventIds,
        attendingEventIds,
        attendeeVisibility,
        eventBuddySettings,
        connectionRequests,
        conversations,
        chatMessages,
        typingConversationIds,
        chatErrors,
        blockedUserIds,
        removedChats,
        reportedUserIds,
        reportedEventIds,
        reportsList,
        allAttendees: SAMPLE_ATTENDEES,
        dailyBuddyRequestsCount,
        maxDailyRequests: MAX_DAILY_REQUESTS,
        savedFilters,
        eventSocialBattery,
        loginDemoUser,
        logout,
        updateOnboardingProfile,
        completeOnboardingPreferences,
        updatePersonalityQuiz,
        completeQuizAndPopulateMatches,
        toggleSavedFilter,
        removeSavedFilter,
        clearSavedFilters,
        setEventSocialBattery,
        verifyUWStudent,
        updateProfile,
        updatePreferences,
        toggleSaveEvent,
        toggleGoing,
        enableBuddyMatching,
        disableBuddyMatching,
        getEventAttendees,
        getSuggestedMatches,
        sendConnectionRequest,
        respondConnectionRequest,
        withdrawConnectionRequest,
        sendMessage,
        removeConversations,
        toggleStayConnected,
        simulatePartnerStayConnected,
        toggleChatPostEventClosed,
        blockUser,
        unblockUser,
        reportItem,
        createEvent,
        updateEvent,
        cancelEvent,
        resetDemoData,
        notificationSettings,
        updateNotificationSettings,
        notifications,
        unreadNotificationsCount,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        deleteNotification,
        simulateTestNotification,

        // Technical & Operational Capabilities (Requirement 8)
        aggregationSources,
        duplicateResults,
        syncReports,
        studentDiscounts,
        auditLogs,
        runScheduledRefresh,
        resolveDuplicate,
        moderateEvent,
        resolveReport,
        addCustomDiscount,

        // Buddy notifications, pairing confirmation, post-event surveys & demo controls
        effectiveNowMs,
        demoClockMs,
        attendedEventSnapshots,
        buddyOptInHistory,
        pairingEventHistory,
        endedPairingsByEvent,
        searchingReplacementEventIds,
        eventSurveys,
        surveyDismissedEventIds,
        browserAlertsEnabled,
        browserAlertPermission,
        visibleNotifications,
        getEventById,
        markConversationRead,
        confirmPairing,
        rematchBuddyForEvent,
        leaveBuddyMatchingFromChat,
        cancelRsvpFromChat,
        archivedConversations,
        partnerSimulationLog,
        toggleBrowserAlerts,
        submitPostEventSurvey,
        dismissSurveyOffer,
        demoGetMatched,
        demoSimulatePairingEnded,
        demoSimulateBuddyCancelled,
        demoAdvanceWithin24Hours,
        demoAdvanceToEventStart,
        demoAdvanceToEventEnd,
        demoResetClock
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
