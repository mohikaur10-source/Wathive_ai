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
