import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ChatStateSnapshot,
  applyRemoveConversations,
  applyUnblockUser,
  getRequestRejectionForRemovedChat,
  isChatRemovedForPair,
  sanitizeChatSnapshot
} from '../src/utils/chatRemoval.js';
import {
  createArchivedConversationRecord,
  getBuddyCommonLines,
  purgeExpiredArchivedConversations
} from '../src/utils/pairingLifecycle.js';
import { getConversationStarters } from '../src/utils/compatibilityEngine.js';
import { evaluatePostEventChatAccess } from '../src/utils/postEventChat.js';
import { getEventEndUtcMs } from '../src/utils/eventLifecycle.js';
import { getFirstName } from '../src/utils/buddySeeding.js';
import { formatModalEventDateTime } from '../src/utils/timeZone.js';
import { AttendeeProfile, ConnectionRequest, Conversation } from '../src/types/index.js';

const makePartner = (id: string, name: string): AttendeeProfile => ({
  id,
  name,
  avatar: 'https://example.com/a.jpg',
  faculty: 'Engineering',
  year: '3rd Year',
  isVerifiedUWStudent: true
});

const makeConv = (
  id: string,
  partnerId: string,
  partnerName: string,
  eventId: string,
  unreadCount = 0
): Conversation => ({
  id,
  eventId,
  eventTitle: `Event ${eventId}`,
  eventDate: '2026-11-22',
  eventLocation: 'SLC',
  partner: makePartner(partnerId, partnerName),
  lastMessage: 'Hi!',
  lastMessageTime: '10:00 AM',
  unreadCount,
  isReported: false,
  stayConnectedUser: false,
  stayConnectedPartner: false,
  isChatClosedPostEvent: false
});

const makeReq = (
  id: string,
  eventId: string,
  senderId: string,
  recipientId: string,
  status: ConnectionRequest['status'] = 'pending'
): ConnectionRequest => ({
  id,
  eventId,
  eventTitle: `Event ${eventId}`,
  eventDate: '2026-11-22',
  senderId,
  senderName: senderId,
  senderAvatar: '',
  senderFaculty: 'Math',
  senderYear: '2nd Year',
  recipientId,
  recipientName: recipientId,
  status,
  createdAt: '2026-11-20T12:00:00Z'
});

