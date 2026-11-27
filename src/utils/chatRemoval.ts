import {
  ChatMessage,
  ConnectionRequest,
  Conversation,
  RemovedChatReason,
  RemovedChatRecord
} from '../types';

export interface RemoveConversationsParams {
  partnerId: string;
  eventId?: string;
  reason: RemovedChatReason;
  nowIso?: string;
}

export interface ChatStateSnapshot {
  conversations: Conversation[];
  chatMessages: Record<string, ChatMessage[]>;
  connectionRequests: ConnectionRequest[];
  removedChats: RemovedChatRecord[];
  blockedUserIds: string[];
}

export function isChatRemovedForPair(
  partnerId: string,
  eventId: string,
  removedChats: RemovedChatRecord[],
  blockedUserIds: string[]
): boolean {
  if (!partnerId) return false;
  if (Array.isArray(blockedUserIds) && blockedUserIds.includes(partnerId)) return true;
  if (!Array.isArray(removedChats)) return false;
  return removedChats.some((entry) => {
    if (!entry || entry.partnerId !== partnerId) return false;
    if (entry.reason === 'blocked' || entry.reason === 'reported') return true;
    return entry.reason === 'left' && entry.eventId === eventId;
  });
}

export function isPartnerBlockedOrReported(
  partnerId: string,
  removedChats: RemovedChatRecord[],
  blockedUserIds: string[]
): boolean {
  if (!partnerId) return false;
  if (Array.isArray(blockedUserIds) && blockedUserIds.includes(partnerId)) return true;
  if (!Array.isArray(removedChats)) return false;
  return removedChats.some(
    (entry) =>
      Boolean(entry) &&
      entry.partnerId === partnerId &&
      (entry.reason === 'blocked' || entry.reason === 'reported')
  );
}

export function getRequestRejectionForRemovedChat(
  partnerId: string,
  eventId: string,
  removedChats: RemovedChatRecord[],
  blockedUserIds: string[]
): { blocked: boolean; message: string } {
  if (isPartnerBlockedOrReported(partnerId, removedChats, blockedUserIds)) {
    return { blocked: true, message: '' };
  }
  if (
    Array.isArray(removedChats) &&
    removedChats.some(
      (entry) =>
        Boolean(entry) &&
        entry.partnerId === partnerId &&
        entry.reason === 'left' &&
        entry.eventId === eventId
    )
  ) {
    return { blocked: true, message: 'You left this chat.' };
  }
  return { blocked: false, message: '' };
}

function normalizeMessageList(rawMsgs: unknown): ChatMessage[] {
  if (!Array.isArray(rawMsgs)) return [];
  const valid: ChatMessage[] = [];
  for (const item of rawMsgs) {
    if (!item || typeof item !== 'object') continue;
    const msg = item as Partial<ChatMessage>;
    if (typeof msg.id !== 'string' || !msg.id) continue;
    valid.push({
      id: msg.id,
      conversationId: typeof msg.conversationId === 'string' ? msg.conversationId : '',
      senderId: typeof msg.senderId === 'string' ? msg.senderId : 'system',
      text: typeof msg.text === 'string' ? msg.text : '',
      timestamp: typeof msg.timestamp === 'string' ? msg.timestamp : ''
    });
  }
  return valid;
}

/**
 * Pure filter applied on load/seed/hydration so removed or blocked chats
 * and their messages can never resurrect from cached state or seed data,
 * and malformed/partial records cannot crash the chat UI.
 */
