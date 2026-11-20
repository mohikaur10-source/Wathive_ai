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
  EventFilterTag
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
import { isEventPast } from '../utils/eventLifecycle';
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
}

const STORAGE_KEY = 'wathive_app_state_v16';
const SAVED_FILTERS_STORAGE_KEY = 'wathive_saved_filters_v1';
const MAX_DAILY_REQUESTS = 5;

const AppContext = createContext<AppContextType | undefined>(undefined);

const stripLegacyConversationFlags = (convs: any[]): Conversation[] =>
  convs.map(({ isBlocked: _b, isDisconnected: _d, ...rest }) => rest as Conversation);

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
        'wathive_app_state_v15'
      ];

      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        legacyKeys.forEach((k) => {
          try { localStorage.removeItem(k); } catch {}
        });
        return JSON.parse(stored);
      }

      // Carry forward removedChats / blockedUserIds from v15 across key bump so removed chats never resurrect
      const prevV15 = localStorage.getItem('wathive_app_state_v15');
      legacyKeys.forEach((k) => {
        try { localStorage.removeItem(k); } catch {}
      });
      if (prevV15) {
        return JSON.parse(prevV15);
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
    const cachedUser = initialCached.user as UserProfile;
    const normalizedQuiz = normalizeQuizProfile(cachedUser.personalityQuiz);
    const baseUser: UserProfile = {
      ...cachedUser,
      personalityQuiz: normalizedQuiz
    };
    if (
      baseUser.id === 'user_alex_chen' &&
      (!baseUser.avatar || baseUser.avatar.includes('unsplash.com'))
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
      ? initialCached.blockedUserIds
      : [];
    const rawRemoved: RemovedChatRecord[] = Array.isArray(initialCached?.removedChats)
      ? initialCached.removedChats
      : [];
    const rawConvs: any[] = Array.isArray(initialCached?.conversations)
      ? initialCached.conversations
      : INITIAL_CONVERSATIONS;
    const rawMsgs: Record<string, ChatMessage[]> =
      initialCached?.chatMessages && typeof initialCached.chatMessages === 'object'
        ? initialCached.chatMessages
        : INITIAL_CHAT_MESSAGES;
    const rawReqs: ConnectionRequest[] = Array.isArray(initialCached?.connectionRequests)
      ? initialCached.connectionRequests
      : INITIAL_REQUESTS;

    // Migrate any legacy isBlocked/isDisconnected conversations into removedChats so they stay gone
    const migratedRemoved = [...rawRemoved];
    for (const c of rawConvs) {
      if (c?.isBlocked) {
        if (!rawBlocked.includes(c.partner?.id)) rawBlocked.push(c.partner.id);
        migratedRemoved.push({
          partnerId: c.partner.id,
          eventId: null,
          reason: 'blocked',
          removedAt: new Date().toISOString()
        });
      } else if (c?.isDisconnected) {
        migratedRemoved.push({
          partnerId: c.partner.id,
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
    initialCached?.dailyBuddyRequestsCount || 1 // Alex Chen sent 1 sample request
  );
  const [eventAttendeesMap] = useState<Record<string, string[]>>(
    initialCached?.eventAttendeesMap || INITIAL_EVENT_ATTENDEES
  );
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(
    initialCached?.notificationSettings || DEFAULT_NOTIFICATION_SETTINGS
  );
  const [notifications, setNotifications] = useState<InAppNotification[]>(
    initialCached?.notifications || INITIAL_NOTIFICATIONS
  );

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

  // Save user preferences & buddy state to localStorage (never persist events list)
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

  const upcomingEvents = React.useMemo(() => {
    const nowDate = new Date(nowMs);
    return events.filter((e) => !isEventPast(e, nowDate));
  }, [events, nowMs]);

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
    setUser(updatedUser);

    // Pre-populate mock Match Invitations based on new answers + preference filters
    // and refresh Icebreaker Hooks on active conversations without resurrecting removed/blocked chats.
    const fallbackEvents = [
      { id: 'wusa_247403', title: 'Campus Social Mixer @ SLC', date: torontoNow.dateStr },
      { id: 'wusa_250173', title: 'Waterloo Student Night Market', date: torontoNow.dateStr },
      { id: 'wusa_249683', title: 'Trivia & Board Games Night', date: torontoNow.dateStr }
    ];
    const candidateEvents =
      upcomingEvents.length > 0
        ? upcomingEvents.filter((e) => !e.isResearchStudy && e.status === 'published')
        : fallbackEvents;

    updateChatStoreAndPersist((prev) => {
      // Refresh Icebreaker Hooks on existing conversations
      const updatedConversations = prev.conversations.map((conv) => {
        const partnerProfile = SAMPLE_ATTENDEES[conv.partner.id] || conv.partner;
        const compat = calculateCompatibility(
          completedQuiz,
          partnerProfile.personalityQuiz,
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

      const activePartnerIds = new Set(updatedConversations.map((c) => c.partner.id));
      const candidates = Object.values(SAMPLE_ATTENDEES)
        .filter((att) => att.id !== updatedUser.id && att.isVerifiedUWStudent)
        .map((att, idx) => {
          const ev = candidateEvents[idx % candidateEvents.length] || fallbackEvents[0];
          const compat = calculateCompatibility(
            completedQuiz,
            att.personalityQuiz,
            updatedUser,
            att,
            eventSocialBattery[ev.id],
            ev.id,
            ev.title
          );
          return { attendee: att, event: ev, compat };
        })
        .filter(
          ({ attendee, event, compat }) =>
            !compat.filteredOut &&
            !activePartnerIds.has(attendee.id) &&
            !isChatRemovedForPair(attendee.id, event.id, prev.removedChats, prev.blockedUserIds)
        )
        .sort((a, b) => b.compat.score - a.compat.score)
        .slice(0, 3);

      // Keep user's non-pending or outgoing requests intact; replace auto-generated pending incoming invitations
      const preservedRequests = prev.connectionRequests.filter(
        (r) => !(r.recipientId === updatedUser.id && r.status === 'pending')
      );

      const freshInvitations: ConnectionRequest[] = candidates.map(({ attendee, event, compat }, idx) => ({
        id: `req_quiz_${attendee.id}_${Date.now()}_${idx}`,
        eventId: event.id,
        eventTitle: event.title,
        eventDate: event.date,
        senderId: attendee.id,
        senderName: attendee.name,
        senderAvatar: attendee.avatar,
        senderFaculty: attendee.faculty,
        senderProgram: attendee.program,
        senderYear: attendee.year,
        recipientId: updatedUser.id,
        recipientName: formatPublicName(updatedUser.name),
        introMessage: `Hey ${formatPublicName(updatedUser.name)}! Saw we matched on WatHive for ${event.title}. Want to head over together?`,
        compatibilityScore: compat.score,
        compatibilityReasons: compat.reasons,
        icebreakerPill: compat.icebreakerPill,
        icebreakerBanner: compat.icebreakerBanner,
        icebreakerQuestion: compat.icebreakerQuestion,
        socialBattery: attendee.defaultSocialBattery,
        status: 'pending',
        createdAt: new Date().toISOString()
      }));

      return {
        ...prev,
        conversations: updatedConversations,
        connectionRequests: [...freshInvitations, ...preservedRequests]
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
  const toggleGoing = (eventId: string) => {
    setAttendingEventIds((prev) => {
      const isCurrentlyGoing = prev.includes(eventId);
      if (isCurrentlyGoing) {
        // Leaving event also completely turns off buddy matching visibility for this event
        setAttendeeVisibilityMap((v) => {
          const next = { ...v };
          delete next[eventId];
          return next;
        });
        return prev.filter((id) => id !== eventId);
      } else {
        return [...prev, eventId];
      }
    });
  };

  // Explicit opt-in for buddy matching ("I want to go with someone!") per event
  const enableBuddyMatching = (
    eventId: string,
    settings: BuddyPrivacySettings
  ): { success: boolean; message: string } => {
    if (!user) return { success: false, message: 'Please sign in first.' };

    // Requirement C: Restrict buddy matching to verified UW students
    if (!user.isVerifiedUWStudent) {
      return {
        success: false,
        message: 'Verification required: You must be a verified University of Waterloo student to enable buddy matching.'
      };
    }

    // Requirement B: User must be RSVP'd to the event
    if (!attendingEventIds.includes(eventId)) {
      setAttendingEventIds((prev) => [...prev, eventId]);
    }

    setEventBuddySettings((prev) => ({
      ...prev,
      [eventId]: settings
    }));
    setAttendeeVisibilityMap((prev) => ({
      ...prev,
      [eventId]: true
    }));

    return {
      success: true,
      message: 'Buddy matching enabled! You can now explore compatible attendees for this event.'
    };
  };

  // Turn off buddy matching visibility at any time
  const disableBuddyMatching = (eventId: string) => {
    setAttendeeVisibilityMap((prev) => ({
      ...prev,
      [eventId]: false
    }));
  };

  // Attendees list: filtered by event, opt-in status, research exclusion, blocked/reported/left pairs
  const getEventAttendees = (eventId: string): AttendeeProfile[] => {
    const event = upcomingEvents.find((e) => e.id === eventId);
    if (!event || event.isResearchStudy || event.status === 'cancelled' || event.status === 'ended') {
      return [];
    }

    const attendeeIds = eventAttendeesMap[eventId] || [];
    const profiles: AttendeeProfile[] = [];

    for (const id of attendeeIds) {
      const attendee = SAMPLE_ATTENDEES[id];
      if (
        attendee &&
        attendee.isVerifiedUWStudent &&
        !isChatRemovedForPair(id, eventId, removedChats, blockedUserIds)
      ) {
        profiles.push(attendee);
      }
    }

    // If current user opted in to buddy matching for this event, show user's preview card
    if (user && attendingEventIds.includes(eventId) && attendeeVisibility[eventId]) {
      const settings = eventBuddySettings[eventId] || {
        showFaculty: true,
        showYear: true,
        shortIntro: user.bio || ''
      };

      profiles.unshift({
        id: user.id,
        name: `${formatPublicName(user.name)} (You)`,
        avatar: user.avatar,
        faculty: settings.showFaculty ? user.faculty : undefined,
        program: settings.showFaculty ? user.program : undefined,
        year: settings.showYear ? user.year : undefined,
        bio: settings.shortIntro || undefined,
        showFaculty: settings.showFaculty,
        showYear: settings.showYear,
        isVerifiedUWStudent: user.isVerifiedUWStudent,
        personalityQuiz: user.personalityQuiz
      });
    }

    return profiles;
  };

  // Get prioritized compatible suggested matches for a specific event
  const getSuggestedMatches = (eventId: string): SuggestedMatchItem[] => {
    const event = upcomingEvents.find((e) => e.id === eventId);
    if (!event || event.isResearchStudy || event.status === 'cancelled' || event.status === 'ended') {
      return [];
    }

    const attendeeIds = eventAttendeesMap[eventId] || [];
    const matches: SuggestedMatchItem[] = [];
    const userEventBattery = eventSocialBattery[eventId];

    for (const id of attendeeIds) {
      const attendee = SAMPLE_ATTENDEES[id];
      if (
        attendee &&
        attendee.isVerifiedUWStudent &&
        !isChatRemovedForPair(id, eventId, removedChats, blockedUserIds)
      ) {
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
    }

    // Sort by highest compatibility score first!
    return matches.sort((a, b) => b.compatibility.score - a.compatibility.score);
  };

  // Send request with compatibility calculation and verification checks
  const sendConnectionRequest = (
    eventId: string,
    recipientId: string,
    introMessage = ''
  ): { success: boolean; message: string } => {
    if (!user) return { success: false, message: 'Please log in to send requests.' };

    // Requirement C: Must be verified UW student
    if (!user.isVerifiedUWStudent) {
      return {
        success: false,
        message: 'University of Waterloo student verification is required before sending buddy requests.'
      };
    }

    const event = upcomingEvents.find((e) => e.id === eventId);
    if (!event) return { success: false, message: 'Event not found.' };

    if (event.isResearchStudy) {
      return { success: false, message: 'Buddy matching is strictly disabled for research studies.' };
    }

    if (event.status === 'ended' || event.status === 'cancelled') {
      return { success: false, message: 'Buddy requests are closed for this event.' };
    }

    const removalCheck = getRequestRejectionForRemovedChat(
      recipientId,
      eventId,
      removedChats,
      blockedUserIds
    );
    if (removalCheck.blocked) {
      return { success: false, message: removalCheck.message };
    }

    // Daily limit enforcement (Max 5 requests per day)
    if (dailyBuddyRequestsCount >= MAX_DAILY_REQUESTS) {
      return {
        success: false,
        message: `Daily limit reached: You can send up to ${MAX_DAILY_REQUESTS} buddy requests per day to protect student privacy and comfort.`
      };
    }

    // Check if previously declined for this same event
    const declineKey = `${eventId}_${user.id}_${recipientId}`;
    if (declinedHistory.includes(declineKey)) {
      return {
        success: false,
        message: 'A previous request for this event was declined. Further requests for this event are not permitted.'
      };
    }

    // Check if single pending or accepted request already exists
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
            ? 'You already have a pending request with this attendee for this event.'
            : 'You are already connected with this attendee!'
      };
    }

    const recipient = SAMPLE_ATTENDEES[recipientId];
    if (!recipient || !recipient.isVerifiedUWStudent) {
      return {
        success: false,
        message: 'This attendee is currently not verified for buddy matching.'
      };
    }

    const userSettings = eventBuddySettings[eventId] || {
      showFaculty: true,
      showYear: true,
      shortIntro: ''
    };

    // Calculate real weighted compatibility score (40% Quiz, 40% Social Battery, 20% Preferences)
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

    // Simulate realistic acceptance after 4.5 seconds (only if still pending and not blocked/removed)
    setTimeout(() => {
      updateChatStoreAndPersist((prev) => {
        const liveReq = prev.connectionRequests.find((r) => r.id === newReq.id);
        if (
          !liveReq ||
          liveReq.status !== 'pending' ||
          isChatRemovedForPair(recipientId, eventId, prev.removedChats, prev.blockedUserIds)
        ) {
          return prev;
        }

        const convId = `conv_${recipientId}_${Date.now()}`;
        const newConv: Conversation = {
          id: convId,
          eventId,
          eventTitle: event.title,
          eventDate: event.date,
          eventLocation: event.location,
          partner: recipient,
          lastMessage: `Hey ${formatPublicName(user.name)}! I accepted your request to attend ${event.title} together (${compatResult.score}% match!). Looking forward to it!`,
          lastMessageTime: 'Just now',
          unreadCount: 1,
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
            id: `m_reply_${Date.now()}`,
            conversationId: convId,
            senderId: recipient.id,
            text: `Hey ${formatPublicName(user.name)}! I accepted your request to attend ${event.title} together (${compatResult.score}% compatibility!). Looking forward to meeting up!`,
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
    }, 4500);

    return {
      success: true,
      message: `Request sent (${compatResult.score}% match)! Chat will unlock once accepted by the attendee.`
    };
  };

  // Accept or decline without providing reason; enforce no re-request after decline
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

    updateChatStoreAndPersist((prev) => {
      if (isChatRemovedForPair(partner.id, req.eventId, prev.removedChats, prev.blockedUserIds)) {
        return prev;
      }
      const convId = `conv_${req.senderId}_${Date.now()}`;
      const newConv: Conversation = {
        id: convId,
        eventId: req.eventId,
        eventTitle: req.eventTitle,
        eventDate: req.eventDate,
        eventLocation: 'Campus Venue',
        partner,
        lastMessage: req.introMessage || `Icebreaker: ${icebreakerQuestion}`,
        lastMessageTime: 'Just now',
        unreadCount: 0,
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
          id: `m_ice_${Date.now()}`,
          conversationId: convId,
          senderId: 'system',
          text: `Icebreaker prompt: ${icebreakerQuestion}`,
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
          text: `Hey ${partner.name}! Excited to check out ${req.eventTitle} together!`,
          timestamp: 'Just now'
        }
      ];

      return {
        ...prev,
        connectionRequests: prev.connectionRequests.map((r) =>
          r.id === requestId ? { ...r, status: 'accepted' } : r
        ),
        conversations: [
          newConv,
          ...prev.conversations.filter(
            (c) => !(c.partner.id === partner.id && c.eventId === req.eventId)
          )
        ],
        chatMessages: {
          ...prev.chatMessages,
          [convId]: msgs
        }
      };
    });
  };

  const withdrawConnectionRequest = (requestId: string) => {
    updateChatStoreAndPersist((prev) => ({
      ...prev,
      connectionRequests: prev.connectionRequests.map((r) =>
        r.id === requestId ? { ...r, status: 'withdrawn' } : r
      )
    }));
  };

  const removeConversations = (params: RemoveConversationsParams) => {
    updateChatStoreAndPersist((prev) => applyRemoveConversations(prev, params));
  };

  const toggleStayConnected = (conversationId: string) => {
    updateChatStoreAndPersist((prev) => ({
      ...prev,
      conversations: prev.conversations.map((c) =>
        c.id === conversationId
          ? { ...c, stayConnectedUser: !c.stayConnectedUser }
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
    if (!user || !text.trim()) return;

    const conv = conversations.find((c) => c.id === conversationId);
    if (
      !conv ||
      conv.isChatClosedPostEvent ||
      isPartnerBlockedOrReported(conv.partner.id, removedChats, blockedUserIds)
    ) {
      return;
    }

    const newMsg: ChatMessage = {
      id: `m_${Date.now()}`,
      conversationId,
      senderId: user.id,
      text: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    updateChatStoreAndPersist((prev) => {
      if (!prev.conversations.some((c) => c.id === conversationId)) return prev;
      return {
        ...prev,
        chatMessages: {
          ...prev.chatMessages,
          [conversationId]: [...(prev.chatMessages[conversationId] || []), newMsg]
        },
        conversations: prev.conversations.map((c) =>
          c.id === conversationId
            ? { ...c, lastMessage: text.trim(), lastMessageTime: 'Just now' }
            : c
        )
      };
    });

    // Realistic partner reply (only if conversation still exists after delay)
    setTimeout(() => {
      const partnerReplies = [
        "Sounds like a plan! Let's meet right at the registration desk about 10 minutes before.",
        "That works for me! So glad we got matched up based on our personality quiz.",
        "It's my first time attending this event too, so having a buddy is super reassuring!",
        "Perfect, see you there by the main entrance!"
      ];
      const randomReply = partnerReplies[Math.floor(Math.random() * partnerReplies.length)];

      const replyMsg: ChatMessage = {
        id: `m_rep_${Date.now()}`,
        conversationId,
        senderId: conv.partner.id,
        text: randomReply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      updateChatStoreAndPersist((prev) => {
        if (!prev.conversations.some((c) => c.id === conversationId)) return prev;
        return {
          ...prev,
          chatMessages: {
            ...prev.chatMessages,
            [conversationId]: [...(prev.chatMessages[conversationId] || []), replyMsg]
          },
          conversations: prev.conversations.map((c) =>
            c.id === conversationId
              ? { ...c, lastMessage: randomReply, lastMessageTime: 'Just now' }
              : c
          )
        };
      });
    }, 1800);
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
        'wathive_app_state_v15'
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
    setDailyBuddyRequestsCount(1);
    setNotificationSettings(DEFAULT_NOTIFICATION_SETTINGS);
    setNotifications(INITIAL_NOTIFICATIONS);
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

  const unreadNotificationsCount = notifications.filter((n) => !n.read).length;

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
        addCustomDiscount
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
