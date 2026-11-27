import { BUDDY_POLICY } from '../config/buddyPolicy';
import {
  BuddyNotificationKind,
  InAppNotification,
  NotificationActionKind,
  NotificationSettings,
  PushDailyCounter
} from '../types';
import { getTorontoNow } from './timeZone';

export interface BuddyNotificationSpec {
  kind: BuddyNotificationKind;
  title: string;
  message: string;
  actionLabel?: string;
  actionKind?: NotificationActionKind;
}

export function buildNotificationDedupeKey(
  kind: BuddyNotificationKind,
  eventId: string,
  conversationOrPartnerId?: string
): string {
  return conversationOrPartnerId
    ? `${kind}:${eventId}:${conversationOrPartnerId}`
    : `${kind}:${eventId}`;
}

export function buildBuddyNotificationSpec(
  kind: BuddyNotificationKind,
  eventTitle: string
): BuddyNotificationSpec {
  const safeTitle = eventTitle.trim() || 'this event';

  switch (kind) {
    case 'provisional_match':
      return {
        kind,
        title: "You've been matched!",
        message: `We've found a potential buddy for ${safeTitle}. Say hello and get to know each other!`,
        actionLabel: 'Open chat',
        actionKind: 'open_chat'
      };
    case 'mutual_confirmation':
      return {
        kind,
        title: "You're officially buddies!",
        message: `You and your buddy have both confirmed that you'd like to attend ${safeTitle} together.`,
        actionLabel: 'Open chat',
        actionKind: 'open_chat'
      };
    case 'pairing_ended':
      return {
        kind,
        title: 'Your buddy pairing has changed',
        message: `Your previous pairing has ended. We're prioritizing finding you another buddy for ${safeTitle}.`,
        actionLabel: 'View status',
        actionKind: 'view_status'
      };
    case 'buddy_cancelled':
      return {
        kind,
        title: 'Buddy availability update',
        message: `Your buddy is no longer able to attend ${safeTitle}. We'll do our best to find you another buddy.`,
        actionLabel: 'View status',
        actionKind: 'view_status'
      };
    case 'replacement_found':
      return {
        kind,
        title: "We've found you another buddy!",
        message: 'Your new potential buddy is ready to connect.',
        actionLabel: 'Open chat',
        actionKind: 'open_chat'
      };
    case 'no_match_found':
      return {
        kind,
        title: 'Buddy matching update',
        message: `We weren't able to find you a buddy for ${safeTitle}. Your RSVP is still active, and you're welcome to attend.`,
        actionLabel: 'View status',
        actionKind: 'view_status'
      };
  }
}

export function canCreateBuddyNotification(params: {
  kind: BuddyNotificationKind;
  dedupeKey: string;
  usedDedupeKeys: string[];
  buddyMatchesEnabled: boolean;
  isAttendingEvent: boolean;
  optedInBeforeStart?: boolean;
  hasActivePairingForEvent?: boolean;
  eventStartMs?: number;
  nowMs?: number;
}): boolean {
  const {
    kind,
    dedupeKey,
    usedDedupeKeys,
    buddyMatchesEnabled,
    isAttendingEvent,
    optedInBeforeStart = false,
    hasActivePairingForEvent = false,
    eventStartMs,
    nowMs = Date.now()
  } = params;

  if (!buddyMatchesEnabled) return false;
  if (!isAttendingEvent) return false;
  if (usedDedupeKeys.includes(dedupeKey)) return false;

  if (kind === 'no_match_found') {
    if (!optedInBeforeStart) return false;
    if (hasActivePairingForEvent) return false;
    if (eventStartMs === undefined || !Number.isFinite(eventStartMs)) return false;
    const elapsedSinceStartMs = nowMs - eventStartMs;
    if (elapsedSinceStartMs < 0 || elapsedSinceStartMs >= 24 * 60 * 60 * 1000) {
      return false;
    }
  }

  return true;
}

