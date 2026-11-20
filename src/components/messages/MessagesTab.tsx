import React, { useEffect, useRef, useState } from 'react';
import {
  Send,
  Calendar,
  ArrowLeft,
  MoreHorizontal,
  X,
  ChevronDown,
  ChevronUp,
  Check
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { AttendeeProfile } from '../../types';
import { getTorontoNow } from '../../utils/timeZone';
import { safeMediaUrl } from '../../utils/urlSafety';
import { Goose } from '../common/Goose';
import { ReportModal } from '../common/ReportModal';
import { EventDetailModal } from '../feed/EventDetailModal';

interface MessagesTabProps {
  onViewEvent?: (eventId: string) => void;
}

const SAFETY_NOTE_STORAGE_KEY = 'wathive_chat_safety_dismissed';

const getFirstName = (fullName: string) => fullName.trim().split(/\s+/)[0] || fullName;

export const MessagesTab: React.FC<MessagesTabProps> = () => {
  const {
    user,
    upcomingEvents,
    allAttendees,
    conversations,
    connectionRequests,
    respondConnectionRequest,
    withdrawConnectionRequest,
    chatMessages,
    sendMessage,
    removeConversations,
    blockUser,
    dailyBuddyRequestsCount,
    maxDailyRequests
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<'conversations' | 'requests'>('conversations');
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(() => {
    if (typeof window !== 'undefined' && window.innerWidth >= 768 && conversations.length > 0) {
      return conversations[0].id;
    }
    return null;
  });
  const [inputText, setInputText] = useState('');
  const [expandedRequestIds, setExpandedRequestIds] = useState<Record<string, boolean>>({});
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<{ type: 'user'; attendee: AttendeeProfile } | null>(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [viewingEventId, setViewingEventId] = useState<string | null>(null);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [blockTarget, setBlockTarget] = useState<{ id: string; name: string } | null>(null);
  const [toastMessage, setToastMessage] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);
  const [safetyDismissed, setSafetyDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SAFETY_NOTE_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });

  const menuContainerRef = useRef<HTMLDivElement | null>(null);
  const chatHeaderMenuBtnRef = useRef<HTMLButtonElement | null>(null);
  const lastTriggerRef = useRef<HTMLElement | null>(null);
  const chatListRef = useRef<HTMLDivElement | null>(null);
  const prevConversationsRef = useRef(conversations);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage('');
      toastTimerRef.current = null;
    }, 3200);
  };

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  // Keep selectedConversationId valid whenever conversations shrink (leave / block / report / cross-tab)
  useEffect(() => {
    const prevConvs = prevConversationsRef.current;
    prevConversationsRef.current = conversations;

    if (!selectedConversationId) return;
    const stillExists = conversations.some((c) => c.id === selectedConversationId);
    if (stillExists) return;

    const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;
    if (!isDesktop || conversations.length === 0) {
      setSelectedConversationId(null);
      window.setTimeout(() => chatListRef.current?.focus(), 0);
      return;
    }

    const prevIdx = prevConvs.findIndex((c) => c.id === selectedConversationId);
    const nextIdx = Math.min(prevIdx >= 0 ? prevIdx : 0, conversations.length - 1);
    setSelectedConversationId(conversations[nextIdx]?.id ?? null);
  }, [conversations, selectedConversationId]);

  useEffect(() => {
    if (!openMenuId) return;
    const handleOutside = (e: MouseEvent) => {
      if (menuContainerRef.current && !menuContainerRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [openMenuId]);

  // Esc handling & focus restoration for Leave / Block confirmation dialogs
  useEffect(() => {
    if (!leaveConfirmOpen && !blockTarget) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setLeaveConfirmOpen(false);
        setBlockTarget(null);
        setIsConfirming(false);
        window.setTimeout(() => lastTriggerRef.current?.focus(), 0);
      }
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [leaveConfirmOpen, blockTarget]);

  const incomingPendingRequests = connectionRequests.filter(
    (r) => r.recipientId === user?.id && r.status === 'pending'
  );
  const outgoingRequests = connectionRequests.filter(
    (r) => r.senderId === user?.id
  );
  const pendingIncomingCount = incomingPendingRequests.length;

  const selectedConversation = conversations.find(
    (c) => c.id === selectedConversationId
  );

  const currentMessages = selectedConversationId
    ? chatMessages[selectedConversationId] || []
    : [];

  const torontoTodayStr = getTorontoNow().dateStr;

  const linkedUpcomingEvent = selectedConversation
    ? upcomingEvents.find((e) => e.id === selectedConversation.eventId) || null
    : null;

  const isEventEnded = Boolean(
    selectedConversation &&
      !linkedUpcomingEvent &&
      (selectedConversation.eventDate < torontoTodayStr || !selectedConversation.eventDate)
  );

  const viewingEvent = viewingEventId
    ? upcomingEvents.find((e) => e.id === viewingEventId) || null
    : null;

  const isBrandNewChat = Boolean(
    selectedConversation &&
      currentMessages.length <= 2 &&
      !selectedConversation.isChatClosedPostEvent &&
      !isEventEnded
  );

  const dismissSafetyNote = () => {
    setSafetyDismissed(true);
    try {
      localStorage.setItem(SAFETY_NOTE_STORAGE_KEY, '1');
    } catch {
      // ignore storage failure
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !selectedConversationId) return;
    sendMessage(selectedConversationId, inputText);
    setInputText('');
  };

  const computeNextSelectedId = (removedIds: string[]) => {
    if (!selectedConversationId || !removedIds.includes(selectedConversationId)) {
      return selectedConversationId;
    }
    const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;
    if (!isDesktop) return null;
    const oldIdx = conversations.findIndex((c) => c.id === selectedConversationId);
    const remaining = conversations.filter((c) => !removedIds.includes(c.id));
    if (remaining.length === 0) return null;
    return remaining[Math.min(oldIdx >= 0 ? oldIdx : 0, remaining.length - 1)].id;
  };

  const handleConfirmLeaveChat = () => {
    if (!selectedConversation || isConfirming) return;
    setIsConfirming(true);
    const nextId = computeNextSelectedId([selectedConversation.id]);
    removeConversations({
      partnerId: selectedConversation.partner.id,
      eventId: selectedConversation.eventId,
      reason: 'left'
    });
    setLeaveConfirmOpen(false);
    setOpenMenuId(null);
    setSelectedConversationId(nextId);
    setIsConfirming(false);
    showToast('You left the chat.');
    window.setTimeout(() => {
      if (nextId) {
        chatHeaderMenuBtnRef.current?.focus();
      } else {
        chatListRef.current?.focus();
      }
    }, 0);
  };

  const handleConfirmBlock = () => {
    if (!blockTarget || isConfirming) return;
    setIsConfirming(true);
    const removedIds = conversations
      .filter((c) => c.partner.id === blockTarget.id)
      .map((c) => c.id);
    const nextId = computeNextSelectedId(removedIds);
    blockUser(blockTarget.id);
    setBlockTarget(null);
    setOpenMenuId(null);
    setSelectedConversationId(nextId);
    setIsConfirming(false);
    showToast('Blocked.');
    window.setTimeout(() => {
      if (nextId) {
        chatHeaderMenuBtnRef.current?.focus();
      } else {
        chatListRef.current?.focus();
      }
    }, 0);
  };

  const toggleExpandRequest = (id: string) => {
    setExpandedRequestIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const closedComposerMessage = selectedConversation?.isChatClosedPostEvent
    ? 'Chat closed.'
    : isEventEnded
    ? 'Event ended.'
    : null;

  return (
    <div className="max-w-5xl mx-auto w-full h-[calc(100vh-9.5rem)] md:h-[calc(100vh-7.5rem)] flex flex-col relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 bg-surface text-ink text-xs font-semibold rounded-2xl shadow-lift border border-accent flex items-center gap-2"
        >
          <Check className="w-4 h-4 text-accent-text stroke-[2.5] shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-3 pb-4 border-b border-line shrink-0">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink tracking-tight">
          Buddy Buzz
        </h1>

        <div className="flex items-center p-1 bg-surface rounded-2xl border border-line shadow-soft">
          <button
            type="button"
            onClick={() => setActiveSubTab('conversations')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-colors cursor-pointer ${
              activeSubTab === 'conversations'
                ? 'bg-accent text-accent-ink'
                : 'text-muted hover:text-ink'
            }`}
          >
            Chats
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('requests')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'requests'
                ? 'bg-accent text-accent-ink'
                : 'text-muted hover:text-ink'
            }`}
          >
            <span>Requests</span>
            {pendingIncomingCount > 0 && (
              <span className="min-w-4 h-4 px-1 rounded-full bg-ink text-canvas text-[10px] font-bold flex items-center justify-center tabular-nums">
                {pendingIncomingCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {dailyBuddyRequestsCount >= maxDailyRequests && (
        <p className="text-xs text-muted pt-2.5 shrink-0">Daily limit reached.</p>
      )}

      {/* Main Content */}
      {activeSubTab === 'requests' ? (
        <div className="flex-1 overflow-y-auto pt-4 space-y-6 pr-1 filters-scroll">
          {incomingPendingRequests.length === 0 ? (
            <div className="py-10 px-6 bg-surface rounded-3xl border border-line shadow-soft flex flex-col items-center text-center gap-2">
              <Goose size={84} state="looking" />
              <p className="text-sm font-medium text-ink">No requests right now.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {incomingPendingRequests.map((req) => {
                const isExpanded = Boolean(expandedRequestIds[req.id]);
                const hasReasons = Boolean(req.compatibilityReasons && req.compatibilityReasons.length > 0);
                const isMenuOpen = openMenuId === `req_${req.id}`;
                const avatarSrc = safeMediaUrl(req.senderAvatar) || '';

                return (
                  <div
                    key={req.id}
                    className="bg-surface rounded-2xl border border-line shadow-soft p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => hasReasons && toggleExpandRequest(req.id)}
                        className={`flex items-start gap-3 min-w-0 flex-1 text-left ${
                          hasReasons ? 'cursor-pointer' : 'cursor-default'
                        }`}
                      >
                        <img
                          src={avatarSrc}
                          alt={req.senderName}
                          referrerPolicy="no-referrer"
                          className="w-10 h-10 rounded-full object-cover ring-2 ring-accent shrink-0 bg-surface-soft"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm text-ink truncate">
                              {req.senderName}
                            </span>
                            {typeof req.compatibilityScore === 'number' && (
                              <span className="text-[11px] bg-accent-soft text-accent-text font-semibold px-2 py-0.5 rounded-full tabular-nums">
                                {req.compatibilityScore}% match
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted truncate mt-0.5 flex items-center gap-1">
                            <Calendar className="w-3 h-3 shrink-0 text-accent-text" />
                            <span className="truncate">{req.eventTitle}</span>
                            {hasReasons && (
                              isExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5 shrink-0 ml-1" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5 shrink-0 ml-1" />
                              )
                            )}
                          </p>
                        </div>
                      </button>

                      <div className="flex items-center gap-1.5 shrink-0" ref={isMenuOpen ? menuContainerRef : undefined}>
                        <button
                          type="button"
                          onClick={() => respondConnectionRequest(req.id, 'decline')}
                          className="px-3 py-1.5 rounded-xl border border-line hover:bg-surface-soft text-muted hover:text-ink text-xs font-semibold transition-colors cursor-pointer"
                        >
                          Decline
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            respondConnectionRequest(req.id, 'accept');
                            setActiveSubTab('conversations');
                          }}
                          className="px-3.5 py-1.5 rounded-xl bg-accent hover:bg-accent-hover text-accent-ink text-xs font-bold transition-colors shadow-soft cursor-pointer"
                        >
                          Accept
                        </button>

                        <div className="relative">
                          <button
                            type="button"
                            onClick={(e) => {
                              lastTriggerRef.current = e.currentTarget;
                              setOpenMenuId(isMenuOpen ? null : `req_${req.id}`);
                            }}
                            className="p-1.5 text-muted hover:text-ink rounded-xl hover:bg-surface-soft transition-colors cursor-pointer"
                            aria-label="More actions"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </button>

                          {isMenuOpen && (
                            <div className="absolute right-0 mt-1 w-36 bg-surface border border-line rounded-xl shadow-lift py-1 z-20 text-xs">
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenMenuId(null);
                                  setBlockTarget({ id: req.senderId, name: req.senderName });
                                }}
                                className="w-full text-left px-3 py-2 text-ink hover:bg-surface-soft cursor-pointer"
                              >
                                Block
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setReportTarget({
                                    type: 'user',
                                    attendee: {
                                      id: req.senderId,
                                      name: req.senderName,
                                      avatar: req.senderAvatar,
                                      faculty: req.senderFaculty,
                                      year: req.senderYear,
                                      isVerifiedUWStudent: true
                                    }
                                  });
                                  setReportModalOpen(true);
                                  setOpenMenuId(null);
                                }}
                                className="w-full text-left px-3 py-2 text-danger hover:bg-danger-soft cursor-pointer"
                              >
                                Report
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {isExpanded && hasReasons && (
                      <div className="pt-2 border-t border-line flex flex-wrap gap-1.5 text-xs">
                        {req.compatibilityReasons!.map((reason, idx) => (
                          <span
                            key={idx}
                            className="px-2.5 py-1 rounded-lg bg-surface-soft text-ink border border-line"
                          >
                            {reason}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Compact Sent list */}
          {outgoingRequests.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-line">
              <h2 className="text-xs font-semibold text-muted">Sent</h2>
              <div className="space-y-2">
                {outgoingRequests.map((req) => {
                  const recipientAvatar = safeMediaUrl(allAttendees[req.recipientId]?.avatar) || '';
                  const statusLabel =
                    req.status === 'expired'
                      ? 'Expired'
                      : req.status.charAt(0).toUpperCase() + req.status.slice(1);

                  return (
                    <div
                      key={req.id}
                      className="px-3.5 py-2.5 bg-surface rounded-2xl border border-line flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {recipientAvatar ? (
                          <img
                            src={recipientAvatar}
                            alt={req.recipientName}
                            referrerPolicy="no-referrer"
                            className="w-8 h-8 rounded-full object-cover shrink-0 bg-surface-soft"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-surface-soft text-ink font-semibold flex items-center justify-center shrink-0">
                            {req.recipientName.charAt(0)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-semibold text-ink truncate">{req.recipientName}</p>
                          <p className="text-muted truncate">{req.eventTitle}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0">
                        <span
                          className={`font-medium ${
                            req.status === 'accepted'
                              ? 'text-accent-text'
                              : req.status === 'declined'
                              ? 'text-danger'
                              : 'text-muted'
                          }`}
                        >
                          {statusLabel}
                        </span>
                        {req.status === 'pending' && (
                          <button
                            type="button"
                            onClick={() => withdrawConnectionRequest(req.id)}
                            className="px-2.5 py-1 rounded-lg border border-line text-muted hover:text-danger hover:border-danger/40 font-semibold transition-colors cursor-pointer"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Chats Tab */
        <div className="flex-1 flex overflow-hidden pt-4 gap-4">
          {/* Conversation list */}
          <div
            ref={chatListRef}
            tabIndex={-1}
            className={`w-full md:w-80 lg:w-96 flex flex-col shrink-0 bg-surface rounded-3xl border border-line shadow-soft overflow-hidden focus:outline-none ${
              selectedConversationId ? 'hidden md:flex' : 'flex'
            }`}
          >
            <div className="flex-1 overflow-y-auto divide-y divide-line filters-scroll">
              {conversations.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-8 text-center gap-2">
                  <Goose size={84} state="looking" />
                  <p className="text-sm font-medium text-ink">
                    No buddies yet. Find an event and make a friend.
                  </p>
                </div>
              ) : (
                conversations.map((conv) => {
                  const isSelected = conv.id === selectedConversationId;
                  const avatarSrc = safeMediaUrl(conv.partner.avatar) || '';

                  return (
                    <button
                      type="button"
                      key={conv.id}
                      onClick={() => {
                        setSelectedConversationId(conv.id);
                        setOpenMenuId(null);
                      }}
                      className={`w-full text-left px-4 py-3.5 hover:bg-surface-soft/50 transition-colors cursor-pointer flex items-center gap-3 border-l-4 ${
                        isSelected
                          ? 'bg-accent-soft/60 border-l-accent'
                          : 'border-l-transparent'
                      }`}
                    >
                      <img
                        src={avatarSrc}
                        alt={conv.partner.name}
                        referrerPolicy="no-referrer"
                        className="w-10 h-10 rounded-full object-cover ring-2 ring-accent/70 shrink-0 bg-surface-soft"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-sm text-ink truncate">
                            {conv.partner.name}
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[11px] text-muted">{conv.lastMessageTime}</span>
                            {conv.unreadCount > 0 && (
                              <span
                                className="w-2 h-2 rounded-full bg-accent shrink-0"
                                aria-label="Unread message"
                              />
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-muted truncate mt-0.5">{conv.lastMessage}</p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Active Chat Panel */}
          <div
            className={`flex-1 flex flex-col bg-surface rounded-3xl border border-line shadow-soft overflow-hidden ${
              !selectedConversationId ? 'hidden md:flex' : 'flex'
            }`}
          >
            {selectedConversation ? (
              <>
                {/* Chat Header */}
                <div className="px-4 py-3 border-b border-line bg-surface-soft/30 flex items-center justify-between gap-2 shrink-0">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedConversationId(null);
                        setOpenMenuId(null);
                      }}
                      className="md:hidden p-1.5 text-muted hover:text-ink rounded-xl hover:bg-surface-soft cursor-pointer"
                      aria-label="Back to chats"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>

                    <img
                      src={safeMediaUrl(selectedConversation.partner.avatar) || ''}
                      alt={selectedConversation.partner.name}
                      referrerPolicy="no-referrer"
                      className="w-9 h-9 rounded-full object-cover ring-2 ring-accent shrink-0 bg-surface-soft"
                    />

                    <div className="min-w-0 flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-sm text-ink truncate">
                        {selectedConversation.partner.name}
                      </h3>

                      {linkedUpcomingEvent ? (
                        <button
                          type="button"
                          onClick={() => setViewingEventId(linkedUpcomingEvent.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-accent-soft text-accent-text text-xs font-medium hover:bg-accent hover:text-accent-ink transition-colors max-w-[200px] truncate cursor-pointer"
                        >
                          <Calendar className="w-3 h-3 shrink-0" />
                          <span className="truncate">{selectedConversation.eventTitle}</span>
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-surface-soft text-muted text-xs font-medium max-w-[220px] truncate">
                          <span className="truncate">{selectedConversation.eventTitle}</span>
                          <span>· Ended</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* "..." Menu */}
                  <div
                    className="relative shrink-0"
                    ref={openMenuId === 'chat_header' ? menuContainerRef : undefined}
                  >
                    <button
                      ref={chatHeaderMenuBtnRef}
                      type="button"
                      onClick={(e) => {
                        lastTriggerRef.current = e.currentTarget;
                        setOpenMenuId(openMenuId === 'chat_header' ? null : 'chat_header');
                      }}
                      className="p-2 text-muted hover:text-ink hover:bg-surface-soft rounded-xl transition-colors cursor-pointer"
                      aria-label="Chat options"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>

                    {openMenuId === 'chat_header' && (
                      <div className="absolute right-0 mt-1 w-36 bg-surface border border-line rounded-xl shadow-lift py-1 z-20 text-xs">
                        <button
                          type="button"
                          onClick={() => {
                            lastTriggerRef.current = chatHeaderMenuBtnRef.current;
                            setOpenMenuId(null);
                            setLeaveConfirmOpen(true);
                          }}
                          className="w-full text-left px-3 py-2 text-ink hover:bg-surface-soft cursor-pointer"
                        >
                          Leave chat
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            lastTriggerRef.current = chatHeaderMenuBtnRef.current;
                            setOpenMenuId(null);
                            setBlockTarget({
                              id: selectedConversation.partner.id,
                              name: selectedConversation.partner.name
                            });
                          }}
                          className="w-full text-left px-3 py-2 text-ink hover:bg-surface-soft cursor-pointer"
                        >
                          Block
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setReportTarget({
                              type: 'user',
                              attendee: selectedConversation.partner
                            });
                            setReportModalOpen(true);
                            setOpenMenuId(null);
                          }}
                          className="w-full text-left px-3 py-2 text-danger hover:bg-danger-soft cursor-pointer"
                        >
                          Report
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* One-time dismissible safety note on brand-new chat */}
                {isBrandNewChat && !safetyDismissed && (
                  <div className="px-4 py-1.5 bg-canvas border-b border-line text-xs text-muted flex items-center justify-between gap-2 shrink-0">
                    <span>Meet in public. Leave or block anytime.</span>
                    <button
                      type="button"
                      onClick={dismissSafetyNote}
                      className="p-1 text-muted hover:text-ink rounded-lg cursor-pointer"
                      aria-label="Dismiss note"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 filters-scroll">
                  {currentMessages.map((msg) => {
                    const isMe = msg.senderId === user?.id;
                    const isSystem = msg.senderId === 'system';

                    if (isSystem) {
                      return (
                        <div key={msg.id} className="text-center py-1">
                          <span className="text-xs text-muted bg-surface-soft px-3 py-1 rounded-xl">
                            {msg.text}
                          </span>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-xs sm:text-sm leading-relaxed ${
                            isMe
                              ? 'bg-accent text-accent-ink rounded-br-sm font-medium shadow-soft'
                              : 'bg-surface-soft text-ink rounded-bl-sm'
                          }`}
                        >
                          <p>{msg.text}</p>
                        </div>
                        <span className="text-[11px] text-muted mt-1 px-1">
                          {msg.timestamp}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Composer or single-line closed state */}
                {closedComposerMessage ? (
                  <div className="p-3.5 bg-surface-soft/40 border-t border-line text-xs text-muted text-center shrink-0">
                    {closedComposerMessage}
                  </div>
                ) : (
                  <form
                    onSubmit={handleSendMessage}
                    className="p-3 border-t border-line bg-surface flex items-center gap-2 shrink-0"
                  >
                    <input
                      type="text"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder="Write a message..."
                      className="flex-1 px-4 py-2.5 rounded-2xl border border-line bg-canvas text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent text-xs sm:text-sm"
                    />
                    <button
                      type="submit"
                      disabled={!inputText.trim()}
                      className="px-4 py-2.5 bg-accent hover:bg-accent-hover disabled:opacity-40 text-accent-ink rounded-2xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-soft cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Send</span>
                    </button>
                  </form>
                )}
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-2">
                <Goose size={92} state="looking" />
                <p className="text-sm font-medium text-ink">
                  No buddies yet. Find an event and make a friend.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Leave Chat Confirmation Dialog */}
      {leaveConfirmOpen && selectedConversation && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="leave-chat-dialog-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setLeaveConfirmOpen(false);
              window.setTimeout(() => lastTriggerRef.current?.focus(), 0);
            }
          }}
        >
          <div className="bg-surface text-ink rounded-3xl max-w-sm w-full p-6 shadow-lift border border-line space-y-4">
            <h3 id="leave-chat-dialog-title" className="font-display font-bold text-ink text-lg">
              Leave this chat?
            </h3>
            <p className="text-xs text-muted">
              It will be removed from your list.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setLeaveConfirmOpen(false);
                  window.setTimeout(() => lastTriggerRef.current?.focus(), 0);
                }}
                className="px-4 py-2 text-xs font-semibold text-muted hover:text-ink rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isConfirming}
                onClick={handleConfirmLeaveChat}
                className="px-4 py-2 bg-danger text-white font-bold rounded-xl text-xs shadow-soft cursor-pointer hover:opacity-90 disabled:opacity-50"
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Block User Confirmation Dialog */}
      {blockTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="block-user-dialog-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setBlockTarget(null);
              window.setTimeout(() => lastTriggerRef.current?.focus(), 0);
            }
          }}
        >
          <div className="bg-surface text-ink rounded-3xl max-w-sm w-full p-6 shadow-lift border border-line space-y-4">
            <h3 id="block-user-dialog-title" className="font-display font-bold text-ink text-lg">
              Block {getFirstName(blockTarget.name)}?
            </h3>
            <p className="text-xs text-muted">
              Their chats will be removed.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setBlockTarget(null);
                  window.setTimeout(() => lastTriggerRef.current?.focus(), 0);
                }}
                className="px-4 py-2 text-xs font-semibold text-muted hover:text-ink rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isConfirming}
                onClick={handleConfirmBlock}
                className="px-4 py-2 bg-danger text-white font-bold rounded-xl text-xs shadow-soft cursor-pointer hover:opacity-90 disabled:opacity-50"
              >
                Block
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Safety Report Modal */}
      {reportTarget && (
        <ReportModal
          isOpen={reportModalOpen}
          targetType={reportTarget.type}
          attendee={reportTarget.attendee}
          onClose={() => {
            setReportModalOpen(false);
            setReportTarget(null);
          }}
          onSuccess={(action) => {
            showToast(action === 'block' ? 'Blocked.' : 'Reported. Chat removed.');
            setReportModalOpen(false);
            setReportTarget(null);
          }}
        />
      )}

      {/* Active Event Detail Modal */}
      {viewingEvent && (
        <EventDetailModal
          isOpen={Boolean(viewingEvent)}
          event={viewingEvent}
          onClose={() => setViewingEventId(null)}
        />
      )}
    </div>
  );
};
