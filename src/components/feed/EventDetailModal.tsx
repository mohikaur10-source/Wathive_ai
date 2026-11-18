import React, { useState } from 'react';
import {
  X,
  Calendar,
  Clock,
  MapPin,
  ExternalLink,
  Bookmark,
  CalendarPlus,
  Users,
  Eye,
  EyeOff,
  Check,
  AlertTriangle,
  Info,
  Shield,
  MessageCircle,
  Flag,
  Navigation,
  Building,
  UserCheck,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  HeartHandshake,
  Sliders,
  ChevronRight
} from 'lucide-react';
import { EventItem, AttendeeProfile } from '../../types';
import { useApp } from '../../context/AppContext';
import { downloadEventIcs } from '../../utils/calendar';
import { formatWaterlooTimeRange, formatWaterlooDateWithDst } from '../../utils/timeZone';
import { BuddyConnectModal } from './BuddyConnectModal';
import { BuddyPrivacyPreviewModal } from './BuddyPrivacyPreviewModal';
import { ReportModal } from '../common/ReportModal';
import { UWVerificationModal } from '../common/UWVerificationModal';
import { PersonalityQuizModal } from '../common/PersonalityQuizModal';

interface EventDetailModalProps {
  event: EventItem | null;
  isOpen: boolean;
  onClose: () => void;
  onNavigateToMessages?: () => void;
}

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
    disableBuddyMatching,
    getEventAttendees,
    getSuggestedMatches,
    connectionRequests,
    withdrawConnectionRequest,
    respondConnectionRequest,
    conversations,
    toggleSimulateEventEnded
  } = useApp();

  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [selectedAttendeeForConnect, setSelectedAttendeeForConnect] = useState<AttendeeProfile | null>(null);
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ type: 'user' | 'event'; attendee?: AttendeeProfile } | null>(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [quizModalOpen, setQuizModalOpen] = useState(false);
  const [verificationModalOpen, setVerificationModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  if (!isOpen || !event) return null;

  const isSaved = savedEventIds.includes(event.id);
  const isGoing = attendingEventIds.includes(event.id);
  const isCancelled = event.status === 'cancelled';
  const isEnded = event.status === 'ended';
  // Separate attendance from buddy matching: strictly false unless opted in
  const isBuddyMatchingActive = attendeeVisibility[event.id] ?? false;

  const attendees = getEventAttendees(event.id);

  const formatDate = (dateStr: string) => {
    try {
      const [year, month, day] = dateStr.split('-').map(Number);
      const d = new Date(year, month - 1, day);
      return d.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const handleGoingClick = () => {
    if (isCancelled || isEnded) return;
    toggleGoing(event.id);
    if (!isGoing) {
      setToastMessage("Marked as going! Note: Attendance is private by default.");
    } else {
      setToastMessage("Removed from attending events.");
    }
    setTimeout(() => setToastMessage(''), 3500);
  };

  const handleCalendarDownload = () => {
    downloadEventIcs(event);
    setToastMessage('Downloaded calendar invite (.ics)');
    setTimeout(() => setToastMessage(''), 3000);
  };

  const handleConnectWithAttendee = (att: AttendeeProfile) => {
    setSelectedAttendeeForConnect(att);
    setConnectModalOpen(true);
  };

  const existingRequestFor = (attendeeId: string) => {
    return connectionRequests.find(
      (r) =>
        r.eventId === event.id &&
        r.senderId === user?.id &&
        r.recipientId === attendeeId
    );
  };

  const existingConversationWith = (attendeeId: string) => {
    return conversations.find(
      (c) => c.eventId === event.id && c.partner.id === attendeeId
    );
  };

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center p-2 sm:p-4 bg-stone-900/60 backdrop-blur-xs overflow-y-auto">
        <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-stone-100 my-4 sm:my-8 overflow-hidden relative max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-20 p-2.5 rounded-full bg-black/40 hover:bg-black/60 text-white backdrop-blur-md transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Toast Notification */}
          {toastMessage && (
            <div className="absolute top-4 left-4 right-16 z-30 p-3 bg-stone-950 text-amber-300 text-xs font-bold rounded-2xl shadow-xl border border-stone-800 backdrop-blur-md flex items-center gap-2">
              <Check className="w-4 h-4 text-amber-400 stroke-[3]" />
              <span>{toastMessage}</span>
            </div>
          )}

          {/* Scrollable Container */}
          <div className="overflow-y-auto flex-1">
            {/* Header Hero Image */}
            <div className="relative aspect-16/9 sm:aspect-21/9 w-full bg-stone-100">
              {event.coverImage ? (
                <img
                  src={event.coverImage}
                  alt={event.title}
                  referrerPolicy="no-referrer"
                  className={`w-full h-full object-cover ${
                    isCancelled || isEnded ? 'grayscale opacity-60' : ''
                  }`}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-stone-950 text-amber-400 font-bold">
                  {event.category}
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent pointer-events-none" />

              <div className="absolute bottom-4 left-5 right-5 text-white">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-300 mb-1 flex-wrap">
                  <span>{event.category}</span>
                  <span aria-hidden="true">·</span>
                  <span className="truncate">{event.organizer}</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black tracking-tight leading-snug">
                  {event.title}
                </h2>
              </div>
            </div>

            {/* Cancelled or Ended Banner */}
            {isCancelled && (
              <div className="p-4 bg-red-50 border-b border-red-200 text-red-900 text-xs flex items-center gap-2.5">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <div>
                  <span className="font-bold">This event has been cancelled by the organizer.</span> New requests and buddy matching are disabled.
                </div>
              </div>
            )}

            {isEnded && (
              <div className="p-4 bg-stone-100 border-b border-stone-200 text-stone-800 text-xs flex items-center justify-between gap-2.5">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-stone-500 shrink-0" />
                  <div>
                    <span className="font-bold">This event has concluded.</span> Attendee buddy discovery has expired.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => toggleSimulateEventEnded(event.id)}
                  className="px-2.5 py-1 text-[11px] font-bold text-stone-950 bg-white border border-stone-300 rounded-lg hover:bg-stone-50"
                  title="Toggle event status for demonstration"
                >
                  Unmark Ended
                </button>
              </div>
            )}

            {/* Main Content Area */}
            <div className="p-5 sm:p-7 space-y-6">
              {/* Event Credibility & Organizer Distinctions - Requirement 8 */}
              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-2">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-stone-500 block">
                      Organizer Information
                    </span>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-stone-950 text-sm">
                        {event.organizer}
                      </span>
                      {/* Distinguish organization from individual account */}
                      {event.sourceVerification === 'wusa_official' ? (
                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-400 text-stone-950 shadow-2xs">
                          Official WUSA Event · Verified
                        </span>
                      ) : event.isOrganizationAccount ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-stone-200 text-stone-800 border border-stone-300">
                          Organization Account · Demo Unverified
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-stone-950 border border-amber-300">
                          Student Organizer · Demo Unverified
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Report Event Button - Requirement 8 */}
                  <button
                    type="button"
                    onClick={() => {
                      setReportTarget({ type: 'event' });
                      setReportModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold text-stone-600 hover:text-red-700 hover:bg-stone-100 transition-colors border border-stone-200/80"
                  >
                    <Flag className="w-3.5 h-3.5" />
                    <span>Report Event</span>
                  </button>
                </div>
                <p className="text-[11px] text-stone-500">
                  Notice: All organizer accounts in this prototype are fictional representations for testing.
                </p>
              </div>

              {/* Event Quick Facts Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-2xl bg-stone-50 border border-stone-200/80 text-xs">
                <div className="flex items-start gap-2.5">
                  <Calendar className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-stone-900 block">Date & Local Waterloo Time</span>
                    <span className="text-stone-700 font-medium">{formatWaterlooDateWithDst(event.date)}</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-stone-900 block">Time (America/Toronto)</span>
                    <span className="text-stone-700 font-medium">{formatWaterlooTimeRange(event.date, event.startTime, event.endTime)}</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 sm:col-span-2">
                  <MapPin className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <span className="font-bold text-stone-900 block">
                      {event.isOnline ? 'Online Meeting Link' : 'Location & Venue'}
                    </span>
                    <span className="text-stone-800 font-semibold block">
                      {event.venueName || event.location}
                    </span>
                    {event.roomNumber && (
                      <span className="text-xs text-stone-600 block">
                        Room/Area: {event.roomNumber}
                      </span>
                    )}
                    {event.address && (
                      <span className="text-[11px] text-stone-500 block">
                        {event.address}
                      </span>
                    )}
                    {event.arrivalInstructions && (
                      <span className="text-[11px] text-amber-950 bg-amber-50 rounded-md px-2 py-0.5 mt-1 block border border-amber-200">
                        <strong>Arrival notes:</strong> {event.arrivalInstructions}
                      </span>
                    )}
                    {!event.isOnline && event.coordinates && (
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${event.coordinates.lat},${event.coordinates.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-xl bg-stone-950 hover:bg-black text-amber-300 text-xs font-bold transition-colors shadow-2xs"
                      >
                        <Navigation className="w-3.5 h-3.5" />
                        <span>Get Directions on Google Maps</span>
                        <ExternalLink className="w-3 h-3 ml-0.5 opacity-70" />
                      </a>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-2.5 sm:col-span-2 pt-1 border-t border-stone-200/50">
                  <span className="font-bold text-stone-900">Admission / Pricing:</span>
                  <span className="text-amber-700 font-extrabold">
                    {event.isFree ? 'Free Admission' : event.price}
                  </span>
                </div>
              </div>

              {/* Requirement 1: Separate attendance from buddy matching */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  {/* I'm Going Button: Strictly personal attendance */}
                  <button
                    type="button"
                    disabled={isCancelled || isEnded}
                    onClick={handleGoingClick}
                    className={`flex-1 min-w-[140px] py-3 px-4 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition-all shadow-xs ${
                      isCancelled || isEnded
                        ? 'bg-stone-200 text-stone-400 cursor-not-allowed'
                        : isGoing
                        ? 'bg-amber-400 text-stone-950 hover:bg-amber-500'
                        : 'bg-stone-950 hover:bg-black text-amber-300 hover:text-amber-200'
                    }`}
                  >
                    <Check className={`w-4 h-4 ${isGoing ? 'stroke-[3]' : ''}`} />
                    <span>{isGoing ? "I'm Going (Private Attendance)" : "I'm Going"}</span>
                  </button>

                  {/* Save Button */}
                  <button
                    type="button"
                    onClick={() => toggleSaveEvent(event.id)}
                    className={`py-3 px-4 rounded-xl border text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-colors ${
                      isSaved
                        ? 'bg-amber-100 border-amber-300 text-amber-950'
                        : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
                    }`}
                  >
                    <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-amber-950 text-amber-950' : ''}`} />
                    <span>{isSaved ? 'Saved' : 'Save'}</span>
                  </button>

                  {/* Add to Calendar Button */}
                  <button
                    type="button"
                    onClick={handleCalendarDownload}
                    className="py-3 px-4 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-colors"
                  >
                    <CalendarPlus className="w-4 h-4 text-amber-600" />
                    <span>Add to Calendar (.ics)</span>
                  </button>
                </div>

                <p className="text-[11px] text-stone-500 leading-normal">
                  Marking &ldquo;I&apos;m going&rdquo; tracks the event on your personal schedule. It does <strong className="text-stone-700">not</strong> make you visible to other attendees.
                </p>
              </div>

              {/* Official Registration Notice */}
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-300/80 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-950">
                    <Info className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>Registration Distinction</span>
                  </div>
                  {event.registrationDeadline && (
                    <span className="text-[11px] font-bold text-stone-950 bg-amber-400 px-2 py-0.5 rounded-md">
                      Deadline: {event.registrationDeadline}
                    </span>
                  )}
                </div>

                <p className="text-xs text-stone-700 leading-relaxed">
                  Marking attendance in WatHive indicates your interest to fellow students. It does not replace official event tickets or external club registration.
                </p>

                {event.registrationUrl && (
                  <div className="pt-1">
                    <a
                      href={event.registrationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-stone-950 hover:text-amber-800 underline underline-offset-2"
                    >
                      <span>Complete Official Registration at Organizer Website</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )}
              </div>

              {/* Description */}
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-stone-900">About this event</h3>
                <p className="text-xs sm:text-sm text-stone-700 leading-relaxed whitespace-pre-line">
                  {event.description}
                </p>
              </div>

              {/* Eligibility & Accessibility details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-stone-100">
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-stone-900">Eligibility & Audience</h4>
                  <p className="text-xs text-stone-600 leading-normal">
                    {event.eligibility || 'Open to all University of Waterloo students.'}
                  </p>
                </div>

                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-stone-900">Accessibility Information</h4>
                  <p className="text-xs text-stone-600 leading-normal">
                    {event.accessibility || 'Standard accessible campus venue with barrier-free entry.'}
                  </p>
                </div>
              </div>

              {/* SECTION: Personalized Buddy-Matching System — Our Core Differentiator */}
              <div className="p-5 sm:p-6 rounded-3xl bg-stone-50 border border-stone-200/90 space-y-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <HeartHandshake className="w-5 h-5 text-amber-600 shrink-0" />
                      <h3 className="text-base font-bold text-stone-950">
                        Personalized Buddy-Matching System
                      </h3>
                      <span className="text-[10px] bg-amber-400 text-stone-950 font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                        Core Feature
                      </span>
                    </div>
                    <p className="text-xs text-stone-600 leading-relaxed">
                      Find someone compatible to attend with based on your personality vibe, shared interests, and preferred group sizes.
                    </p>
                  </div>

                  {/* Prototype demo simulation toggle for post-event */}
                  <button
                    type="button"
                    onClick={() => toggleSimulateEventEnded(event.id)}
                    className="text-[10px] font-bold text-stone-500 hover:text-stone-800 bg-stone-100 hover:bg-stone-200 px-2.5 py-1 rounded-lg border border-stone-200 shrink-0 transition-colors"
                    title="Simulate Event Ended state for prototype verification"
                  >
                    {isEnded ? '↺ Reset Event' : 'Simulate Ended'}
                  </button>
                </div>

                {/* Case 1: Research Study Exclusion */}
                {event.isResearchStudy ? (
                  <div className="p-4 bg-white rounded-2xl border border-stone-200 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-stone-800">
                      <Shield className="w-4 h-4 text-stone-500" />
                      <span>Confidential Study Protocol</span>
                    </div>
                    <p className="text-xs text-stone-600 leading-relaxed">
                      To protect participant privacy and uphold university research ethics protocols, attendee matching is strictly disabled for all research recruitment studies.
                    </p>
                  </div>
                ) : isEnded ? (
                  /* Case 2: Event Ended */
                  <div className="p-4 bg-white rounded-2xl border border-stone-200 text-center space-y-1">
                    <Clock className="w-6 h-6 text-stone-400 mx-auto mb-1" />
                    <p className="text-xs font-bold text-stone-900">
                      Event Concluded — Buddy Matching Closed
                    </p>
                    <p className="text-[11px] text-stone-500 max-w-sm mx-auto">
                      Buddy discovery automatically closes when an event ends. Existing connected buddies can continue messaging in the Messages tab.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Personality & Compatibility Quiz Status Bar */}
                    <div className="p-3.5 bg-amber-500/10 rounded-2xl border border-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-amber-400 text-stone-950 flex items-center justify-center font-bold shrink-0">
                          <Sparkles className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-stone-950">
                              Personality & Interests Compatibility
                            </span>
                            <span className="text-[10px] bg-stone-900 text-amber-300 font-bold px-1.5 py-0.2 rounded">
                              Transparent Algorithm
                            </span>
                          </div>
                          <p className="text-[11px] text-stone-600">
                            {user?.personalityQuiz
                              ? `Matching profile: ${user.personalityQuiz.socialEnergy} energy · ${user.personalityQuiz.socialEnvironment.replace('_', ' ')} · ${user.personalityQuiz.groupSize} group`
                              : 'Take our 1-minute quiz to unlock precise % compatibility with fellow attendees.'}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setQuizModalOpen(true)}
                        className="self-start sm:self-center px-3 py-1.5 bg-stone-950 hover:bg-black text-amber-300 text-xs font-bold rounded-xl flex items-center gap-1 shrink-0 transition-colors shadow-2xs"
                      >
                        <Sliders className="w-3 h-3 text-amber-400" />
                        <span>{user?.personalityQuiz ? 'Edit Quiz Profile' : 'Take 1-Min Quiz'}</span>
                      </button>
                    </div>

                    {/* Student Verification Notice if unverified */}
                    {!user?.isVerifiedUWStudent && (
                      <div className="p-4 bg-amber-100 rounded-2xl border border-amber-300 text-xs space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 font-bold text-amber-950">
                            <Shield className="w-4 h-4 text-amber-700 shrink-0" />
                            <span>Waterloo Student Verification Required</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setVerificationModalOpen(true)}
                            className="px-3 py-1 bg-amber-400 text-stone-950 hover:bg-amber-500 font-bold rounded-lg text-xs transition-colors shadow-2xs"
                          >
                            Verify @uwaterloo.ca
                          </button>
                        </div>
                        <p className="text-[11px] text-stone-700 leading-normal">
                          Buddy matching is restricted exclusively to verified University of Waterloo students. Unverified accounts can browse events but cannot opt into matching or send buddy requests.
                        </p>
                      </div>
                    )}

                    {/* Core Toggle Card: "I want to go with someone!" */}
                    <div className="p-4 sm:p-5 bg-white rounded-2xl border-2 border-amber-400 shadow-sm space-y-3">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-stone-950">
                              &ldquo;I want to go with someone!&rdquo;
                            </span>
                            {isBuddyMatchingActive ? (
                              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                Active for this event
                              </span>
                            ) : (
                              <span className="text-[10px] bg-stone-100 text-stone-600 font-medium px-2 py-0.5 rounded-full">
                                Off by default
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-stone-600">
                            {isBuddyMatchingActive
                              ? 'You are eligible to be matched with other verified Waterloo students attending this event.'
                              : 'Turn on to discover and match with compatible Waterloo students heading to this event.'}
                          </p>
                        </div>

                        {/* Toggle Button */}
                        {isBuddyMatchingActive ? (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setPreviewModalOpen(true)}
                              className="px-3 py-1.5 rounded-xl border border-stone-200 hover:bg-stone-50 text-stone-700 text-xs font-bold transition-colors"
                            >
                              Edit Visibility
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                disableBuddyMatching(event.id);
                                setToastMessage("Buddy matching turned off for this event.");
                                setTimeout(() => setToastMessage(''), 3500);
                              }}
                              className="px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-red-700 text-xs font-bold transition-colors"
                            >
                              Turn Off
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
                              if (!isGoing) {
                                toggleGoing(event.id);
                                setToastMessage("Marked 'I\'m Going'! Now configure buddy privacy.");
                              }
                              setPreviewModalOpen(true);
                            }}
                            className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-stone-950 text-xs sm:text-sm font-black flex items-center gap-2 shadow-sm transition-all hover:scale-[1.02] active:scale-95"
                          >
                            <Sparkles className="w-4 h-4 text-stone-950" />
                            <span>I want to go with someone!</span>
                          </button>
                        )}
                      </div>

                      {/* Explicit rules reminder */}
                      <div className="text-[11px] text-stone-500 border-t border-stone-100 pt-2 flex flex-wrap items-center justify-between gap-1">
                        <span>
                          🔒 Privacy rule: Only opted-in, verified Waterloo attendees for <strong>this specific event</strong> can see your profile.
                        </span>
                        {!isGoing && !isBuddyMatchingActive && (
                          <span className="text-amber-800 font-semibold">
                            Tip: Activating also marks you as attending.
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Suggested Matches Section (Ranked by Compatibility) */}
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between text-xs flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-stone-900 text-sm">
                            Suggested Matches Attending This Event
                          </span>
                          <span className="text-[10px] bg-amber-100 text-amber-900 font-black px-2 py-0.5 rounded-full">
                            Ranked by Compatibility
                          </span>
                        </div>
                        <span className="text-[11px] text-stone-500">
                          Never matched across different events
                        </span>
                      </div>

                      {(() => {
                        const suggested = getSuggestedMatches(event.id);

                        if (suggested.length === 0) {
                          return (
                            <div className="p-6 bg-white rounded-2xl border border-stone-200 text-center space-y-1">
                              <Users className="w-8 h-8 text-stone-300 mx-auto" />
                              <p className="text-xs font-semibold text-stone-800">
                                No other attendees visible yet
                              </p>
                              <p className="text-[11px] text-stone-500 max-w-xs mx-auto">
                                Enable &ldquo;I want to go with someone!&rdquo; above. As other students opt in, they will be ranked here by social compatibility!
                              </p>
                            </div>
                          );
                        }

                        return (
                          <div className="space-y-3">
                            {suggested.map(({ attendee, compatibility }) => {
                              const isMe = attendee.id === user?.id;
                              const existingReq = existingRequestFor(attendee.id);
                              const existingConv = existingConversationWith(attendee.id);

                              // Check if the attendee sent a request to the user
                              const incomingReq = connectionRequests.find(
                                (r) =>
                                  r.eventId === event.id &&
                                  r.senderId === attendee.id &&
                                  r.recipientId === user?.id &&
                                  r.status === 'pending'
                              );

                              return (
                                <div
                                  key={attendee.id}
                                  className="p-4 bg-white rounded-2xl border border-stone-200 hover:border-amber-300 transition-all space-y-3 shadow-2xs"
                                >
                                  {/* Attendee Info Header */}
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-start gap-3 min-w-0">
                                      <img
                                        src={attendee.avatar}
                                        alt={attendee.name}
                                        referrerPolicy="no-referrer"
                                        className="w-11 h-11 rounded-full object-cover border-2 border-amber-400 shrink-0"
                                      />
                                      <div className="min-w-0 space-y-0.5">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <h4 className="font-bold text-stone-950 text-sm truncate">
                                            {attendee.name}
                                          </h4>
                                          {isMe && (
                                            <span className="text-[10px] bg-amber-400 text-stone-950 font-black px-1.5 py-0.2 rounded-md">
                                              You
                                            </span>
                                          )}
                                          <span className="text-[10px] bg-stone-950 text-amber-300 font-bold px-1.5 py-0.2 rounded-md flex items-center gap-0.5">
                                            <Check className="w-2.5 h-2.5 text-amber-400" />
                                            Verified Student
                                          </span>
                                        </div>

                                        {(attendee.faculty || attendee.year) && (
                                          <p className="text-xs text-stone-600 truncate">
                                            {attendee.faculty && attendee.faculty}
                                            {attendee.program ? ` · ${attendee.program}` : ''}
                                            {attendee.year ? ` (${attendee.year})` : ''}
                                          </p>
                                        )}

                                        {attendee.bio && !isMe && (
                                          <p className="text-xs text-stone-600 italic line-clamp-1 pt-0.5">
                                            &ldquo;{attendee.bio}&rdquo;
                                          </p>
                                        )}
                                      </div>
                                    </div>

                                    {/* Compatibility Score Badge */}
                                    {!isMe && (
                                      <div className="flex flex-col items-end shrink-0">
                                        <div className="px-2.5 py-1 rounded-xl bg-amber-400 text-stone-950 font-black text-xs sm:text-sm flex items-center gap-1 shadow-2xs">
                                          <Sparkles className="w-3.5 h-3.5" />
                                          <span>{compatibility.score}% Match</span>
                                        </div>
                                        <span className="text-[10px] font-bold text-amber-900 mt-0.5">
                                          {compatibility.score >= 90
                                            ? 'Exceptional Match'
                                            : compatibility.score >= 80
                                            ? 'Great Match'
                                            : 'Compatible'}
                                        </span>
                                      </div>
                                    )}
                                  </div>

                                  {/* Transparent Compatibility Reasons (Requirement 1) */}
                                  {!isMe && compatibility.reasons.length > 0 && (
                                    <div className="p-2.5 bg-stone-50 rounded-xl border border-stone-200/80 text-[11px] space-y-1.5">
                                      <div className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                                        Why you two are matched:
                                      </div>
                                      <div className="flex flex-wrap gap-1.5">
                                        {compatibility.reasons.map((reason, idx) => (
                                          <span
                                            key={idx}
                                            className="px-2 py-0.5 rounded-lg bg-white border border-stone-200 text-stone-700 font-medium text-[10px] shadow-2xs"
                                          >
                                            ✓ {reason}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Incoming Request Notification & Accept/Decline Controls */}
                                  {incomingReq && (
                                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-300 text-xs space-y-2">
                                      <div className="flex items-center justify-between font-bold text-amber-950">
                                        <span>Incoming Buddy Request</span>
                                        <span className="text-[10px] text-amber-800">
                                          {incomingReq.compatibilityScore}% Compatibility
                                        </span>
                                      </div>
                                      <p className="text-stone-700 italic">
                                        &ldquo;{incomingReq.introMessage}&rdquo;
                                      </p>
                                      <div className="flex items-center gap-2 pt-1">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            respondConnectionRequest(incomingReq.id, 'accept');
                                            setToastMessage("Match accepted! You can now start chatting.");
                                            setTimeout(() => setToastMessage(''), 3500);
                                          }}
                                          className="flex-1 py-1.5 px-3 bg-amber-400 hover:bg-amber-500 text-stone-950 rounded-lg font-black text-xs transition-colors text-center"
                                        >
                                          Accept Match
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            respondConnectionRequest(incomingReq.id, 'decline');
                                            setToastMessage("Request declined politely without reason.");
                                            setTimeout(() => setToastMessage(''), 3500);
                                          }}
                                          className="py-1.5 px-3 bg-stone-200 hover:bg-stone-300 text-stone-700 rounded-lg font-semibold text-xs transition-colors"
                                        >
                                          Decline
                                        </button>
                                      </div>
                                    </div>
                                  )}

                                  {/* Action Buttons for Outgoing Requests / Messaging */}
                                  <div className="flex items-center justify-between pt-1 border-t border-stone-100 flex-wrap gap-2">
                                    <div className="text-[11px] text-stone-500">
                                      {isMe ? (
                                        <span className="text-amber-900 font-bold">
                                          Your profile is visible to attendees for this event
                                        </span>
                                      ) : existingConv ? (
                                        <span className="text-emerald-700 font-semibold flex items-center gap-1">
                                          <CheckCircle2 className="w-3.5 h-3.5" />
                                          Connected Buddy
                                        </span>
                                      ) : existingReq && existingReq.status === 'pending' ? (
                                        <span className="text-stone-600 font-medium">
                                          Waiting for {attendee.name} to accept
                                        </span>
                                      ) : existingReq && existingReq.status === 'declined' ? (
                                        <span className="text-stone-400">
                                          Request declined for this event
                                        </span>
                                      ) : (
                                        <span>Mutual consent required before chat unlocks</span>
                                      )}
                                    </div>

                                    <div className="flex items-center gap-2">
                                      {isMe ? null : existingConv ? (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            onClose();
                                            onNavigateToMessages?.();
                                          }}
                                          className="px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-stone-950 text-xs font-black flex items-center gap-1.5 transition-colors shadow-2xs"
                                        >
                                          <MessageCircle className="w-3.5 h-3.5" />
                                          <span>Open In-App Chat</span>
                                        </button>
                                      ) : existingReq && existingReq.status === 'pending' ? (
                                        <div className="flex items-center gap-2">
                                          <span className="text-[11px] text-stone-700 bg-stone-100 px-2.5 py-1 rounded-lg font-medium">
                                            Request Pending
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() => withdrawConnectionRequest(existingReq.id)}
                                            className="text-[11px] text-red-700 hover:text-red-900 hover:underline font-semibold"
                                          >
                                            Withdraw
                                          </button>
                                        </div>
                                      ) : existingReq && existingReq.status === 'declined' ? (
                                        <span className="text-[11px] text-stone-500 bg-stone-100 px-2.5 py-1 rounded-lg">
                                          Declined
                                        </span>
                                      ) : !incomingReq ? (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (!user?.isVerifiedUWStudent) {
                                              setVerificationModalOpen(true);
                                              return;
                                            }
                                            handleConnectWithAttendee(attendee);
                                          }}
                                          className="px-3.5 py-1.5 rounded-xl bg-stone-950 hover:bg-black text-amber-300 hover:text-amber-200 text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all border border-stone-800"
                                        >
                                          <HeartHandshake className="w-3.5 h-3.5 text-amber-400" />
                                          <span>Want to go together?</span>
                                        </button>
                                      ) : null}

                                      {/* Block / Report on buddy profile card */}
                                      {!isMe && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setReportTarget({ type: 'user', attendee });
                                            setReportModalOpen(true);
                                          }}
                                          className="p-1.5 text-stone-400 hover:text-red-700 hover:bg-stone-100 rounded-lg transition-colors"
                                          title="Block or report attendee"
                                        >
                                          <Flag className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Buddy Privacy Preview Modal (Requirement 1 & 2) */}
      <BuddyPrivacyPreviewModal
        isOpen={previewModalOpen}
        event={event}
        onClose={() => setPreviewModalOpen(false)}
        onOptInSuccess={() => {
          setToastMessage("Buddy matching enabled for this event!");
          setTimeout(() => setToastMessage(''), 3500);
        }}
      />

      {/* Buddy Connect Intro Modal (Requirement 3 & 6) */}
      {selectedAttendeeForConnect && (
        <BuddyConnectModal
          isOpen={connectModalOpen}
          event={event}
          attendee={selectedAttendeeForConnect}
          onClose={() => {
            setConnectModalOpen(false);
            setSelectedAttendeeForConnect(null);
          }}
          onSuccess={() => {
            setToastMessage(`Invitation sent to ${selectedAttendeeForConnect.name}!`);
            setTimeout(() => setToastMessage(''), 3500);
          }}
        />
      )}

      {/* Report Modal for User or Event (Requirement 5 & 8) */}
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
            setToastMessage(
              reportTarget.type === 'user'
                ? action === 'block'
                  ? 'Attendee blocked.'
                  : 'Report recorded locally.'
                : 'Event reported locally.'
            );
            setTimeout(() => setToastMessage(''), 3500);
          }}
        />
      )}

      {/* UW Student Verification Modal */}
      <UWVerificationModal
        isOpen={verificationModalOpen}
        onClose={() => setVerificationModalOpen(false)}
        onSuccess={() => {
          setToastMessage("Verified as University of Waterloo student! Buddy matching unlocked.");
          setTimeout(() => setToastMessage(''), 3500);
        }}
      />

      {/* Personality & Interests Quiz Modal */}
      <PersonalityQuizModal
        isOpen={quizModalOpen}
        onClose={() => setQuizModalOpen(false)}
        onSuccess={() => {
          setToastMessage("Personality & Interests profile updated! Compatibility scores recalculated.");
          setTimeout(() => setToastMessage(''), 3500);
        }}
      />
    </>
  );
};