describe('Complete Chat Removal (Leave / Block / Report)', () => {
  it('leaving a chat removes only that (partnerId, eventId) chat, deletes its messages, and preserves other-event chats', () => {
    const mayaE1 = makeConv('conv_maya_e1', 'maya', 'Maya Lin', 'e1', 2);
    const mayaE2 = makeConv('conv_maya_e2', 'maya', 'Maya Lin', 'e2', 1);
    const liamE1 = makeConv('conv_liam_e1', 'liam', 'Liam Patel', 'e1', 0);

    const initial: ChatStateSnapshot = {
      conversations: [mayaE1, mayaE2, liamE1],
      chatMessages: {
        conv_maya_e1: [{ id: 'm1', conversationId: 'conv_maya_e1', senderId: 'maya', text: 'Hey', timestamp: '10:00' }],
        conv_maya_e2: [{ id: 'm2', conversationId: 'conv_maya_e2', senderId: 'maya', text: 'See you at e2', timestamp: '10:05' }],
        conv_liam_e1: [{ id: 'm3', conversationId: 'conv_liam_e1', senderId: 'liam', text: 'Yo', timestamp: '10:10' }]
      },
      connectionRequests: [
        makeReq('req_acc', 'e1', 'maya', 'alex', 'accepted'),
        makeReq('req_pend', 'e1', 'alex', 'maya', 'pending')
      ],
      removedChats: [],
      blockedUserIds: []
    };

    const afterLeave = applyRemoveConversations(initial, {
      partnerId: 'maya',
      eventId: 'e1',
      reason: 'left',
      nowIso: '2026-11-20T15:00:00.000Z'
    });

    assert.deepEqual(afterLeave.conversations.map((c) => c.id), ['conv_maya_e2', 'conv_liam_e1']);
    assert.equal(afterLeave.chatMessages['conv_maya_e1'], undefined);
    assert.ok(afterLeave.chatMessages['conv_maya_e2']);
    assert.equal(afterLeave.blockedUserIds.length, 0);
    assert.equal(afterLeave.removedChats.length, 1);
    assert.deepEqual(afterLeave.removedChats[0], {
      partnerId: 'maya',
      eventId: 'e1',
      reason: 'left',
      removedAt: '2026-11-20T15:00:00.000Z'
    });

    // Pending requests for left pair become withdrawn; accepted stays accepted (never reverts to pending)
    const acc = afterLeave.connectionRequests.find((r) => r.id === 'req_acc');
    const pend = afterLeave.connectionRequests.find((r) => r.id === 'req_pend');
    assert.equal(acc?.status, 'accepted');
    assert.equal(pend?.status, 'withdrawn');

    // Re-request rejection returns exact copy for left, allowed for e2
    assert.deepEqual(
      getRequestRejectionForRemovedChat('maya', 'e1', afterLeave.removedChats, afterLeave.blockedUserIds),
      { blocked: true, message: 'You left this chat.' }
    );
    assert.deepEqual(
      getRequestRejectionForRemovedChat('maya', 'e2', afterLeave.removedChats, afterLeave.blockedUserIds),
      { blocked: false, message: '' }
    );

    // Seed merge / refresh never resurrects left conversation
    const rehydrated = sanitizeChatSnapshot({
      ...afterLeave,
      conversations: [mayaE1, ...afterLeave.conversations],
      chatMessages: {
        ...afterLeave.chatMessages,
        conv_maya_e1: initial.chatMessages.conv_maya_e1
      }
    });
    assert.deepEqual(rehydrated.conversations.map((c) => c.id), ['conv_maya_e2', 'conv_liam_e1']);
    assert.equal(rehydrated.chatMessages['conv_maya_e1'], undefined);
  });

  it('blocking removes all chats across multiple events, deletes messages, removes sent/pending requests, and blocks silently', () => {
    const initial: ChatStateSnapshot = {
      conversations: [
        makeConv('c1', 'maya', 'Maya Lin', 'e1', 3),
        makeConv('c2', 'maya', 'Maya Lin', 'e2', 1),
        makeConv('c3', 'liam', 'Liam Patel', 'e1', 0)
      ],
      chatMessages: {
        c1: [{ id: 'm1', conversationId: 'c1', senderId: 'maya', text: 'Hey', timestamp: '10:00' }],
        c2: [{ id: 'm2', conversationId: 'c2', senderId: 'maya', text: 'Hey again', timestamp: '10:01' }],
        c3: [{ id: 'm3', conversationId: 'c3', senderId: 'liam', text: 'Yo', timestamp: '10:02' }]
      },
      connectionRequests: [
        makeReq('r_in', 'e3', 'maya', 'alex', 'pending'),
        makeReq('r_out', 'e4', 'alex', 'maya', 'pending'),
        makeReq('r_other', 'e1', 'liam', 'alex', 'pending')
      ],
      removedChats: [],
      blockedUserIds: []
    };

    const afterBlock = applyRemoveConversations(initial, {
      partnerId: 'maya',
      reason: 'blocked'
    });

    assert.deepEqual(afterBlock.conversations.map((c) => c.id), ['c3']);
    assert.equal(afterBlock.chatMessages['c1'], undefined);
    assert.equal(afterBlock.chatMessages['c2'], undefined);
    assert.deepEqual(afterBlock.connectionRequests.map((r) => r.id), ['r_other']);
    assert.deepEqual(afterBlock.blockedUserIds, ['maya']);
    assert.equal(isChatRemovedForPair('maya', 'e99', afterBlock.removedChats, afterBlock.blockedUserIds), true);

    assert.deepEqual(
      getRequestRejectionForRemovedChat('maya', 'e1', afterBlock.removedChats, afterBlock.blockedUserIds),
      { blocked: true, message: '' }
    );
  });

  it('reporting acts idempotently even when 0 conversations exist', () => {
    const emptySnapshot: ChatStateSnapshot = {
      conversations: [],
      chatMessages: {},
      connectionRequests: [makeReq('r1', 'e1', 'alex', 'maya', 'pending')],
      removedChats: [],
      blockedUserIds: []
    };

    const afterReport = applyRemoveConversations(emptySnapshot, {
      partnerId: 'maya',
      reason: 'reported'
    });

    assert.deepEqual(afterReport.conversations, []);
    assert.deepEqual(afterReport.connectionRequests, []);
    assert.deepEqual(afterReport.blockedUserIds, ['maya']);
    assert.equal(afterReport.removedChats[0].reason, 'reported');
    assert.equal(afterReport.removedChats[0].eventId, null);
  });

  it('unblocking removes blocked/reported records while keeping left records and without restoring old chats', () => {
    const start: ChatStateSnapshot = {
      conversations: [makeConv('c1', 'maya', 'Maya Lin', 'e1', 0)],
      chatMessages: {
        c1: [{ id: 'm1', conversationId: 'c1', senderId: 'maya', text: 'Hey', timestamp: '10:00' }]
      },
      connectionRequests: [],
      removedChats: [],
      blockedUserIds: []
    };

    const leftE1 = applyRemoveConversations(start, {
      partnerId: 'maya',
      eventId: 'e1',
      reason: 'left'
    });
    const blockedMaya = applyRemoveConversations(leftE1, {
      partnerId: 'maya',
      reason: 'blocked'
    });
    const unblocked = applyUnblockUser(blockedMaya, 'maya');

    assert.deepEqual(unblocked.blockedUserIds, []);
    assert.equal(unblocked.conversations.length, 0);
    assert.equal(Object.keys(unblocked.chatMessages).length, 0);
    // 'left' for e1 is preserved while 'blocked' is cleared
    assert.equal(unblocked.removedChats.length, 1);
    assert.equal(unblocked.removedChats[0].reason, 'left');
    assert.equal(unblocked.removedChats[0].eventId, 'e1');
    assert.equal(isChatRemovedForPair('maya', 'e1', unblocked.removedChats, unblocked.blockedUserIds), true);
    assert.equal(isChatRemovedForPair('maya', 'e2', unblocked.removedChats, unblocked.blockedUserIds), false);
  });
});