export function sanitizeChatSnapshot(snapshot: ChatStateSnapshot): ChatStateSnapshot {
  const safeRemovedChats = Array.isArray(snapshot?.removedChats)
    ? snapshot.removedChats.filter(
        (r): r is RemovedChatRecord =>
          Boolean(r && typeof r === 'object' && typeof r.partnerId === 'string' && r.partnerId)
      )
    : [];

  const safeBlockedUserIds = Array.isArray(snapshot?.blockedUserIds)
    ? snapshot.blockedUserIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
    : [];

  const rawConversations = Array.isArray(snapshot?.conversations) ? snapshot.conversations : [];
  const cleanConversations: Conversation[] = [];

  for (const rawConv of rawConversations) {
    if (!rawConv || typeof rawConv !== 'object') continue;
    const conv = rawConv as Partial<Conversation>;
    if (typeof conv.id !== 'string' || !conv.id) continue;
    if (typeof conv.eventId !== 'string' || !conv.eventId) continue;
    const rawPartner = conv.partner as Partial<Conversation['partner']> | null | undefined;
    if (!rawPartner || typeof rawPartner !== 'object' || typeof rawPartner.id !== 'string' || !rawPartner.id) {
      continue;
    }
    if (isChatRemovedForPair(rawPartner.id, conv.eventId, safeRemovedChats, safeBlockedUserIds)) {
      continue;
    }

    cleanConversations.push({
      ...conv,
      id: conv.id,
      eventId: conv.eventId,
      eventTitle: typeof conv.eventTitle === 'string' && conv.eventTitle ? conv.eventTitle : 'Campus Event',
      eventDate: typeof conv.eventDate === 'string' ? conv.eventDate : '',
      eventLocation:
        typeof conv.eventLocation === 'string' && conv.eventLocation
          ? conv.eventLocation
          : 'Campus Venue',
      partner: {
        ...rawPartner,
        id: rawPartner.id,
        name:
          typeof rawPartner.name === 'string' && rawPartner.name.trim()
            ? rawPartner.name
            : 'Waterloo Student',
        avatar: typeof rawPartner.avatar === 'string' ? rawPartner.avatar : '',
        isVerifiedUWStudent: rawPartner.isVerifiedUWStudent ?? true
      },
      lastMessage: typeof conv.lastMessage === 'string' ? conv.lastMessage : '',
      lastMessageTime: typeof conv.lastMessageTime === 'string' ? conv.lastMessageTime : '',
      unreadCount:
        typeof conv.unreadCount === 'number' && Number.isFinite(conv.unreadCount) && conv.unreadCount > 0
          ? conv.unreadCount
          : 0,
      isReported: Boolean(conv.isReported)
    });
  }

  const activeConversationIds = new Set(cleanConversations.map((c) => c.id));
  const rawChatMessages =
    snapshot?.chatMessages && typeof snapshot.chatMessages === 'object' && !Array.isArray(snapshot.chatMessages)
      ? snapshot.chatMessages
      : {};
  const cleanMessages: Record<string, ChatMessage[]> = {};
  for (const [convId, msgs] of Object.entries(rawChatMessages)) {
    if (activeConversationIds.has(convId)) {
      cleanMessages[convId] = normalizeMessageList(msgs);
    }
  }

  const rawRequests = Array.isArray(snapshot?.connectionRequests) ? snapshot.connectionRequests : [];
  const cleanRequests = rawRequests.reduce<ConnectionRequest[]>((acc, req) => {
    if (!req || typeof req !== 'object') return acc;
    if (
      typeof req.id !== 'string' ||
      typeof req.senderId !== 'string' ||
      typeof req.recipientId !== 'string'
    ) {
      return acc;
    }
    const senderBlocked = isPartnerBlockedOrReported(
      req.senderId,
      safeRemovedChats,
      safeBlockedUserIds
    );
    const recipientBlocked = isPartnerBlockedOrReported(
      req.recipientId,
      safeRemovedChats,
      safeBlockedUserIds
    );

    // Sent or incoming requests involving a blocked/reported person disappear
    if (senderBlocked || recipientBlocked) {
      return acc;
    }

    const leftForPair = safeRemovedChats.some(
      (r) =>
        r.reason === 'left' &&
        r.eventId === req.eventId &&
        (r.partnerId === req.senderId || r.partnerId === req.recipientId)
    );

    if (leftForPair && req.status === 'pending') {
      acc.push({ ...req, status: 'withdrawn' });
      return acc;
    }

    acc.push(req);
    return acc;
  }, []);

  return {
    conversations: cleanConversations,
    chatMessages: cleanMessages,
    connectionRequests: cleanRequests,
    removedChats: safeRemovedChats,
    blockedUserIds: safeBlockedUserIds
  };
}

/**
 * Atomically removes matching conversation(s), deletes their messages,
 * records the removal in `removedChats`, and reconciles `connectionRequests`.
 */
export function applyRemoveConversations(
  state: ChatStateSnapshot,
  params: RemoveConversationsParams
): ChatStateSnapshot {
  const { partnerId, eventId, reason, nowIso = new Date().toISOString() } = params;
  const targetEventId = reason === 'left' ? (eventId ?? null) : null;

  // Idempotent append/update for removedChats
  const existingIdx = state.removedChats.findIndex(
    (r) =>
      r.partnerId === partnerId &&
      r.reason === reason &&
      (reason === 'left' ? r.eventId === targetEventId : r.eventId === null)
  );

  const nextRecord: RemovedChatRecord = {
    partnerId,
    eventId: targetEventId,
    reason,
    removedAt: nowIso
  };

  const nextRemovedChats =
    existingIdx >= 0
      ? state.removedChats.map((r, i) => (i === existingIdx ? nextRecord : r))
      : [...state.removedChats, nextRecord];

  const nextBlockedUserIds =
    reason === 'blocked' || reason === 'reported'
      ? state.blockedUserIds.includes(partnerId)
        ? state.blockedUserIds
        : [...state.blockedUserIds, partnerId]
      : state.blockedUserIds;

  return sanitizeChatSnapshot({
    conversations: state.conversations,
    chatMessages: state.chatMessages,
    connectionRequests: state.connectionRequests,
    removedChats: nextRemovedChats,
    blockedUserIds: nextBlockedUserIds
  });
}

/**
 * Unblocks a user and clears their `blocked` / `reported` entries from `removedChats`
 * while preserving `left` entries and NOT restoring old chats or messages.
 */
export function applyUnblockUser(
  state: ChatStateSnapshot,
  userId: string
): ChatStateSnapshot {
  return {
    ...state,
    blockedUserIds: state.blockedUserIds.filter((id) => id !== userId),
    removedChats: state.removedChats.filter(
      (r) => !(r.partnerId === userId && (r.reason === 'blocked' || r.reason === 'reported'))
    )
  };
}
