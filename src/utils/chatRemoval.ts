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
  if (blockedUserIds.includes(partnerId)) return true;
  return removedChats.some((entry) => {
    if (entry.partnerId !== partnerId) return false;
    if (entry.reason === 'blocked' || entry.reason === 'reported') return true;
    return entry.reason === 'left' && entry.eventId === eventId;
  });
}

export function isPartnerBlockedOrReported(
  partnerId: string,
  removedChats: RemovedChatRecord[],
  blockedUserIds: string[]
): boolean {
  if (blockedUserIds.includes(partnerId)) return true;
  return removedChats.some(
    (entry) =>
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
    removedChats.some(
      (entry) =>
        entry.partnerId === partnerId &&
        entry.reason === 'left' &&
        entry.eventId === eventId
    )
  ) {
    return { blocked: true, message: 'You left this chat.' };
  }
  return { blocked: false, message: '' };
}

/**
 * Pure filter applied on load/seed/hydration so removed or blocked chats
 * and their messages can never resurrect from cached state or seed data.
 */
export function sanitizeChatSnapshot(snapshot: ChatStateSnapshot): ChatStateSnapshot {
  const { conversations, chatMessages, connectionRequests, removedChats, blockedUserIds } = snapshot;

  const cleanConversations = conversations.filter(
    (conv) => !isChatRemovedForPair(conv.partner.id, conv.eventId, removedChats, blockedUserIds)
  );

  const activeConversationIds = new Set(cleanConversations.map((c) => c.id));
  const cleanMessages: Record<string, ChatMessage[]> = {};
  for (const [convId, msgs] of Object.entries(chatMessages)) {
    if (activeConversationIds.has(convId)) {
      cleanMessages[convId] = msgs;
    }
  }

  const cleanRequests = connectionRequests.reduce<ConnectionRequest[]>((acc, req) => {
    const senderBlocked = isPartnerBlockedOrReported(req.senderId, removedChats, blockedUserIds);
    const recipientBlocked = isPartnerBlockedOrReported(req.recipientId, removedChats, blockedUserIds);

    // Sent or incoming requests involving a blocked/reported person disappear
    if (senderBlocked || recipientBlocked) {
      return acc;
    }

    const leftForPair =
      removedChats.some(
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
    removedChats,
    blockedUserIds
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
