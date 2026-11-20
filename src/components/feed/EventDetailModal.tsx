import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  X,
  MoreHorizontal,
  Calendar,
  MapPin,
  Video,
  Bookmark,
  CalendarPlus,
  ExternalLink,
  Check,
  ChevronDown,
  MessageCircle,
  Flag,
  ShieldBan
} from 'lucide-react';
import { EventItem, AttendeeProfile } from '../../types';
import { useApp } from '../../context/AppContext';
import { downloadEventIcs } from '../../utils/calendar';
import { formatModalEventDateTime } from '../../utils/timeZone';
import { safeHttpUrl, safeMediaUrl } from '../../utils/urlSafety';
import { Bee } from '../common/Bee';
import { HexConfettiBurst } from '../common/HiveIcons';
import { BuddyConnectModal } from './BuddyConnectModal';
import { BuddyPrivacyPreviewModal } from './BuddyPrivacyPreviewModal';
import { ReportModal } from '../common/ReportModal';
import { UWVerificationModal } from '../common/UWVerificationModal';
import { PersonalityQuizModal } from '../common/PersonalityQuizModal';
import { AuthModal } from '../onboarding/AuthModal';

interface EventDetailModalProps {
  event: EventItem | null;
  isOpen: boolean;
  onClose: () => void;
  onNavigateToMessages?: () => void;
}

const SmallHexAvatar: React.FC<{ attendee: AttendeeProfile; index: number }> = ({
  attendee,
  index
}) => {
  const [failed, setFailed] = useState(false);
  const initials = attendee.name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className="w-7 h-7 hex-mask bg-surface p-[2px] shrink-0"
      style={{ zIndex: 10 - index }}
      title={attendee.name}
    >
      {!failed && attendee.avatar ? (
        <img
          src={attendee.avatar}
          alt={attendee.name}
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="w-full h-full object-cover hex-mask"
        />
      ) : (
        <div className="w-full h-full hex-mask bg-surface-soft text-ink text-xs font-semibold flex items-center justify-center">
          {initials || 'UW'}
        </div>
      )}
    </div>
  );
};