export function createBuddyNotificationItem(params: {
  kind: BuddyNotificationKind;
  eventId: string;
  eventTitle: string;
  dedupeKey: string;
  conversationId?: string;
  partnerId?: string;
  nowMs?: number;
}): InAppNotification {
  const {
    kind,
    eventId,
    eventTitle,
    dedupeKey,
    conversationId,
    partnerId,
    nowMs = Date.now()
  } = params;

  const spec = buildBuddyNotificationSpec(kind, eventTitle);

  return {
    id: `notif_${kind}_${eventId}_${nowMs}`,
    type: 'buddy_match',
    kind,
    dedupeKey,
    title: spec.title,
    message: spec.message,
    timestamp: 'Just now',
    createdAtMs: nowMs,
    read: false,
    eventId,
    eventTitle,
    conversationId,
    partnerId,
    actionLabel: spec.actionLabel,
    actionKind: spec.actionKind
  };
}

export function formatNotificationRelativeTime(
  createdAtMs: number | undefined,
  nowMs: number,
  fallbackTimestamp = 'Just now'
): string {
  if (createdAtMs === undefined || !Number.isFinite(createdAtMs)) {
    return fallbackTimestamp;
  }
  const diffMs = Math.max(0, nowMs - createdAtMs);
  const diffMinutes = Math.floor(diffMs / 60_000);
  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export function isNotificationVisibleForSettings(
  notification: InAppNotification,
  settings: NotificationSettings
): boolean {
  switch (notification.type) {
    case 'buddy_match':
      return settings.types.buddyMatches;
    case 'new_event':
      return settings.types.newEvents;
    case 'upcoming_reminder':
      return settings.types.upcomingRsvp;
    case 'registration_deadline':
      return settings.types.registrationDeadlines;
    case 'schedule_change':
      return settings.types.eventChanges;
    case 'student_discount':
      return settings.types.studentDiscounts;
    default:
      return true;
  }
}

export function isTorontoQuietHours(date: Date = new Date()): boolean {
  const { hour } = getTorontoNow(date);
  return hour >= 23 || hour < 8;
}

export function getPushCountForTorontoDate(
  counter: PushDailyCounter | null | undefined,
  dateStr: string
): number {
  if (!counter || counter.dateStr !== dateStr) return 0;
  return Math.max(0, counter.count);
}

export function incrementPushDailyCounter(
  counter: PushDailyCounter | null | undefined,
  dateStr: string
): PushDailyCounter {
  return {
    dateStr,
    count: getPushCountForTorontoDate(counter, dateStr) + 1
  };
}

export function canSendBrowserPush(params: {
  browserAlertsEnabled: boolean;
  permission: NotificationPermission | 'unsupported';
  settings: NotificationSettings;
  pushDailyCounter: PushDailyCounter | null | undefined;
  nowDate?: Date;
  cap?: number;
}): boolean {
  const {
    browserAlertsEnabled,
    permission,
    settings,
    pushDailyCounter,
    nowDate = new Date(),
    cap = BUDDY_POLICY.pushDailyCap
  } = params;

  if (!browserAlertsEnabled) return false;
  if (permission !== 'granted') return false;
  if (settings.quietHoursEnabled && isTorontoQuietHours(nowDate)) return false;

  if (settings.avoidOverwhelming) {
    const todayToronto = getTorontoNow(nowDate).dateStr;
    if (getPushCountForTorontoDate(pushDailyCounter, todayToronto) >= cap) {
      return false;
    }
  }

  return true;
}

export function getBrowserNotificationPermission(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return window.Notification.permission;
}

export async function requestBrowserNotificationPermission(): Promise<
  NotificationPermission | 'unsupported'
> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  try {
    return await window.Notification.requestPermission();
  } catch {
    return window.Notification.permission;
  }
}

export function showBrowserNotification(
  title: string,
  body: string,
  tag?: string
): boolean {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  if (window.Notification.permission !== 'granted') {
    return false;
  }
  try {
    new window.Notification(title, {
      body,
      tag
    });
    return true;
  } catch {
    return false;
  }
}
