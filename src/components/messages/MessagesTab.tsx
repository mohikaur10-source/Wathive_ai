import React, { useEffect, useRef, useState } from 'react';
import {
  Send,
  Calendar,
  ArrowLeft,
  MoreHorizontal,
  X,
  Check,
  Sparkles,
  Archive,
  ChevronDown
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { AttendeeProfile } from '../../types';
import { safeMediaUrl } from '../../utils/urlSafety';
import {
  DEFAULT_ALEX_QUIZ,
  getConversationStarters
} from '../../utils/compatibilityEngine';
import { Goose } from '../common/Goose';
import { ReportModal } from '../common/ReportModal';
import { EventDetailModal } from '../feed/EventDetailModal';
import { ManageBuddyModal } from './ManageBuddyModal';
import { BUDDY_POLICY } from '../../config/buddyPolicy';
import { getEventEndUtcMs, isEventPast } from '../../utils/eventLifecycle';
import { getPairingDisplayState } from '../../utils/pairingLogic';
import { evaluatePostEventChatAccess } from '../../utils/postEventChat';
import { getFirstName } from '../../utils/buddySeeding';
import { getBuddyCommonLines } from '../../utils/pairingLifecycle';
import { formatModalEventDateTime } from '../../utils/timeZone';
import { ErrorBoundary } from '../common/ErrorBoundary';

interface MessagesTabProps {
  onViewEvent?: (eventId: string) => void;
  initialSubTab?: 'conversations' | 'requests';
  requestedConversationId?: string | null;
  onClearRequestedConversation?: () => void;
}

const SAFETY_NOTE_STORAGE_KEY = 'wathive_chat_safety_dismissed';

export const MessagesTab: React.FC<MessagesTabProps> = ({
  requestedConversationId,
  onClearRequestedConversation
}) => {
  const {
    user,
    upcomingEvents,
    allAttendees,
    conversations,
    archivedConversations,
    chatMessages,
    typingConversationIds,
    chatErrors,
    sendMessage,
    markConversationRead,
    blockUser,
    confirmPairing,
    rematchBuddyForEvent,
    leaveBuddyMatchingFromChat,
    cancelRsvpFromChat,
    toggleStayConnected,
    getEventById,
    effectiveNowMs,
    eventSocialBattery
  } = useApp();

  const safeConversations = React.useMemo(
    () =>
      Array.isArray(conversations)
        ? conversations.filter((c) => Boolean(c && c.id && c.partner && c.partner.id))
        : [],
    [conversations]
  );

  const safeArchives = React.useMemo(
    () =>
      Array.isArray(archivedConversations)
        ? archivedConversations.filter((a) => Boolean(a && a.id))
        : [],
    [archivedConversations]
  );

  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(() => {
    if (typeof window !== 'undefined' && window.innerWidth >= 768 && safeConversations.length > 0) {
      return safeConversations[0].id;
    }
    return null;
  });
  const [selectedArchiveId, setSelectedArchiveId] = useState<string | null>(null);
  const [archiveExpanded, setArchiveExpanded] = useState(false);
  const [manageModalOpen, setManageModalOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<{ type: 'user'; attendee: AttendeeProfile } | null>(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [viewingEventId, setViewingEventId] = useState<string | null>(null);
  const [blockTarget, setBlockTarget] = useState<{ id: string; name: string } | null>(null);
  const [toastMessage, setToastMessage] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);
  const [startersOpen, setStartersOpen] = useState(false);
  const [safetyDismissed, setSafetyDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SAFETY_NOTE_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });

  const menuContainerRef = useRef<HTMLDivElement | null>(null);
  const chatHeaderMenuBtnRef = useRef<HTMLButtonElement | null>(null);
  const messageInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const lastTriggerRef = useRef<HTMLElement | null>(null);
  const chatListRef = useRef<HTMLDivElement | null>(null);
  const prevConversationsRef = useRef(safeConversations);
  const toastTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!requestedConversationId) return;
    if (safeConversations.some((c) => c.id === requestedConversationId)) {
      setSelectedArchiveId(null);
      setSelectedConversationId(requestedConversationId);
    }
    onClearRequestedConversation?.();
  }, [requestedConversationId, safeConversations, onClearRequestedConversation]);

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

  // Keep selectedConversationId valid whenever conversations change (add on accept or shrink on leave/block)
  useEffect(() => {
    const prevConvs = prevConversationsRef.current;
    prevConversationsRef.current = safeConversations;

    // If a brand new conversation was prepended (e.g. after matching), auto-select it
    if (
      safeConversations.length > prevConvs.length &&
      safeConversations[0] &&
      !prevConvs.some((c) => c.id === safeConversations[0].id)
    ) {
      setSelectedArchiveId(null);
      setSelectedConversationId(safeConversations[0].id);
      return;
    }

    if (!selectedConversationId) return;
    const stillExists = safeConversations.some((c) => c.id === selectedConversationId);
    if (stillExists) return;

    const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;
    if (!isDesktop || safeConversations.length === 0) {
      setSelectedConversationId(null);
      window.setTimeout(() => chatListRef.current?.focus(), 0);
      return;
    }

    const prevIdx = prevConvs.findIndex((c) => c.id === selectedConversationId);
    const nextIdx = Math.min(prevIdx >= 0 ? prevIdx : 0, safeConversations.length - 1);
    setSelectedConversationId(safeConversations[nextIdx]?.id ?? null);
  }, [safeConversations, selectedConversationId]);

  useEffect(() => {
    if (
      selectedArchiveId &&
      !safeArchives.some((a) => a.id === selectedArchiveId)
    ) {
      setSelectedArchiveId(null);
    }
  }, [safeArchives, selectedArchiveId]);

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

  // Esc handling & focus restoration for Block confirmation dialog
  useEffect(() => {
    if (!blockTarget) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setBlockTarget(null);
        setIsConfirming(false);
        window.setTimeout(() => lastTriggerRef.current?.focus(), 0);
      }
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [blockTarget]);

  const selectedConversation = safeConversations.find(
    (c) => c.id === selectedConversationId
  );

  const selectedArchive = safeArchives.find(
    (a) => a.id === selectedArchiveId
  );

  const rawMessagesForConv = selectedConversationId
    ? chatMessages?.[selectedConversationId]
    : null;
  const currentMessages = Array.isArray(rawMessagesForConv)
    ? rawMessagesForConv.filter((m) => Boolean(m && typeof m === 'object' && m.id))
    : [];

  const isPartnerTyping = Boolean(
    selectedConversationId && typingConversationIds?.[selectedConversationId]
  );
  const currentChatError = selectedConversationId
    ? chatErrors?.[selectedConversationId] || ''
    : '';

  useEffect(() => {
    setStartersOpen(false);
  }, [selectedConversationId]);

  useEffect(() => {
    if (selectedConversation && (selectedConversation.unreadCount || 0) > 0) {
      markConversationRead(selectedConversation.id);
    }
  }, [selectedConversation, markConversationRead]);

  useEffect(() => {
    try {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    } catch {
      // ignore scroll failure in unsupported or unmounted views
    }
  }, [selectedConversationId, currentMessages.length, isPartnerTyping]);

  const linkedEvent = selectedConversation
    ? getEventById(selectedConversation.eventId) || null
    : null;

  const linkedUpcomingEvent =
    selectedConversation &&
    linkedEvent &&
    !isEventPast(linkedEvent, new Date(effectiveNowMs))
      ? linkedEvent
      : selectedConversation
      ? upcomingEvents.find((e) => e.id === selectedConversation.eventId) || null
      : null;

  const eventEndMs = (() => {
    if (!selectedConversation) return NaN;
    try {
      return getEventEndUtcMs(
        linkedEvent || {
          date: selectedConversation.eventDate
        }
      );
    } catch {
      return NaN;
    }
  })();

  const postEventEval = (() => {
    try {
      return evaluatePostEventChatAccess(
        selectedConversation,
        eventEndMs,
        effectiveNowMs,
        {
          policy: BUDDY_POLICY,
          explicitEnded: Boolean(
            selectedConversation &&
              (linkedEvent ? isEventPast(linkedEvent, new Date(effectiveNowMs)) : !linkedUpcomingEvent)
          )
        }
      );
    } catch {
      return {
        mode: BUDDY_POLICY.postEventChatAccess,
        isEventEnded: false,
        isChatClosed: false,
        showStayConnectedBar: false,
        remainingHours: 0,
        statusLineText: null,
        closedBannerText: null
      };
    }
  })();

  const isEventEnded = postEventEval.isEventEnded;
  const pairingState = getPairingDisplayState(selectedConversation);

  const viewingEvent = viewingEventId
    ? getEventById(viewingEventId) || upcomingEvents.find((e) => e.id === viewingEventId) || null
    : null;

  const isBrandNewChat = Boolean(
    selectedConversation && currentMessages.length <= 2
  );

  const hasUserSentMessage = Boolean(
    selectedConversation &&
      user &&
      currentMessages.some((m) => m.senderId === user.id)
  );

  const selectedPartnerId = selectedConversation?.partner?.id || '';
  const selectedPartnerProfile = selectedConversation
    ? (selectedPartnerId && allAttendees?.[selectedPartnerId]) || selectedConversation.partner
    : null;

  const commonIntroLines = (() => {
    if (!selectedConversation) return [];
    try {
      return getBuddyCommonLines({
        user,
        partner: selectedPartnerProfile
      });
    } catch {
      return ['Both verified Waterloo students', 'Heading to the same campus event'];
    }
  })();

  const linkedEventDateLabel = (() => {
    if (linkedEvent) {
      return formatModalEventDateTime(linkedEvent.date, linkedEvent.startTime, linkedEvent.endTime);
    }
    return selectedConversation?.eventDate || '';
  })();

  // Compute similarities & suggested conversation starters on demand for the active chat
  const selectedChatStarters = (() => {
    if (!selectedConversation || !selectedPartnerProfile) return null;
    try {
      return getConversationStarters(
        user?.personalityQuiz || DEFAULT_ALEX_QUIZ,
        selectedPartnerProfile.personalityQuiz,
        user,
        selectedPartnerProfile,
        eventSocialBattery?.[selectedConversation.eventId] || selectedConversation.socialBattery,
        selectedConversation.eventId,
        selectedConversation.eventTitle,
        isEventEnded
      );
    } catch {
      return null;
    }
  })();

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
    const oldIdx = safeConversations.findIndex((c) => c.id === selectedConversationId);
    const remaining = safeConversations.filter((c) => !removedIds.includes(c.id));
    if (remaining.length === 0) return null;
    return remaining[Math.min(oldIdx >= 0 ? oldIdx : 0, remaining.length - 1)].id;
  };

  const handleManageRematch = () => {
    if (!selectedConversation) return;
    const nextId = computeNextSelectedId([selectedConversation.id]);
    const res = rematchBuddyForEvent(selectedConversation.id);
    setSelectedConversationId(nextId);
    showToast(res.message);
  };

  const handleManageNoLongerNeed = () => {
    if (!selectedConversation) return;
    const nextId = computeNextSelectedId([selectedConversation.id]);
    const res = leaveBuddyMatchingFromChat(selectedConversation.id);
    setSelectedConversationId(nextId);
    showToast(res.message);
  };

  const handleManageUnableToAttend = () => {
    if (!selectedConversation) return;
    const nextId = computeNextSelectedId([selectedConversation.id]);
    const res = cancelRsvpFromChat(selectedConversation.id);
    setSelectedConversationId(nextId);
    showToast(res.message);
  };

  const formatClosedDate = (closedAtMs: number): string => {
    if (typeof closedAtMs !== 'number' || !Number.isFinite(closedAtMs)) {
      return 'recently';
    }
    try {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Toronto',
        month: 'short',
        day: 'numeric'
      }).format(new Date(closedAtMs));
    } catch {
      const d = new Date(closedAtMs);
      return Number.isNaN(d.getTime()) ? 'recently' : d.toLocaleDateString();
    }
  };

  const handleConfirmBlock = () => {
    if (!blockTarget || isConfirming) return;
    setIsConfirming(true);
    const removedIds = safeConversations
      .filter((c) => c.partner?.id === blockTarget.id)
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
      <div className="flex items-center justify-between gap-3 pb-3.5 border-b border-line shrink-0">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink tracking-tight">
          Buddy Buzz
        </h1>
      </div>

      {/* Chats */}
      <div className="flex-1 flex overflow-hidden pt-4 gap-4">
          {/* Conversation list */}
          <div
            ref={chatListRef}
            tabIndex={-1}
            className={`w-full md:w-80 lg:w-96 flex flex-col shrink-0 bg-surface rounded-3xl border border-line shadow-soft overflow-hidden focus:outline-none ${
              selectedConversationId || selectedArchiveId ? 'hidden md:flex' : 'flex'
            }`}
          >
            <div className="flex-1 overflow-y-auto divide-y divide-line filters-scroll">
              {safeConversations.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-8 text-center gap-2">
                  <Goose size={84} state="looking" />
                  <p className="text-sm font-medium text-ink">
                    No buddies yet. Find an event and make a friend.
                  </p>
                </div>
              ) : (
                safeConversations.map((conv) => {
                  const isSelected = conv.id === selectedConversationId && !selectedArchiveId;
                  const avatarSrc = safeMediaUrl(conv.partner?.avatar) || '';
                  const partnerFirstName = getFirstName(conv.partner?.name);

                  return (
                    <button
                      type="button"
                      key={conv.id}
                      onClick={() => {
                        setSelectedArchiveId(null);
                        setSelectedConversationId(conv.id);
                        markConversationRead(conv.id);
                        setOpenMenuId(null);
                      }}
                      className={`w-full text-left px-4 py-3.5 transition-colors cursor-pointer flex items-center gap-3 ${
                        isSelected
                          ? 'bg-accent-soft/70'
                          : 'hover:bg-surface-soft/60'
                      }`}
                    >
                      {avatarSrc ? (
                        <img
                          src={avatarSrc}
                          alt={partnerFirstName}
                          referrerPolicy="no-referrer"
                          className="w-10 h-10 rounded-full object-cover shrink-0 bg-surface-soft"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-accent-soft text-accent-text text-sm font-semibold flex items-center justify-center shrink-0">
                          {partnerFirstName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-sm text-ink truncate">
                            {partnerFirstName}
                          </span>
                          {conv.unreadCount > 0 && (
                            <span
                              className="w-2 h-2 rounded-full bg-accent shrink-0"
                              aria-label="Unread message"
                            />
                          )}
                        </div>
                        <p className="text-xs font-medium text-ink/75 truncate">
                          {conv.eventTitle}
                        </p>
                        <p className="text-xs text-muted truncate mt-0.5">
                          {conv.lastMessage}
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {safeArchives.length > 0 && (
              <div className="border-t border-line bg-surface-soft/30 shrink-0">
                <button
                  type="button"
                  onClick={() => setArchiveExpanded((prev) => !prev)}
                  aria-expanded={archiveExpanded}
                  className="w-full px-4 py-2.5 flex items-center justify-between gap-2 text-xs font-medium text-muted hover:text-ink transition-colors cursor-pointer"
                >
                  <span className="inline-flex items-center gap-2 min-w-0">
                    <Archive className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">
                      Closed conversations ({safeArchives.length})
                    </span>
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 shrink-0 transition-transform duration-150 ${
                      archiveExpanded ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {archiveExpanded && (
                  <div className="border-t border-line max-h-48 overflow-y-auto divide-y divide-line filters-scroll bg-surface">
                    <p className="px-4 py-2 text-[11px] text-muted bg-canvas/60">
                      Archived temporarily for safety and reporting.
                    </p>
                    {safeArchives.map((arch) => {
                      const isArchSelected = arch.id === selectedArchiveId;
                      return (
                        <button
                          key={arch.id}
                          type="button"
                          onClick={() => {
                            setSelectedConversationId(null);
                            setSelectedArchiveId(arch.id);
                            setOpenMenuId(null);
                          }}
                          className={`w-full text-left px-4 py-2.5 transition-colors cursor-pointer ${
                            isArchSelected ? 'bg-accent-soft/70' : 'hover:bg-surface-soft/60'
                          }`}
                        >
                          <p className="text-xs font-medium text-ink truncate">
                            {arch.eventTitle}
                          </p>
                          <p className="text-[11px] text-muted mt-0.5">
                            Closed {formatClosedDate(arch.closedAtMs)}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Active Chat or Read-only Archive Panel */}
          <ErrorBoundary
            resetKeys={[selectedConversationId, selectedArchiveId]}
            onReset={() => {
              setSelectedConversationId(null);
              setSelectedArchiveId(null);
            }}
            title="Unable to load this chat"
            message="We hit an unexpected issue displaying this conversation. Choose another chat or return to your chat list."
            actionLabel="Back to chats"
            className={!selectedConversationId && !selectedArchiveId ? 'hidden md:flex' : 'flex'}
          >
          <div
            className={`flex-1 flex flex-col bg-surface rounded-3xl border border-line shadow-soft overflow-hidden ${
              !selectedConversationId && !selectedArchiveId ? 'hidden md:flex' : 'flex'
            }`}
          >
            {selectedArchive ? (
              <>
                <div className="px-4 py-3 border-b border-line bg-surface-soft/30 flex items-center gap-2.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setSelectedArchiveId(null)}
                    className="md:hidden p-1.5 text-muted hover:text-ink rounded-xl hover:bg-surface-soft cursor-pointer"
                    aria-label="Back to chats"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-sm text-ink truncate">
                      {selectedArchive.eventTitle}
                    </h3>
                    <p className="text-xs text-muted">
                      Closed {formatClosedDate(selectedArchive.closedAtMs)}
                    </p>
                  </div>
                </div>

                <div className="px-4 py-2 border-b border-line bg-canvas text-xs text-muted shrink-0">
                  Archived temporarily for safety and reporting.
                </div>

                <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 filters-scroll">
                  {(!Array.isArray(selectedArchive.messages) || selectedArchive.messages.length === 0) ? (
                    <p className="text-xs text-muted text-center py-8">
                      No messages in this archived conversation.
                    </p>
                  ) : (
                    selectedArchive.messages.map((msg) => {
                      if (msg.senderRole === 'system') {
                        return (
                          <div key={msg.id} className="text-center py-1">
                            <span className="inline-block text-xs text-muted bg-surface-soft px-3 py-1 rounded-xl">
                              {msg.text}
                            </span>
                          </div>
                        );
                      }
                      const isMe = msg.senderRole === 'me';
                      return (
                        <div
                          key={msg.id}
                          className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                        >
                          <span className="text-[11px] font-medium text-muted mb-1 px-1">
                            {isMe ? 'You' : 'Buddy'}
                          </span>
                          <div
                            className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-xs sm:text-sm leading-relaxed ${
                              isMe
                                ? 'bg-accent/70 text-accent-ink rounded-br-sm'
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
                    })
                  )}
                </div>

                <div className="px-4 py-3 border-t border-line bg-surface-soft/30 text-center text-xs text-muted shrink-0">
                  This conversation is closed and read-only.
                </div>
              </>
            ) : selectedConversation ? (
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

                    {safeMediaUrl(selectedConversation.partner.avatar) ? (
                      <img
                        src={safeMediaUrl(selectedConversation.partner.avatar) || ''}
                        alt={getFirstName(selectedConversation.partner.name)}
                        referrerPolicy="no-referrer"
                        className="w-9 h-9 rounded-full object-cover shrink-0 bg-surface-soft"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-accent-soft text-accent-text text-xs font-semibold flex items-center justify-center shrink-0">
                        {getFirstName(selectedConversation.partner.name).charAt(0).toUpperCase()}
                      </div>
                    )}

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <h3 className="font-semibold text-sm text-ink truncate">
                          {getFirstName(selectedConversation.partner.name)}
                        </h3>
                        <span className="text-xs text-muted shrink-0">
                          {pairingState.isConfirmed ? 'Buddy' : 'Provisional buddy'}
                        </span>
                      </div>

                      {linkedUpcomingEvent ? (
                        <button
                          type="button"
                          onClick={() => setViewingEventId(linkedUpcomingEvent.id)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-ink max-w-full truncate cursor-pointer mt-0.5"
                        >
                          <Calendar className="w-3 h-3 text-accent-text shrink-0" />
                          <span className="truncate">
                            {selectedConversation.eventTitle} · {linkedEventDateLabel}
                          </span>
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-muted max-w-full truncate mt-0.5">
                          <span className="truncate">
                            {selectedConversation.eventTitle} · {linkedEventDateLabel}
                          </span>
                          {isEventEnded && <span>· Ended</span>}
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
                      <div className="absolute right-0 mt-1 w-48 bg-surface border border-line rounded-xl shadow-lift py-1 z-20 text-xs">
                        <button
                          type="button"
                          onClick={() => {
                            lastTriggerRef.current = chatHeaderMenuBtnRef.current;
                            setOpenMenuId(null);
                            setManageModalOpen(true);
                          }}
                          className="w-full text-left px-3 py-2 text-ink hover:bg-surface-soft cursor-pointer font-medium"
                        >
                          Manage buddy pairing
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

                {/* Thin provisional orientation line under header (upcoming, unconfirmed only) */}
                {!postEventEval.isEventEnded && !pairingState.isConfirmed && (
                  <div className="px-4 py-2 border-b border-line bg-surface-soft/30 text-xs text-muted shrink-0">
                    You&apos;ve been matched! Get to know each other before deciding whether
                    you&apos;d like to attend together.
                  </div>
                )}

                {/* Post-event 48h stay-connected notice (never reveals partner choice) */}
                {postEventEval.showStayConnectedBar && postEventEval.statusLineText && (
                  <div className="px-4 py-2 border-b border-line bg-surface-soft/30 flex items-center justify-between gap-3 text-xs shrink-0">
                    <span className="text-muted leading-snug">
                      {postEventEval.statusLineText}
                    </span>
                    <button
                      type="button"
                      disabled={Boolean(selectedConversation.stayConnectedUser)}
                      onClick={() => toggleStayConnected(selectedConversation.id)}
                      className={`px-3.5 py-1 rounded-full font-semibold text-xs shrink-0 transition-colors ${
                        selectedConversation.stayConnectedUser
                          ? 'bg-surface-soft text-muted cursor-default'
                          : 'bg-accent hover:bg-accent-hover text-accent-ink shadow-soft cursor-pointer'
                      }`}
                    >
                      {selectedConversation.stayConnectedUser ? 'Requested' : 'Stay connected'}
                    </button>
                  </div>
                )}

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
                  {/* First-open Intro Card (collapses once user sends first message) */}
                  {!hasUserSentMessage && (
                    <div className="rounded-2xl border border-line bg-surface-soft/50 p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-ink truncate">
                            {getFirstName(selectedConversation.partner.name)}
                          </p>
                          <p className="text-xs text-muted">Waterloo student</p>
                        </div>
                        {!pairingState.isConfirmed && (
                          <span className="px-2.5 py-0.5 rounded-full bg-canvas border border-line text-[11px] font-medium text-muted shrink-0">
                            Provisional buddy
                          </span>
                        )}
                      </div>

                      {commonIntroLines.length > 0 && (
                        <div className="space-y-1.5 pt-1 border-t border-line">
                          <p className="text-xs font-semibold text-ink">
                            What you have in common
                          </p>
                          <ul className="space-y-1">
                            {commonIntroLines.map((line) => (
                              <li
                                key={line}
                                className="flex items-center gap-2 text-xs text-muted"
                              >
                                <Check className="w-3.5 h-3.5 text-accent-text stroke-[2.5] shrink-0" />
                                <span>{line}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                  {currentMessages.map((msg) => {
                    const isMe = msg.senderId === user?.id;
                    const isSystem = msg.senderId === 'system';

                    if (isSystem) {
                      return (
                        <div key={msg.id} className="text-center py-1">
                          <span className="inline-block text-xs text-muted bg-surface-soft px-3 py-1 rounded-xl">
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

                  {isPartnerTyping && (
                    <div className="flex flex-col items-start">
                      <div
                        className="rounded-2xl rounded-bl-sm bg-surface-soft px-3.5 py-2.5 inline-flex items-center gap-1"
                        aria-label={`${getFirstName(selectedConversation.partner.name)} is typing`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce [animation-delay:-0.24s]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce [animation-delay:-0.12s]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce" />
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {currentChatError && (
                  <div
                    role="alert"
                    className="px-4 py-2 border-t border-line bg-danger-soft/60 text-danger text-xs shrink-0"
                  >
                    {currentChatError}
                  </div>
                )}

                {/* Conversation starters panel (only visible when toggled open) */}
                {startersOpen && selectedChatStarters && (
                  <div className="px-3.5 py-3 border-t border-line bg-canvas/85 shrink-0 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-muted">
                        Conversation starters · In common
                      </span>
                      <button
                        type="button"
                        onClick={() => setStartersOpen(false)}
                        className="p-1 text-muted hover:text-ink rounded-lg transition-colors cursor-pointer"
                        aria-label="Close conversation starters"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {selectedChatStarters.similarities.map((item) => (
                        <span
                          key={item}
                          className="text-[11px] px-2.5 py-0.5 rounded-lg bg-accent-soft/75 text-ink border border-accent/30 font-medium"
                        >
                          {item}
                        </span>
                      ))}
                    </div>

                    <div className="space-y-1.5">
                      <span className="block text-[11px] font-semibold text-muted">
                        Ideas to send
                      </span>
                      <div className="space-y-1.5">
                        {selectedChatStarters.prompts.map((prompt) => (
                          <button
                            key={prompt}
                            type="button"
                            onClick={() => {
                              setInputText(prompt);
                              setStartersOpen(false);
                              window.setTimeout(() => messageInputRef.current?.focus(), 0);
                            }}
                            className="w-full text-left text-xs text-ink bg-surface hover:bg-accent-soft/60 border border-line hover:border-accent/45 rounded-xl px-3 py-2 transition-colors cursor-pointer"
                          >
                            {prompt}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Composer or post-event closed notice */}
                {postEventEval.isChatClosed ? (
                  <div className="px-4 py-3.5 border-t border-line bg-surface-soft/30 text-center text-xs text-muted shrink-0">
                    {postEventEval.closedBannerText}
                  </div>
                ) : (
                  <form
                    onSubmit={handleSendMessage}
                    className="p-3 border-t border-line bg-surface flex items-center gap-2 shrink-0"
                  >
                    <input
                      ref={messageInputRef}
                      type="text"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder="Write a message..."
                      className="flex-1 min-w-0 px-4 py-2.5 rounded-2xl border border-line bg-canvas text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent text-xs sm:text-sm"
                    />
                    {selectedChatStarters && (
                      <div className="relative group shrink-0">
                        <button
                          type="button"
                          onClick={() => setStartersOpen((prev) => !prev)}
                          aria-expanded={startersOpen}
                          aria-label="Conversation starters"
                          className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-colors cursor-pointer ${
                            startersOpen
                              ? 'bg-accent-soft text-accent-text border-accent/45'
                              : 'bg-canvas text-muted hover:text-ink border-line hover:bg-surface-soft'
                          }`}
                        >
                          <Sparkles className="w-3.5 h-3.5 text-accent-text" />
                        </button>
                        <span
                          role="tooltip"
                          className="pointer-events-none opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity absolute bottom-full right-0 mb-1.5 whitespace-nowrap px-2 py-1 rounded-lg bg-ink text-canvas text-[11px] font-medium shadow-soft"
                        >
                          Conversation starters
                        </span>
                      </div>
                    )}
                    <button
                      type="submit"
                      disabled={!inputText.trim()}
                      className="px-4 py-2.5 bg-accent hover:bg-accent-hover disabled:opacity-40 text-accent-ink rounded-full text-xs font-bold flex items-center gap-1.5 transition-colors shadow-soft shrink-0 cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Send</span>
                    </button>
                  </form>
                )}

                {/* Footer pairing confirmation / manage bar (upcoming events only) */}
                {!postEventEval.isEventEnded && !postEventEval.isChatClosed && (
                  <div className="px-4 py-2.5 border-t border-line bg-surface-soft/30 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
                    {pairingState.isConfirmed ? (
                      <>
                        <span className="inline-flex items-center gap-1.5 text-ink font-medium">
                          <Check className="w-3.5 h-3.5 text-accent-text stroke-[2.5] shrink-0" />
                          <span>You&apos;re buddies for this event.</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setManageModalOpen(true)}
                          className="text-xs font-medium text-muted hover:text-ink underline underline-offset-2 cursor-pointer"
                        >
                          Manage
                        </button>
                      </>
                    ) : pairingState.userConfirmed ? (
                      <>
                        <span className="text-muted">
                          You confirmed. Waiting for your buddy.
                        </span>
                        <button
                          type="button"
                          onClick={() => setManageModalOpen(true)}
                          className="text-xs font-medium text-muted hover:text-ink underline underline-offset-2 cursor-pointer"
                        >
                          Manage buddy pairing
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => confirmPairing(selectedConversation.id)}
                          className="px-4 py-1.5 rounded-full bg-accent hover:bg-accent-hover text-accent-ink font-semibold text-xs shadow-soft transition-colors cursor-pointer shrink-0"
                        >
                          Confirm my buddy
                        </button>
                        <button
                          type="button"
                          onClick={() => setManageModalOpen(true)}
                          className="text-xs font-medium text-muted hover:text-ink underline underline-offset-2 cursor-pointer"
                        >
                          Manage buddy pairing
                        </button>
                      </>
                    )}
                  </div>
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
          </ErrorBoundary>
        </div>

      {/* Manage Buddy Pairing & Confirmation Modals (A, B, C, D) */}
      <ManageBuddyModal
        isOpen={manageModalOpen}
        conversation={selectedConversation || null}
        event={linkedEvent || (selectedConversation ? { date: selectedConversation.eventDate } : null)}
        nowMs={effectiveNowMs}
        onClose={() => setManageModalOpen(false)}
        onConfirmBuddy={() => {
          if (selectedConversation) {
            confirmPairing(selectedConversation.id);
          }
        }}
        onConfirmRematch={handleManageRematch}
        onConfirmNoLongerNeed={handleManageNoLongerNeed}
        onConfirmUnableToAttend={handleManageUnableToAttend}
        onOpenReport={() => {
          if (!selectedConversation) return;
          setReportTarget({
            type: 'user',
            attendee: selectedConversation.partner
          });
          setReportModalOpen(true);
        }}
      />

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