export const EventDetailModal: React.FC<EventDetailModalProps> = ({
  event,
  isOpen,
  onClose,
  onNavigateToMessages
}) => {
  const {
    user,
    savedEventIds,
    toggleSaveEvent,
    attendingEventIds,
    toggleGoing,
    attendeeVisibility,
    eventBuddySettings,
    enableBuddyMatching,
    disableBuddyMatching,
    getEventAttendees,
    getSuggestedMatches,
    connectionRequests,
    withdrawConnectionRequest,
    respondConnectionRequest,
    conversations,
    blockUser
  } = useApp();

  const prefersReduced = Boolean(useReducedMotion());
  const modalRef = useRef<HTMLDivElement | null>(null);
  const headerMenuRef = useRef<HTMLDivElement | null>(null);
  const noMatchBtnRef = useRef<HTMLButtonElement | null>(null);
  const prevShowNoMatchRef = useRef(false);

  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [openRowMenuId, setOpenRowMenuId] = useState<string | null>(null);
  const [descExpanded, setDescExpanded] = useState(false);
  const [moreDetailsOpen, setMoreDetailsOpen] = useState(false);
  const [showAllMatches, setShowAllMatches] = useState(false);
  const [coverFailed, setCoverFailed] = useState(false);

  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [selectedAttendeeForConnect, setSelectedAttendeeForConnect] =
    useState<AttendeeProfile | null>(null);
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<{
    type: 'user' | 'event';
    attendee?: AttendeeProfile;
  } | null>(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [quizModalOpen, setQuizModalOpen] = useState(false);
  const [verificationModalOpen, setVerificationModalOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [pendingUpForBuddy, setPendingUpForBuddy] = useState(false);
  const [blockConfirmAttendee, setBlockConfirmAttendee] = useState<AttendeeProfile | null>(null);
  const [isBlocking, setIsBlocking] = useState(false);
  const blockTriggerRef = useRef<HTMLButtonElement | null>(null);
  const rowMenuButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [toastMessage, setToastMessage] = useState('');
  const [rsvpConfettiActive, setRsvpConfettiActive] = useState(false);
  const [bookmarkBuzzKey, setBookmarkBuzzKey] = useState(0);

  const anySubModalOpen =
    previewModalOpen ||
    connectModalOpen ||
    reportModalOpen ||
    quizModalOpen ||
    verificationModalOpen ||
    authModalOpen ||
    Boolean(blockConfirmAttendee);

  const wasOpenRef = useRef(false);

  // Reset transient UI states when switching events or closing
  useEffect(() => {
    setHeaderMenuOpen(false);
    setOpenRowMenuId(null);
    setDescExpanded(false);
    setMoreDetailsOpen(false);
    setShowAllMatches(false);
    setCoverFailed(false);
    setBlockConfirmAttendee(null);
    setIsBlocking(false);
    setAuthModalOpen(false);
    setPendingUpForBuddy(false);
  }, [event?.id, isOpen]);

  // Complete "I'm up for a buddy" automatically once signed in (and verified if needed)
  useEffect(() => {
    if (!isOpen || !event || !pendingUpForBuddy || authModalOpen) return;
    if (!user) {
      setPendingUpForBuddy(false);
      return;
    }
    if (!user.isVerifiedUWStudent) {
      setVerificationModalOpen(true);
      return;
    }
    const settings = eventBuddySettings[event.id] || {
      showFaculty: true,
      showYear: true,
      shortIntro: user.bio || ''
    };
    enableBuddyMatching(event.id, settings);
    setPendingUpForBuddy(false);
    window.setTimeout(() => noMatchBtnRef.current?.focus(), 0);
  }, [isOpen, event, pendingUpForBuddy, authModalOpen, user, eventBuddySettings, enableBuddyMatching]);

  // Focus button only when the no-match card dynamically appears while the modal is already open
  const isNoMatchCardVisible = Boolean(
    isOpen &&
      event &&
      event.status !== 'cancelled' &&
      event.status !== 'ended' &&
      !event.isResearchStudy &&
      getSuggestedMatches(event.id).filter((m) => m.attendee.id !== user?.id).length === 0
  );

  useEffect(() => {
    if (!isOpen) {
      wasOpenRef.current = false;
      prevShowNoMatchRef.current = false;
      return;
    }
    if (!wasOpenRef.current) {
      wasOpenRef.current = true;
      prevShowNoMatchRef.current = isNoMatchCardVisible;
      return;
    }
    if (!prevShowNoMatchRef.current && isNoMatchCardVisible) {
      const t = window.setTimeout(() => {
        noMatchBtnRef.current?.focus();
      }, 20);
      prevShowNoMatchRef.current = true;
      return () => window.clearTimeout(t);
    }
    prevShowNoMatchRef.current = isNoMatchCardVisible;
  }, [isNoMatchCardVisible, isOpen]);

  useEffect(() => {
    if (!blockConfirmAttendee) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setBlockConfirmAttendee(null);
        setIsBlocking(false);
        window.setTimeout(() => blockTriggerRef.current?.focus(), 0);
      }
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [blockConfirmAttendee]);

  // Lock background scroll & restore focus
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';

    const focusTimer = window.setTimeout(() => {
      modalRef.current?.focus();
    }, 10);

    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, [isOpen]);

  // Escape & Focus Trap within the modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (anySubModalOpen) return;

      if (e.key === 'Escape') {
        if (headerMenuOpen || openRowMenuId) {
          setHeaderMenuOpen(false);
          setOpenRowMenuId(null);
          return;
        }
        onClose();
        return;
      }

      if (e.key === 'Tab' && modalRef.current) {
        const focusable = Array.from(
          modalRef.current.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => el.offsetParent !== null);

        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first || document.activeElement === modalRef.current) {
            e.preventDefault();
            last.focus();
          }
        } else if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, anySubModalOpen, headerMenuOpen, openRowMenuId, onClose]);

  // Close menus on outside click
  useEffect(() => {
    if (!headerMenuOpen && !openRowMenuId) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (headerMenuRef.current && !headerMenuRef.current.contains(e.target as Node)) {
        setHeaderMenuOpen(false);
      }
      if (!(e.target as HTMLElement)?.closest('[data-row-menu]')) {
        setOpenRowMenuId(null);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [headerMenuOpen, openRowMenuId]);

  if (!isOpen || !event) return null;

  const isSaved = savedEventIds.includes(event.id);
  const isGoing = attendingEventIds.includes(event.id);
  const isCancelled = event.status === 'cancelled';
  const isEnded = event.status === 'ended';
  const isClosedEvent = isCancelled || isEnded;
  const isBuddyMatchingActive = attendeeVisibility[event.id] ?? false;

  const attendees = getEventAttendees(event.id);
  const suggestedMatches = getSuggestedMatches(event.id).filter(
    (m) => m.attendee.id !== user?.id
  );
  const visibleMatches = showAllMatches
    ? suggestedMatches
    : suggestedMatches.slice(0, 3);

  const hasQuizCompleted = Boolean(user?.personalityQuiz?.completed);

  const priceLabel = event.isFree ? 'Free' : event.price;

  // Venue & room formatted on one clean line without duplication
  const baseVenue = event.venueName || event.location;
  const venueLine =
    event.roomNumber && !baseVenue.toLowerCase().includes(event.roomNumber.toLowerCase())
      ? `${baseVenue} · ${event.roomNumber}`
      : baseVenue;

  const mapsQuery = [event.venueName || event.location, event.address]
    .filter(Boolean)
    .join(', ');
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${mapsQuery}, Waterloo, ON`
  )}`;
  const safeRegUrl = safeHttpUrl(event.registrationUrl);
  const safeCoverUrl = safeMediaUrl(event.coverImage);

  const extraDetailItems = [
    event.eligibility ? { label: 'Eligibility', value: event.eligibility } : null,
    event.accessibility ? { label: 'Accessibility', value: event.accessibility } : null,
    event.arrivalInstructions
      ? { label: 'Arrival notes', value: event.arrivalInstructions }
      : null,
    event.registrationDeadline
      ? { label: 'Registration deadline', value: event.registrationDeadline }
      : null
  ].filter(Boolean) as { label: string; value: string }[];

  const hasLongDescription = (event.description || '').length > 220;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    window.setTimeout(() => setToastMessage(''), 3200);
  };

  const handleGoingClick = () => {
    if (isClosedEvent) return;
    toggleGoing(event.id);
    if (!isGoing && !prefersReduced) {
      setRsvpConfettiActive(true);
      window.setTimeout(() => setRsvpConfettiActive(false), 750);
    }
    showToast(!isGoing ? "Marked as going." : "Removed from going.");
  };

  const handleSaveClick = () => {
    if (isClosedEvent) return;
    if (!isSaved && !prefersReduced) {
      setBookmarkBuzzKey((n) => n + 1);
    }
    toggleSaveEvent(event.id);
  };

  const handleFindBuddyClick = () => {
    if (!user) {
      setAuthModalOpen(true);
      return;
    }
    if (!user.isVerifiedUWStudent) {
      setVerificationModalOpen(true);
      return;
    }
    if (!isGoing) {
      toggleGoing(event.id);
    }
    setPreviewModalOpen(true);
  };

  const handleUpForBuddyClick = () => {
    if (!user) {
      setPendingUpForBuddy(true);
      setAuthModalOpen(true);
      return;
    }
    if (!user.isVerifiedUWStudent) {
      setPendingUpForBuddy(true);
      setVerificationModalOpen(true);
      return;
    }
    const settings = eventBuddySettings[event.id] || {
      showFaculty: true,
      showYear: true,
      shortIntro: user.bio || ''
    };
    enableBuddyMatching(event.id, settings);
    window.setTimeout(() => noMatchBtnRef.current?.focus(), 0);
  };

  const handleUndoUpForBuddy = () => {
    disableBuddyMatching(event.id);
    window.setTimeout(() => noMatchBtnRef.current?.focus(), 0);
  };

  const existingRequestFor = (attendeeId: string) =>
    connectionRequests.find(
      (r) =>
        r.eventId === event.id &&
        r.senderId === user?.id &&
        r.recipientId === attendeeId
    );

  const existingConversationWith = (attendeeId: string) =>
    conversations.find(
      (c) => c.eventId === event.id && c.partner.id === attendeeId
    );

  return (
    <>
      <AnimatePresence>
        <div
          className="fixed inset-0 z-40 flex items-end sm:items-center justify-center sm:p-4 bg-black/55 backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget && !anySubModalOpen) {
              onClose();
            }
          }}
        >
          <motion.div
            ref={modalRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="event-modal-title"
            initial={prefersReduced ? { opacity: 1 } : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReduced ? { opacity: 0 } : { opacity: 0, y: 10 }}
            transition={{ duration: prefersReduced ? 0 : 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="bg-surface text-ink rounded-t-3xl sm:rounded-3xl max-w-xl w-full shadow-lift border border-line overflow-hidden relative max-h-[92vh] flex flex-col focus:outline-none"
          >
            {/* Floating Top-Right Controls ("..." menu + close) */}
            <div className="absolute top-3.5 right-3.5 z-20 flex items-center gap-2" ref={headerMenuRef}>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setHeaderMenuOpen((prev) => !prev)}
                  aria-label="Event options"
                  aria-expanded={headerMenuOpen}
                  aria-haspopup="menu"
                  className="w-9 h-9 rounded-full bg-surface/90 hover:bg-surface text-ink shadow-soft backdrop-blur-sm flex items-center justify-center transition-colors cursor-pointer"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>

                {headerMenuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 mt-2 w-44 bg-surface rounded-2xl border border-line shadow-lift py-1.5 z-30"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setHeaderMenuOpen(false);
                        setReportTarget({ type: 'event' });
                        setReportModalOpen(true);
                      }}
                      className="w-full px-3.5 py-2 text-left text-xs font-medium text-danger hover:bg-danger-soft flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <Flag className="w-3.5 h-3.5" />
                      <span>Report event</span>
                    </button>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close modal"
                className="w-9 h-9 rounded-full bg-surface/90 hover:bg-surface text-ink shadow-soft backdrop-blur-sm flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quiet Toast */}
            {toastMessage && (
              <div
                role="status"
                aria-live="polite"
                className="absolute top-3.5 left-3.5 right-28 z-20 px-3.5 py-2 bg-surface text-ink text-xs font-semibold rounded-2xl shadow-lift border border-accent flex items-center gap-2"
              >
                <Check className="w-4 h-4 text-accent-text stroke-[2.5] shrink-0" />
                <span className="truncate">{toastMessage}</span>
              </div>
            )}

            {/* Single Scroll Area */}
            <div className="overflow-y-auto flex-1 filters-scroll">
              {/* 1. Cover Image (16:9, no text overlay) */}
              <div className="relative aspect-video w-full bg-surface-soft">
                {!coverFailed && safeCoverUrl ? (
                  <img
                    src={safeCoverUrl}
                    alt={event.title}
                    referrerPolicy="no-referrer"
                    onError={() => setCoverFailed(true)}
                    className={`w-full h-full object-cover ${
                      isClosedEvent ? 'grayscale opacity-70' : ''
                    }`}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-surface-soft text-muted text-sm font-medium">
                    {event.category}
                  </div>
                )}
              </div>

              {/* Modal Body */}
              <div className="p-5 sm:p-7 space-y-6">
                {/* 2. Title + Single Subtitle Line + Optional Status Chip */}
                <div className="space-y-2">
                  <h2
                    id="event-modal-title"
                    className="font-display text-xl sm:text-2xl font-bold text-ink leading-snug"
                  >
                    {event.title}
                  </h2>

                  <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
                    <span>
                      {event.organizer} · {priceLabel}
                    </span>
                    {event.sourceVerification === 'wusa_official' && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-accent text-accent-ink text-xs font-semibold">
                        WUSA
                      </span>
                    )}
                  </div>

                  {/* 3. Slim Status Chip (Cancelled / Ended only) */}
                  {(isCancelled || isEnded) && (
                    <div className="pt-0.5">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-semibold ${
                          isCancelled
                            ? 'bg-danger-soft text-danger'
                            : 'bg-surface-soft text-muted'
                        }`}
                      >
                        {isCancelled ? 'Cancelled' : 'Ended'}
                      </span>
                    </div>
                  )}
                </div>

                {/* 4. Info Rows (Icon + Text only, no headings/labels) */}
                <div className="space-y-3 text-sm text-ink">
                  <div className="flex items-start gap-3">
                    <Calendar className="w-4 h-4 text-accent-text shrink-0 mt-1" />
                    <span>
                      {formatModalEventDateTime(event.date, event.startTime, event.endTime)}
                    </span>
                  </div>

                  <div className="flex items-start gap-3">
                    {event.isOnline ? (
                      <Video className="w-4 h-4 text-accent-text shrink-0 mt-1" />
                    ) : (
                      <MapPin className="w-4 h-4 text-accent-text shrink-0 mt-1" />
                    )}

                    <div className="min-w-0 flex-1 space-y-1">
                      {event.isOnline ? (
                        <>
                          <span className="block">Online event</span>
                          {safeRegUrl && (
                            <a
                              href={safeRegUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-semibold text-accent-text hover:underline"
                            >
                              <span>Join online</span>
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </>
                      ) : (
                        <>
                          <span className="block">{venueLine}</span>
                          {event.address && (
                            <span className="block text-xs text-muted">{event.address}</span>
                          )}
                          <a
                            href={mapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-accent-text hover:underline pt-0.5"
                          >
                            <span>Open in Google Maps</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* 5. Action Row (one line; sticky at bottom on mobile) */}
                <div className="sticky bottom-0 sm:static z-10 -mx-5 sm:mx-0 px-5 sm:px-0 py-3 sm:py-0 bg-surface/95 sm:bg-transparent backdrop-blur-sm sm:backdrop-blur-none border-t border-line sm:border-t-0 flex items-center gap-2.5">
                  {!isClosedEvent && (
                    <button
                      type="button"
                      onClick={handleGoingClick}
                      className="relative flex-1 sm:flex-initial sm:min-w-[140px] h-11 px-5 rounded-2xl bg-accent hover:bg-accent-hover text-accent-ink text-sm font-semibold flex items-center justify-center gap-2 shadow-soft transition-colors cursor-pointer"
                    >
                      <HexConfettiBurst active={rsvpConfettiActive} />
                      {isGoing && <Check className="w-4 h-4 stroke-[2.6]" />}
                      <span>{isGoing ? "You're going" : 'Going'}</span>
                    </button>
                  )}

                  {!isClosedEvent && (
                    <div className="relative">
                      <AnimatePresence>
                        {bookmarkBuzzKey > 0 && (
                          <motion.div
                            key={bookmarkBuzzKey}
                            aria-hidden="true"
                            initial={{ opacity: 1, y: 0, x: 0, scale: 0.7, rotate: -10 }}
                            animate={{ opacity: 0, y: -26, x: 8, scale: 1.05, rotate: 14 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
                            className="pointer-events-none -top-3 left-2.5 absolute z-20"
                          >
                            <Bee size={20} flying />
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <button
                        type="button"
                        onClick={handleSaveClick}
                        aria-label={isSaved ? 'Remove saved event' : 'Save event'}
                        aria-pressed={isSaved}
                        title={isSaved ? 'Saved' : 'Save'}
                        className={`w-11 h-11 rounded-2xl border flex items-center justify-center transition-colors cursor-pointer ${
                          isSaved
                            ? 'bg-accent-soft border-accent text-accent-text'
                            : 'bg-surface border-line text-ink hover:bg-surface-soft'
                        }`}
                      >
                        <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
                      </button>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      downloadEventIcs(event);
                      showToast('Added calendar file (.ics).');
                    }}
                    aria-label="Add to calendar"
                    title="Add to calendar"
                    className="w-11 h-11 rounded-2xl border border-line bg-surface hover:bg-surface-soft text-ink flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <CalendarPlus className="w-4 h-4" />
                  </button>

                  {safeRegUrl && (
                    <a
                      href={safeRegUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto inline-flex items-center gap-1 px-2 py-2 text-sm font-semibold text-accent-text hover:underline whitespace-nowrap"
                    >
                      <span>Register</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>

                {/* 6. Description (plain text, clamped to 4 lines + Read more) */}
                {event.description && (
                  <div className="space-y-1.5 pt-2 border-t border-line">
                    <p
                      className={`text-sm text-ink/90 leading-relaxed whitespace-pre-line ${
                        descExpanded ? '' : 'line-clamp-4'
                      }`}
                    >
                      {event.description}
                    </p>
                    {hasLongDescription && (
                      <button
                        type="button"
                        onClick={() => setDescExpanded((prev) => !prev)}
                        className="text-xs font-semibold text-accent-text hover:underline cursor-pointer"
                      >
                        {descExpanded ? 'Show less' : 'Read more'}
                      </button>
                    )}
                  </div>
                )}

                {/* 7. Collapsed "More details" disclosure (only if fields exist) */}
                {extraDetailItems.length > 0 && (
                  <div className="pt-2 border-t border-line">
                    <button
                      type="button"
                      aria-expanded={moreDetailsOpen}
                      onClick={() => setMoreDetailsOpen((prev) => !prev)}
                      className="w-full flex items-center justify-between py-1 text-sm font-semibold text-ink cursor-pointer"
                    >
                      <span>More details</span>
                      <ChevronDown
                        className={`w-4 h-4 text-muted transition-transform duration-150 ${
                          moreDetailsOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {moreDetailsOpen && (
                      <div className="mt-2.5 space-y-2 text-xs text-muted leading-relaxed">
                        {extraDetailItems.map((item) => (
                          <p key={item.label}>
                            <strong className="font-semibold text-ink">{item.label}:</strong>{' '}
                            {item.value}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 8. Buddy Section (hidden for ended or cancelled events) */}
                {!isClosedEvent && (
                  <div className="bg-accent-soft/70 rounded-2xl p-5 space-y-4">
                    {event.isResearchStudy ? (
                      <p className="text-sm text-muted">
                        Buddy matching is off for research studies.
                      </p>
                    ) : (
                      <>
                        {/* Buddy Card Header */}
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {attendees.length > 0 && (
                              <div className="flex items-center -space-x-2 shrink-0">
                                {attendees.slice(0, 3).map((att, idx) => (
                                  <SmallHexAvatar key={att.id} attendee={att} index={idx} />
                                ))}
                              </div>
                            )}
                            <span className="text-sm font-semibold text-ink tabular-nums">
                              {attendees.length} looking for a buddy
                            </span>
                          </div>

                          {visibleMatches.length > 0 &&
                            (isBuddyMatchingActive ? (
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setPreviewModalOpen(true)}
                                  className="px-3 py-1.5 rounded-xl bg-surface text-ink text-xs font-semibold hover:bg-surface-soft transition-colors cursor-pointer"
                                >
                                  Edit visibility
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    disableBuddyMatching(event.id);
                                    showToast('Buddy matching turned off.');
                                  }}
                                  className="px-3 py-1.5 rounded-xl text-danger text-xs font-semibold hover:bg-danger-soft transition-colors cursor-pointer"
                                >
                                  Turn off
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={handleFindBuddyClick}
                                className="px-4 py-2 rounded-xl bg-accent hover:bg-accent-hover text-accent-ink text-xs font-semibold shadow-soft transition-colors cursor-pointer"
                              >
                                Find a buddy
                              </button>
                            ))}
                        </div>

                        {/* One-line quiz link ONLY when matches exist and user has no quiz result */}
                        {visibleMatches.length > 0 && !hasQuizCompleted && (
                          <p className="text-xs text-muted">
                            <button
                              type="button"
                              onClick={() => setQuizModalOpen(true)}
                              className="font-semibold text-accent-text hover:underline cursor-pointer"
                            >
                              Take the 1-minute quiz for better matches.
                            </button>
                          </p>
                        )}

                        {/* Match Rows or Calm No-Match State */}
                        {visibleMatches.length === 0 ? (
                          <div className="bg-surface rounded-2xl border border-line p-4 space-y-3">
                            <p className="text-sm font-medium text-ink">No matches yet.</p>

                            {isBuddyMatchingActive ? (
                              <div className="space-y-2">
                                <div className="flex flex-wrap items-center gap-3">
                                  <button
                                    ref={noMatchBtnRef}
                                    type="button"
                                    aria-pressed="true"
                                    className="px-4 py-2.5 min-h-[44px] rounded-xl bg-accent text-accent-ink text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 shadow-soft cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                                  >
                                    <Check className="w-4 h-4 stroke-[2.5]" />
                                    <span>You&apos;re in</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleUndoUpForBuddy}
                                    className="text-xs font-medium text-muted hover:text-ink hover:underline underline-offset-2 px-1.5 py-2 min-h-[44px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface rounded-lg"
                                  >
                                    Undo
                                  </button>
                                </div>
                                <p className="text-xs text-muted">
                                  We&apos;ll let you know when someone joins.
                                </p>
                              </div>
                            ) : (
                              <div>
                                <button
                                  ref={noMatchBtnRef}
                                  type="button"
                                  onClick={handleUpForBuddyClick}
                                  className="px-4 py-2.5 min-h-[44px] rounded-xl bg-accent hover:bg-accent-hover text-accent-ink text-xs sm:text-sm font-semibold inline-flex items-center justify-center shadow-soft transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                                >
                                  I&apos;m up for a buddy
                                </button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="divide-y divide-line">
                            {visibleMatches.map(({ attendee, compatibility }) => {
                              const existingReq = existingRequestFor(attendee.id);
                              const existingConv = existingConversationWith(attendee.id);
                              const incomingReq = connectionRequests.find(
                                (r) =>
                                  r.eventId === event.id &&
                                  r.senderId === attendee.id &&
                                  r.recipientId === user?.id &&
                                  r.status === 'pending'
                              );
                              const rowMenuOpen = openRowMenuId === attendee.id;

                              return (
                                <div key={attendee.id} className="py-3 first:pt-1 last:pb-1 space-y-2">
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      <img
                                        src={attendee.avatar}
                                        alt={attendee.name}
                                        referrerPolicy="no-referrer"
                                        className="w-9 h-9 rounded-full object-cover shrink-0"
                                      />
                                      <div className="flex items-center gap-2 min-w-0 flex-wrap">
                                        <span className="text-sm font-semibold text-ink truncate">
                                          {attendee.name}
                                        </span>
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-surface text-ink text-xs font-semibold tabular-nums">
                                          {compatibility.score}% match
                                        </span>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0">
                                      {existingConv ? (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            onClose();
                                            onNavigateToMessages?.();
                                          }}
                                          className="px-3 py-1.5 rounded-xl bg-surface hover:bg-surface-soft text-ink text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                                        >
                                          <MessageCircle className="w-3.5 h-3.5 text-accent-text" />
                                          <span>Chat</span>
                                        </button>
                                      ) : existingReq && existingReq.status === 'pending' ? (
                                        <button
                                          type="button"
                                          onClick={() => withdrawConnectionRequest(existingReq.id)}
                                          className="px-3 py-1.5 rounded-xl bg-surface text-muted hover:text-danger text-xs font-semibold transition-colors cursor-pointer"
                                          title="Withdraw pending request"
                                        >
                                          Sent · Withdraw
                                        </button>
                                      ) : existingReq && existingReq.status === 'declined' ? (
                                        <span className="text-xs text-muted px-2">Declined</span>
                                      ) : incomingReq ? (
                                        <div className="flex items-center gap-1.5">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              respondConnectionRequest(incomingReq.id, 'accept');
                                              showToast(`Connected with ${attendee.name}.`);
                                            }}
                                            className="px-3 py-1.5 rounded-xl bg-surface hover:bg-surface-soft text-ink text-xs font-semibold cursor-pointer"
                                          >
                                            Accept
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              respondConnectionRequest(incomingReq.id, 'decline');
                                              showToast('Request declined.');
                                            }}
                                            className="px-2.5 py-1.5 rounded-xl text-muted hover:text-ink text-xs font-semibold cursor-pointer"
                                          >
                                            Decline
                                          </button>
                                        </div>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (!user?.isVerifiedUWStudent) {
                                              setVerificationModalOpen(true);
                                              return;
                                            }
                                            setSelectedAttendeeForConnect(attendee);
                                            setConnectModalOpen(true);
                                          }}
                                          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                                            isBuddyMatchingActive
                                              ? 'bg-accent hover:bg-accent-hover text-accent-ink shadow-soft'
                                              : 'bg-surface hover:bg-surface-soft text-ink'
                                          }`}
                                        >
                                          Say hi
                                        </button>
                                      )}

                                      <div className="relative" data-row-menu>
                                        <button
                                          ref={(el) => {
                                            rowMenuButtonRefs.current[attendee.id] = el;
                                          }}
                                          type="button"
                                          onClick={() =>
                                            setOpenRowMenuId((prev) =>
                                              prev === attendee.id ? null : attendee.id
                                            )
                                          }
                                          aria-label={`More actions for ${attendee.name}`}
                                          aria-expanded={rowMenuOpen}
                                          aria-haspopup="menu"
                                          className="w-8 h-8 rounded-xl text-muted hover:text-ink hover:bg-surface flex items-center justify-center transition-colors cursor-pointer"
                                        >
                                          <MoreHorizontal className="w-4 h-4" />
                                        </button>

                                        {rowMenuOpen && (
                                          <div
                                            role="menu"
                                            className="absolute right-0 mt-1 w-36 bg-surface rounded-2xl border border-line shadow-lift py-1 z-30"
                                          >
                                            <button
                                              type="button"
                                              role="menuitem"
                                              onClick={() => {
                                                blockTriggerRef.current =
                                                  rowMenuButtonRefs.current[attendee.id] ?? null;
                                                setOpenRowMenuId(null);
                                                setBlockConfirmAttendee(attendee);
                                              }}
                                              className="w-full px-3 py-2 text-left text-xs font-medium text-ink hover:bg-surface-soft flex items-center gap-2 cursor-pointer"
                                            >
                                              <ShieldBan className="w-3.5 h-3.5 text-muted" />
                                              <span>Block</span>
                                            </button>
                                            <button
                                              type="button"
                                              role="menuitem"
                                              onClick={() => {
                                                setOpenRowMenuId(null);
                                                setReportTarget({ type: 'user', attendee });
                                                setReportModalOpen(true);
                                              }}
                                              className="w-full px-3 py-2 text-left text-xs font-medium text-danger hover:bg-danger-soft flex items-center gap-2 cursor-pointer"
                                            >
                                              <Flag className="w-3.5 h-3.5" />
                                              <span>Report</span>
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Expand all + Preview link (matches-found state only) */}
                        {visibleMatches.length > 0 && (
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                            {suggestedMatches.length > 3 ? (
                              <button
                                type="button"
                                onClick={() => setShowAllMatches((prev) => !prev)}
                                className="font-semibold text-accent-text hover:underline cursor-pointer"
                              >
                                {showAllMatches
                                  ? 'Show fewer'
                                  : `See all (${suggestedMatches.length})`}
                              </button>
                            ) : (
                              <span />
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                if (!user?.isVerifiedUWStudent) {
                                  setVerificationModalOpen(true);
                                  return;
                                }
                                setPreviewModalOpen(true);
                              }}
                              className="font-semibold text-muted hover:text-ink hover:underline cursor-pointer"
                            >
                              Preview what others see
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </AnimatePresence>

      {/* Nested Modals */}
      <BuddyPrivacyPreviewModal
        isOpen={previewModalOpen}
        event={event}
        onClose={() => setPreviewModalOpen(false)}
        onOptInSuccess={() => showToast('Buddy matching enabled.')}
      />

      {selectedAttendeeForConnect && (
        <BuddyConnectModal
          isOpen={connectModalOpen}
          event={event}
          attendee={selectedAttendeeForConnect}
          onClose={() => {
            setConnectModalOpen(false);
            setSelectedAttendeeForConnect(null);
          }}
          onSuccess={() => showToast(`Said hi to ${selectedAttendeeForConnect.name}.`)}
        />
      )}

      {reportTarget && (
        <ReportModal
          isOpen={reportModalOpen}
          targetType={reportTarget.type}
          attendee={reportTarget.attendee}
          event={event}
          onClose={() => {
            setReportModalOpen(false);
            setReportTarget(null);
          }}
          onSuccess={(action) => {
            showToast(
              reportTarget.type === 'user'
                ? action === 'block'
                  ? 'Blocked.'
                  : 'Reported. Chat removed.'
                : 'Event reported.'
            );
          }}
        />
      )}

      {blockConfirmAttendee && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="event-block-dialog-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setBlockConfirmAttendee(null);
              window.setTimeout(() => blockTriggerRef.current?.focus(), 0);
            }
          }}
        >
          <div className="bg-surface text-ink rounded-3xl max-w-sm w-full p-6 shadow-lift border border-line space-y-4">
            <h3 id="event-block-dialog-title" className="font-display font-bold text-ink text-lg">
              Block {blockConfirmAttendee.name.trim().split(/\s+/)[0] || blockConfirmAttendee.name}?
            </h3>
            <p className="text-xs text-muted">
              Their chats will be removed.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setBlockConfirmAttendee(null);
                  window.setTimeout(() => blockTriggerRef.current?.focus(), 0);
                }}
                className="px-4 py-2 text-xs font-semibold text-muted hover:text-ink rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isBlocking}
                onClick={() => {
                  if (isBlocking) return;
                  setIsBlocking(true);
                  blockUser(blockConfirmAttendee.id);
                  setBlockConfirmAttendee(null);
                  setIsBlocking(false);
                  showToast('Blocked.');
                }}
                className="px-4 py-2 bg-danger text-white font-bold rounded-xl text-xs shadow-soft cursor-pointer hover:opacity-90 disabled:opacity-50"
              >
                Block
              </button>
            </div>
          </div>
        </div>
      )}

      <UWVerificationModal
        isOpen={verificationModalOpen}
        onClose={() => {
          setVerificationModalOpen(false);
          setPendingUpForBuddy(false);
        }}
        onSuccess={() => {
          if (pendingUpForBuddy && event) {
            const settings = eventBuddySettings[event.id] || {
              showFaculty: true,
              showYear: true,
              shortIntro: user?.bio || ''
            };
            enableBuddyMatching(event.id, settings);
            setPendingUpForBuddy(false);
            window.setTimeout(() => noMatchBtnRef.current?.focus(), 0);
          } else {
            showToast('UW status verified.');
          }
        }}
      />

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
      />

      <PersonalityQuizModal
        isOpen={quizModalOpen}
        onClose={() => setQuizModalOpen(false)}
        onSuccess={() => showToast('Matches updated.')}
      />
    </>
  );
};
