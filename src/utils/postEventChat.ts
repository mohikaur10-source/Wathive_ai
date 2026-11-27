import { BUDDY_POLICY, BuddyPolicyConfig, PostEventChatAccessMode } from '../config/buddyPolicy';
import { Conversation } from '../types';

export interface PostEventChatEvaluation {
  mode: PostEventChatAccessMode;
  isEventEnded: boolean;
  isChatClosed: boolean;
  showStayConnectedBar: boolean;
  remainingHours: number;
  statusLineText: string | null;
  closedBannerText: string | null;
}

export const CLOSED_POST_EVENT_TEXT = 'This chat has closed now that the event has ended.';

export function evaluatePostEventChatAccess(
  conversation: Pick<Conversation, 'stayConnectedUser' | 'stayConnectedPartner' | 'isChatClosedPostEvent'> | null | undefined,
  eventEndMs: number,
  nowMs: number,
  options: {
    policy?: BuddyPolicyConfig;
    explicitEnded?: boolean;
  } = {}
): PostEventChatEvaluation {
  const policy = options.policy || BUDDY_POLICY;
  const mode = policy.postEventChatAccess;
  const hasEndedByClock = Number.isFinite(eventEndMs) && nowMs >= eventEndMs;
  const isEventEnded = Boolean(options.explicitEnded || hasEndedByClock);

  if (!conversation || !isEventEnded) {
    return {
      mode,
      isEventEnded: false,
      isChatClosed: false,
      showStayConnectedBar: false,
      remainingHours: 0,
      statusLineText: null,
      closedBannerText: null
    };
  }

  if (mode === 'always_open') {
    return {
      mode,
      isEventEnded: true,
      isChatClosed: false,
      showStayConnectedBar: false,
      remainingHours: 0,
      statusLineText: null,
      closedBannerText: null
    };
  }

  if (mode === 'closed_at_event_end') {
    return {
      mode,
      isEventEnded: true,
      isChatClosed: true,
      showStayConnectedBar: false,
      remainingHours: 0,
      statusLineText: null,
      closedBannerText: CLOSED_POST_EVENT_TEXT
    };
  }

  // 'until_mutual_choice_or_window'
  const bothStayConnected = Boolean(
    conversation.stayConnectedUser && conversation.stayConnectedPartner
  );
  if (bothStayConnected) {
    return {
      mode,
      isEventEnded: true,
      isChatClosed: false,
      showStayConnectedBar: false,
      remainingHours: 0,
      statusLineText: null,
      closedBannerText: null
    };
  }

  const windowMs = policy.postEventChatWindowHours * 60 * 60 * 1000;
  const effectiveEndMs = Number.isFinite(eventEndMs) ? eventEndMs : nowMs - windowMs;
  const elapsedMs = Math.max(0, nowMs - effectiveEndMs);
  const remainingMs = windowMs - elapsedMs;

  if (remainingMs > 0 && !conversation.isChatClosedPostEvent) {
    const remainingHours = Math.max(1, Math.ceil(remainingMs / (60 * 60 * 1000)));
    return {
      mode,
      isEventEnded: true,
      isChatClosed: false,
      showStayConnectedBar: true,
      remainingHours,
      statusLineText: `The event has ended. This chat stays open for about ${remainingHours}h, or longer if you both choose to stay connected.`,
      closedBannerText: null
    };
  }

  return {
    mode,
    isEventEnded: true,
    isChatClosed: true,
    showStayConnectedBar: false,
    remainingHours: 0,
    statusLineText: null,
    closedBannerText: CLOSED_POST_EVENT_TEXT
  };
}