describe('Chat Crash Resilience & Corrupt Storage Recovery', () => {
  it('sanitizeChatSnapshot safely recovers from null entries, missing partner, and non-array chatMessages', () => {
    const corrupt = {
      conversations: [
        null,
        { id: 'bad_no_partner', eventId: 'e1' },
        { id: 'bad_null_partner', eventId: 'e1', partner: null },
        {
          id: 'good_partial',
          eventId: 'e2',
          partner: { id: 'p_ok', name: undefined },
          unreadCount: Number.NaN
        }
      ],
      chatMessages: {
        good_partial: [null, { id: 'm_ok', text: 'hey' }, { text: 'missing_id' }],
        bad_non_array: { not: 'an_array' },
        null_entry: null
      },
      connectionRequests: [null, { id: 'bad_req' }, makeReq('r_ok', 'e2', 'a', 'b', 'pending')],
      removedChats: [null, { reason: 'left' }],
      blockedUserIds: [null, 123, 'blocked_1']
    } as unknown as ChatStateSnapshot;

    const clean = sanitizeChatSnapshot(corrupt);
    assert.equal(clean.conversations.length, 1);
    assert.equal(clean.conversations[0].id, 'good_partial');
    assert.equal(clean.conversations[0].partner.name, 'Waterloo Student');
    assert.equal(clean.conversations[0].unreadCount, 0);
    assert.equal(clean.conversations[0].eventTitle, 'Campus Event');
    assert.equal(Array.isArray(clean.chatMessages['good_partial']), true);
    assert.equal(clean.chatMessages['good_partial'].length, 1);
    assert.equal(clean.chatMessages['good_partial'][0].text, 'hey');
    assert.equal(clean.chatMessages['bad_non_array'], undefined);
    assert.equal(clean.connectionRequests.length, 1);
    assert.deepEqual(clean.blockedUserIds, ['blocked_1']);
  });

  it('archive helpers, common lines, starters, and date utilities never throw on invalid inputs', () => {
    const arch = createArchivedConversationRecord({
      conversation: {
        id: 'c1',
        eventId: 'e1',
        eventTitle: undefined as unknown as string,
        eventDate: undefined as unknown as string,
        eventLocation: undefined as unknown as string
      },
      messages: null as unknown as [],
      closedAtMs: Number.NaN
    });
    assert.equal(Array.isArray(arch.messages), true);
    assert.equal(Number.isFinite(arch.closedAtMs), true);

    const purged = purgeExpiredArchivedConversations([
      null as unknown as typeof arch,
      { id: 'bad', closedAtMs: Number.NaN } as unknown as typeof arch,
      { ...arch, messages: undefined as unknown as [] }
    ]);
    assert.equal(purged.length, 1);
    assert.deepEqual(purged[0].messages, []);

    const lines = getBuddyCommonLines({
      user: {
        id: 'u1',
        name: 123 as unknown as string,
        personalityQuiz: {
          completed: true,
          preferenceBubbles: 'not-an-array' as unknown as []
        } as never
      } as never,
      partner: {
        id: 'p1',
        name: null as unknown as string,
        personalityQuiz: 'invalid-quiz' as never
      } as never
    });
    assert.ok(lines.length >= 1);

    const starters = getConversationStarters(
      { completed: true, preferenceBubbles: 'bad' as unknown as [] } as never,
      null as never,
      null,
      { id: 'p1', name: 42 as unknown as string, isVerifiedUWStudent: true } as never,
      undefined,
      'e1',
      undefined,
      false
    );
    assert.ok(starters.prompts.length >= 1);

    assert.equal(getFirstName(null), 'Student');
    assert.equal(getFirstName(123 as unknown as string), 'Student');
    assert.equal(Number.isNaN(getEventEndUtcMs({ date: 999 as unknown as string })), true);
    assert.equal(formatModalEventDateTime(undefined as unknown as string, undefined as unknown as string), '');

    const evalRes = evaluatePostEventChatAccess(null, NaN, Date.now());
    assert.equal(evalRes.isChatClosed, false);
  });
});

