import React, { useState } from 'react';
import {
  Calendar as CalendarIcon,
  Bell,
  Sliders,
  Check,
  CalendarPlus,
  ExternalLink,
  MapPin,
  Clock,
  Sparkles,
  Shield,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Info,
  HeartHandshake,
  MessageCircle,
  Tag,
  Download,
  CheckCircle2,
  Trash2,
  Layers,
  ArrowUpRight,
  Bookmark
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  EventItem,
  NotificationInterestCategory,
  NotificationTypePreferences,
  NotificationFrequency,
  InAppNotification
} from '../../types';
import { NOTIFICATION_CATEGORIES } from '../../data/mockData';
import {
  getGoogleCalendarUrl,
  getOutlookCalendarUrl,
  downloadEventIcs,
  downloadAllEventsIcs
} from '../../utils/calendar';
import { EventDetailModal } from '../feed/EventDetailModal';

interface CalendarNotificationsTabProps {
  onNavigateToMessages?: () => void;
  onNavigateToFeed?: () => void;
}

export const CalendarNotificationsTab: React.FC<CalendarNotificationsTabProps> = ({
  onNavigateToMessages,
  onNavigateToFeed
}) => {
  const {
    events,
    attendingEventIds,
    savedEventIds,
    attendeeVisibility,
    conversations,
    notificationSettings,
    updateNotificationSettings,
    notifications,
    unreadNotificationsCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deleteNotification,
    simulateTestNotification
  } = useApp();

  // Active subview: 'calendar' | 'notifications' | 'preferences'
  const [activeSubView, setActiveSubView] = useState<'calendar' | 'notifications' | 'preferences'>('calendar');

  // Calendar View: 'schedule' (list/agenda) vs 'month'
  const [calendarViewMode, setCalendarViewMode] = useState<'schedule' | 'month'>('schedule');
  const [includeSavedInCalendar, setIncludeSavedInCalendar] = useState<boolean>(false);
  const [selectedEventForDetail, setSelectedEventForDetail] = useState<EventItem | null>(null);
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [actionNotice, setActionNotice] = useState('');

  // Notification Inbox Filter: 'all' | 'unread' | 'buddy' | 'reminders' | 'deals'
  const [notifFilter, setNotifFilter] = useState<'all' | 'unread' | 'buddy' | 'reminders' | 'deals'>('all');

  // Current calendar browsing date
  const [currentDate, setCurrentDate] = useState(() => new Date(2026, 9, 25)); // Oct 2026

  // Form state for preferences
  const [selectedCategories, setSelectedCategories] = useState<NotificationInterestCategory[]>(
    notificationSettings.interestedCategories
  );
  const [channelTypes, setChannelTypes] = useState<NotificationTypePreferences>(
    notificationSettings.types
  );
  const [frequency, setFrequency] = useState<NotificationFrequency>(notificationSettings.frequency);
  const [quietHours, setQuietHours] = useState<boolean>(notificationSettings.quietHoursEnabled);
  const [avoidOverwhelming, setAvoidOverwhelming] = useState<boolean>(notificationSettings.avoidOverwhelming);

  // Filter RSVP'd and optionally saved events
  const attendingEvents = events.filter((e) => attendingEventIds.includes(e.id));
  const calendarEvents = events.filter((e) => {
    if (attendingEventIds.includes(e.id)) return true;
    if (includeSavedInCalendar && savedEventIds.includes(e.id)) return true;
    return false;
  }).sort((a, b) => (a.date > b.date ? 1 : -1));

  const showToast = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(''), 3500);
  };

  const handleSavePreferences = (e: React.FormEvent) => {
    e.preventDefault();
    updateNotificationSettings({
      interestedCategories: selectedCategories,
      types: channelTypes,
      frequency,
      quietHoursEnabled: quietHours,
      avoidOverwhelming
    });
    showToast('Notification preferences updated successfully!');
  };

  const toggleCategory = (cat: NotificationInterestCategory) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  // Month navigation
  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  // Build Month Grid
  const currentYear = currentDate.getFullYear();
  const currentMonthIdx = currentDate.getMonth();
  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const firstDayOfMonth = new Date(currentYear, currentMonthIdx, 1).getDay(); // 0 = Sun
  const daysInMonth = new Date(currentYear, currentMonthIdx + 1, 0).getDate();

  const calendarDays = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    calendarDays.push(null);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day);
  }

  // Filter notifications based on tab filter
  const filteredNotifications = notifications.filter((n) => {
    if (notifFilter === 'unread') return !n.read;
    if (notifFilter === 'buddy') return n.type === 'buddy_match';
    if (notifFilter === 'reminders') return n.type === 'upcoming_reminder' || n.type === 'registration_deadline';
    if (notifFilter === 'deals') return n.type === 'student_discount';
    return true;
  });

  return (
    <div className="pb-20 md:pb-12 max-w-6xl mx-auto space-y-6">
      {/* Toast Notice */}
      {actionNotice && (
        <div className="p-3 bg-stone-950 text-amber-300 text-xs font-bold rounded-2xl shadow-xl border border-stone-800 flex items-center gap-2 animate-in fade-in">
          <Check className="w-4 h-4 text-amber-400 stroke-[3]" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Main Feature Header Card */}
      <div className="bg-white rounded-3xl border border-stone-200 p-6 sm:p-7 shadow-xs relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="w-9 h-9 rounded-xl bg-stone-950 text-amber-400 flex items-center justify-center font-bold">
                <CalendarIcon className="w-5 h-5" />
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-stone-950 tracking-tight">
                Campus Calendar & Notifications
              </h1>
              <span className="text-[10px] bg-amber-400 text-stone-950 font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                Personalized
              </span>
            </div>
            <p className="text-xs sm:text-sm text-stone-600 max-w-2xl leading-relaxed">
              Track all your RSVP&apos;d campus events, coordinate external tickets and buddy status, and tailor alerts strictly to the event categories you care about.
            </p>
          </div>

          {/* Quick Sync & Actions */}
          <div className="flex items-center gap-2 flex-wrap self-start sm:self-center">
            <button
              type="button"
              onClick={() => setSyncModalOpen(true)}
              className="px-3.5 py-2 bg-stone-950 hover:bg-black text-amber-300 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all border border-stone-800"
            >
              <CalendarPlus className="w-3.5 h-3.5 text-amber-400" />
              <span>Sync with Google / External</span>
            </button>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="mt-6 pt-5 border-t border-stone-100 flex items-center p-1 bg-stone-100 rounded-2xl w-fit flex-wrap gap-1">
          <button
            type="button"
            onClick={() => setActiveSubView('calendar')}
            className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center gap-2 ${
              activeSubView === 'calendar'
                ? 'bg-white text-stone-950 shadow-xs'
                : 'text-stone-600 hover:text-stone-950'
            }`}
          >
            <CalendarIcon className="w-4 h-4 text-amber-600" />
            <span>My In-App Calendar ({attendingEvents.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubView('notifications')}
            className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center gap-2 relative ${
              activeSubView === 'notifications'
                ? 'bg-white text-stone-950 shadow-xs'
                : 'text-stone-600 hover:text-stone-950'
            }`}
          >
            <Bell className="w-4 h-4 text-amber-600" />
            <span>Notification Inbox</span>
            {unreadNotificationsCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-amber-400 text-stone-950 text-[10px] font-black flex items-center justify-center">
                {unreadNotificationsCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveSubView('preferences')}
            className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center gap-2 ${
              activeSubView === 'preferences'
                ? 'bg-white text-stone-950 shadow-xs'
                : 'text-stone-600 hover:text-stone-950'
            }`}
          >
            <Sliders className="w-4 h-4 text-amber-600" />
            <span>Notification Preferences</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* SECTION B: PERSONALIZED CALENDAR */}
      {/* ======================================================== */}
      {activeSubView === 'calendar' && (
        <div className="space-y-5">
          {/* Calendar Controls & Critical Distinction Callout */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-stone-200">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-stone-800">Calendar View:</span>
              <div className="flex items-center p-1 bg-stone-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setCalendarViewMode('schedule')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                    calendarViewMode === 'schedule'
                      ? 'bg-white text-stone-950 shadow-2xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  Schedule / Agenda List
                </button>
                <button
                  type="button"
                  onClick={() => setCalendarViewMode('month')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                    calendarViewMode === 'month'
                      ? 'bg-white text-stone-950 shadow-2xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  Month Grid
                </button>
              </div>

              <label className="flex items-center gap-2 text-xs text-stone-700 cursor-pointer pl-2">
                <input
                  type="checkbox"
                  checked={includeSavedInCalendar}
                  onChange={(e) => setIncludeSavedInCalendar(e.target.checked)}
                  className="w-4 h-4 accent-amber-500 rounded text-amber-500"
                />
                <span>Include Saved Events ({savedEventIds.length})</span>
              </label>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  downloadAllEventsIcs(attendingEvents);
                  showToast('Downloaded combined .ics for all RSVP\'d events!');
                }}
                disabled={attendingEvents.length === 0}
                className="px-3 py-1.5 rounded-xl border border-stone-200 hover:bg-stone-50 text-stone-800 text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5 text-amber-600" />
                <span>Export All (.ics)</span>
              </button>
            </div>
          </div>

          {/* CRITICAL DISTINCTION BANNER: Requirement B */}
          <div className="p-4 bg-amber-500/10 rounded-2xl border border-amber-300 text-xs space-y-1.5 text-stone-800">
            <div className="flex items-center gap-2 font-bold text-amber-950">
              <Shield className="w-4 h-4 text-amber-700 shrink-0" />
              <span>RSVP vs. External Registration & Official Tickets Notice</span>
            </div>
            <p className="leading-relaxed">
              <strong>WatHive In-App RSVP:</strong> Confirms your intention to attend and allows pairing with event buddies. It is private by default.
            </p>
            <p className="leading-relaxed text-stone-700">
              <strong className="text-stone-950">External Registration:</strong> Many campus events, career showcases, or hackathons require separate external registration or paid admission through the organizer. WatHive does <strong>not</strong> issue barcodes or imply that an external registration or purchased ticket is complete unless explicitly verified by the organizer.
            </p>
          </div>

          {/* MONTH GRID VIEW */}
          {calendarViewMode === 'month' && (
            <div className="bg-white rounded-3xl border border-stone-200 p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-stone-950">{monthName}</h3>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={prevMonth}
                    className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-600"
                    aria-label="Previous Month"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={nextMonth}
                    className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-600"
                    aria-label="Next Month"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Weekday headers */}
              <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-stone-500 uppercase tracking-wider pb-1">
                <span>Sun</span>
                <span>Mon</span>
                <span>Tue</span>
                <span>Wed</span>
                <span>Thu</span>
                <span>Fri</span>
                <span>Sat</span>
              </div>

              {/* Days grid */}
              <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                {calendarDays.map((day, idx) => {
                  if (day === null) {
                    return <div key={`empty_${idx}`} className="h-20 sm:h-24 bg-stone-50/50 rounded-xl" />;
                  }

                  const dayStr = `${currentYear}-${String(currentMonthIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const dayEvents = calendarEvents.filter((e) => e.date === dayStr);

                  return (
                    <div
                      key={`day_${day}`}
                      className={`h-20 sm:h-24 p-1.5 rounded-xl border flex flex-col justify-between transition-colors overflow-hidden ${
                        dayEvents.length > 0
                          ? 'border-amber-300 bg-amber-50/40'
                          : 'border-stone-100 bg-stone-50/20 hover:border-stone-200'
                      }`}
                    >
                      <span className={`text-xs font-bold ${dayEvents.length > 0 ? 'text-amber-950' : 'text-stone-500'}`}>
                        {day}
                      </span>

                      {/* Event chips */}
                      <div className="space-y-1 overflow-y-auto max-h-14">
                        {dayEvents.map((ev) => (
                          <div
                            key={ev.id}
                            onClick={() => setSelectedEventForDetail(ev)}
                            className="p-1 rounded-md bg-stone-950 text-amber-300 hover:bg-black text-[10px] font-bold truncate cursor-pointer transition-colors shadow-2xs"
                            title={`${ev.title} (${ev.startTime})`}
                          >
                            {ev.title}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SCHEDULE / AGENDA LIST VIEW */}
          {calendarEvents.length === 0 ? (
            <div className="p-12 bg-white rounded-3xl border border-stone-200 text-center space-y-3">
              <CalendarIcon className="w-10 h-10 text-stone-300 mx-auto" />
              <h3 className="text-base font-bold text-stone-900">Your calendar is currently empty</h3>
              <p className="text-xs text-stone-500 max-w-sm mx-auto">
                Browse the Campus Feed and select &ldquo;I&apos;m Going&rdquo; on any event to build your personalized Waterloo schedule!
              </p>
              <button
                type="button"
                onClick={onNavigateToFeed}
                className="px-4 py-2 bg-amber-400 hover:bg-amber-500 text-stone-950 font-bold text-xs rounded-xl transition-colors shadow-2xs"
              >
                Browse Campus Events
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {calendarEvents.map((ev) => {
                const isGoing = attendingEventIds.includes(ev.id);
                const isSaved = savedEventIds.includes(ev.id);
                const isBuddyActive = attendeeVisibility[ev.id] ?? false;
                const conv = conversations.find((c) => c.eventId === ev.id);

                return (
                  <div
                    key={ev.id}
                    className="p-5 sm:p-6 bg-white rounded-3xl border border-stone-200 hover:border-amber-300 transition-all space-y-4 shadow-xs"
                  >
                    {/* Header: Title, Category, Timing */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-amber-700">{ev.category}</span>
                          <span className="text-stone-300">·</span>
                          <span className="text-xs text-stone-500 font-medium">{ev.organizer}</span>
                        </div>
                        <h4
                          onClick={() => setSelectedEventForDetail(ev)}
                          className="text-base sm:text-lg font-black text-stone-950 hover:text-amber-800 cursor-pointer transition-colors"
                        >
                          {ev.title}
                        </h4>
                      </div>

                      {/* In-App Attendance Badges */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {isGoing && (
                          <span className="text-xs font-black bg-amber-400 text-stone-950 px-2.5 py-1 rounded-xl shadow-2xs flex items-center gap-1">
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                            RSVP: I&apos;m Going
                          </span>
                        )}
                        {!isGoing && isSaved && (
                          <span className="text-xs font-bold bg-stone-100 text-stone-700 px-2.5 py-1 rounded-xl flex items-center gap-1">
                            <Bookmark className="w-3.5 h-3.5 text-stone-500" />
                            Saved for Later
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Details Grid: Date/Time, Location, Status */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs p-3.5 bg-stone-50 rounded-2xl border border-stone-200/80">
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="w-4 h-4 text-amber-600 shrink-0" />
                        <div>
                          <span className="font-bold text-stone-900 block">Date & Time</span>
                          <span className="text-stone-600">{ev.date} · {ev.startTime} – {ev.endTime}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-amber-600 shrink-0" />
                        <div className="min-w-0">
                          <span className="font-bold text-stone-900 block">Location</span>
                          <span className="text-stone-600 truncate block">{ev.venueName || ev.location}</span>
                        </div>
                      </div>

                      {/* Official Registration & Ticket Distinction - Requirement B */}
                      <div className="sm:col-span-2 pt-2 border-t border-stone-200/60 space-y-1.5">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <span className="font-bold text-stone-900">
                            External Admission / Ticket Status:
                          </span>
                          <span className="text-[11px] font-semibold text-stone-600 bg-white px-2 py-0.5 rounded-lg border border-stone-200">
                            {ev.isFree ? 'Free Admission' : `Price: ${ev.price}`} · Organizer registration required
                          </span>
                        </div>

                        {ev.registrationUrl ? (
                          <div className="flex items-center justify-between flex-wrap gap-2 pt-0.5">
                            <span className="text-[11px] text-stone-500">
                              Official registration is managed externally by {ev.organizer}.
                            </span>
                            <a
                              href={ev.registrationUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 font-bold text-xs text-stone-950 hover:text-amber-800 underline"
                            >
                              <span>Complete Official Registration</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        ) : (
                          <span className="text-[11px] text-stone-500 block">
                            No external registration URL specified by organizer. Admission details subject to venue capacity.
                          </span>
                        )}
                      </div>

                      {/* Buddy Matching Status - Requirement B */}
                      <div className="sm:col-span-2 pt-2 border-t border-stone-200/60 flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-1.5">
                          <HeartHandshake className="w-4 h-4 text-amber-600 shrink-0" />
                          <span className="font-bold text-stone-900">Buddy Matching Status:</span>
                          <span className="text-stone-700">
                            {conv ? (
                              <strong className="text-emerald-800">Connected with {conv.partner.name}</strong>
                            ) : isBuddyActive ? (
                              <span className="text-amber-900 font-semibold">Active &ldquo;I want to go with someone!&rdquo;</span>
                            ) : (
                              <span className="text-stone-500">Private Attendance (Buddy matching off)</span>
                            )}
                          </span>
                        </div>

                        {conv && (
                          <button
                            type="button"
                            onClick={onNavigateToMessages}
                            className="px-2.5 py-1 bg-amber-400 hover:bg-amber-500 text-stone-950 rounded-lg font-bold text-xs flex items-center gap-1 transition-colors shadow-2xs"
                          >
                            <MessageCircle className="w-3 h-3" />
                            <span>Open Buddy Chat</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Quick Calendar Sync & Actions */}
                    <div className="flex items-center justify-between pt-1 border-t border-stone-100 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedEventForDetail(ev)}
                          className="px-3.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold rounded-xl transition-colors"
                        >
                          View Full Details
                        </button>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        {/* 1-Click Google Calendar */}
                        <a
                          href={getGoogleCalendarUrl(ev)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 rounded-xl bg-white border border-stone-200 hover:border-amber-400 text-stone-900 text-xs font-bold flex items-center gap-1 transition-colors shadow-2xs"
                        >
                          <span>+ Google Calendar</span>
                          <ArrowUpRight className="w-3 h-3 text-stone-400" />
                        </a>

                        {/* 1-Click Outlook */}
                        <a
                          href={getOutlookCalendarUrl(ev)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 rounded-xl bg-white border border-stone-200 hover:border-amber-400 text-stone-900 text-xs font-bold flex items-center gap-1 transition-colors shadow-2xs"
                        >
                          <span>+ Outlook Web</span>
                          <ArrowUpRight className="w-3 h-3 text-stone-400" />
                        </a>

                        {/* Download .ics */}
                        <button
                          type="button"
                          onClick={() => {
                            downloadEventIcs(ev);
                            showToast(`Downloaded .ics for "${ev.title}"`);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-stone-950 hover:bg-black text-amber-300 text-xs font-bold flex items-center gap-1 transition-colors shadow-2xs border border-stone-800"
                        >
                          <Download className="w-3 h-3 text-amber-400" />
                          <span>.ics</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* SECTION A: NOTIFICATION PREFERENCES */}
      {/* ======================================================== */}
      {activeSubView === 'preferences' && (
        <form onSubmit={handleSavePreferences} className="bg-white rounded-3xl border border-stone-200 p-6 sm:p-8 shadow-xs space-y-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-800 mb-1">
              <Sliders className="w-3.5 h-3.5 text-amber-600" />
              <span>Smart Notification Settings</span>
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-stone-950">
              Personalized Alerts & Channels
            </h3>
            <p className="text-xs text-stone-600 mt-1 leading-relaxed">
              Tailor notifications to your exact interests so you stay informed on campus without ever being overwhelmed.
            </p>
          </div>

          {/* 1. Category Interests Selection - Requirement A */}
          <div className="space-y-3 pt-2 border-t border-stone-100">
            <div>
              <label className="text-xs font-bold text-stone-900 block">
                1. Select Event Categories You Are Interested In
              </label>
              <span className="text-[11px] text-stone-500">
                You will primarily receive discovery alerts and recommendations relevant to your chosen topics.
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {NOTIFICATION_CATEGORIES.map((cat) => {
                const isSelected = selectedCategories.includes(cat);
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleCategory(cat)}
                    className={`p-3 rounded-2xl border text-xs font-semibold flex items-center justify-between text-left transition-all ${
                      isSelected
                        ? 'bg-amber-400/15 border-amber-400 text-stone-950 font-bold shadow-2xs'
                        : 'bg-stone-50 border-stone-200 text-stone-700 hover:border-stone-300'
                    }`}
                  >
                    <span>{cat}</span>
                    {isSelected ? (
                      <Check className="w-4 h-4 text-amber-600 stroke-[3]" />
                    ) : (
                      <span className="w-4 h-4 rounded-full border border-stone-300" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Separate Notification Channel Toggles - Requirement A */}
          <div className="space-y-3 pt-2 border-t border-stone-100">
            <div>
              <label className="text-xs font-bold text-stone-900 block">
                2. Notification Types & Triggers
              </label>
              <span className="text-[11px] text-stone-500">
                Control individual notification channels independently to protect your focus.
              </span>
            </div>

            <div className="space-y-2">
              <label className="flex items-center justify-between p-3.5 rounded-2xl border border-stone-200 hover:bg-stone-50 cursor-pointer transition-colors text-xs">
                <div>
                  <span className="font-bold text-stone-950 block">Newly Discovered Events</span>
                  <span className="text-[11px] text-stone-500">Alerts when new events matching your selected categories are announced</span>
                </div>
                <input
                  type="checkbox"
                  checked={channelTypes.newEvents}
                  onChange={(e) => setChannelTypes({ ...channelTypes, newEvents: e.target.checked })}
                  className="w-4 h-4 accent-amber-500 rounded text-amber-500"
                />
              </label>

              <label className="flex items-center justify-between p-3.5 rounded-2xl border border-stone-200 hover:bg-stone-50 cursor-pointer transition-colors text-xs">
                <div>
                  <span className="font-bold text-stone-950 block">Upcoming RSVP & Saved Event Reminders</span>
                  <span className="text-[11px] text-stone-500">Timely reminders 24 hours and 2 hours before events on your schedule</span>
                </div>
                <input
                  type="checkbox"
                  checked={channelTypes.upcomingRsvp}
                  onChange={(e) => setChannelTypes({ ...channelTypes, upcomingRsvp: e.target.checked })}
                  className="w-4 h-4 accent-amber-500 rounded text-amber-500"
                />
              </label>

              <label className="flex items-center justify-between p-3.5 rounded-2xl border border-stone-200 hover:bg-stone-50 cursor-pointer transition-colors text-xs">
                <div>
                  <span className="font-bold text-stone-950 block">Buddy-Match Requests & Messages</span>
                  <span className="text-[11px] text-stone-500">When fellow Waterloo students send a request or reply to attend an event together</span>
                </div>
                <input
                  type="checkbox"
                  checked={channelTypes.buddyMatches}
                  onChange={(e) => setChannelTypes({ ...channelTypes, buddyMatches: e.target.checked })}
                  className="w-4 h-4 accent-amber-500 rounded text-amber-500"
                />
              </label>

              <label className="flex items-center justify-between p-3.5 rounded-2xl border border-stone-200 hover:bg-stone-50 cursor-pointer transition-colors text-xs">
                <div>
                  <span className="font-bold text-stone-950 block">Registration Deadlines</span>
                  <span className="text-[11px] text-stone-500">Crucial alerts when external organizer registration forms or hacker portals are closing</span>
                </div>
                <input
                  type="checkbox"
                  checked={channelTypes.registrationDeadlines}
                  onChange={(e) => setChannelTypes({ ...channelTypes, registrationDeadlines: e.target.checked })}
                  className="w-4 h-4 accent-amber-500 rounded text-amber-500"
                />
              </label>

              <label className="flex items-center justify-between p-3.5 rounded-2xl border border-stone-200 hover:bg-stone-50 cursor-pointer transition-colors text-xs">
                <div>
                  <span className="font-bold text-stone-950 block">Event Cancellations & Schedule Changes</span>
                  <span className="text-[11px] text-stone-500">Immediate notices if room assignments, campus venues, or times are updated</span>
                </div>
                <input
                  type="checkbox"
                  checked={channelTypes.eventChanges}
                  onChange={(e) => setChannelTypes({ ...channelTypes, eventChanges: e.target.checked })}
                  className="w-4 h-4 accent-amber-500 rounded text-amber-500"
                />
              </label>

              <label className="flex items-center justify-between p-3.5 rounded-2xl border border-stone-200 hover:bg-stone-50 cursor-pointer transition-colors text-xs">
                <div>
                  <span className="font-bold text-stone-950 block">Newly Available Student Discounts</span>
                  <span className="text-[11px] text-stone-500">WatCard specials, food deals, and ticket discounts across campus</span>
                </div>
                <input
                  type="checkbox"
                  checked={channelTypes.studentDiscounts}
                  onChange={(e) => setChannelTypes({ ...channelTypes, studentDiscounts: e.target.checked })}
                  className="w-4 h-4 accent-amber-500 rounded text-amber-500"
                />
              </label>
            </div>
          </div>

          {/* 3. Anti-Overwhelm Safeguards - Requirement A */}
          <div className="space-y-3 pt-2 border-t border-stone-100">
            <div>
              <label className="text-xs font-bold text-stone-900 block">
                3. Anti-Overwhelm Discipline & Quiet Hours
              </label>
              <span className="text-[11px] text-stone-500">
                Prevent notification fatigue while keeping you plugged into Waterloo campus life.
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <label className="flex items-start justify-between p-3.5 rounded-2xl border border-stone-200 hover:bg-stone-50 cursor-pointer transition-colors">
                <div className="pr-2">
                  <span className="font-bold text-stone-950 block">Quiet Hours (11 PM – 8 AM)</span>
                  <span className="text-[11px] text-stone-500">Mutes non-urgent alert sounds and badges overnight</span>
                </div>
                <input
                  type="checkbox"
                  checked={quietHours}
                  onChange={(e) => setQuietHours(e.target.checked)}
                  className="w-4 h-4 accent-amber-500 rounded text-amber-500 mt-0.5"
                />
              </label>

              <label className="flex items-start justify-between p-3.5 rounded-2xl border border-stone-200 hover:bg-stone-50 cursor-pointer transition-colors">
                <div className="pr-2">
                  <span className="font-bold text-stone-950 block">Cap Daily Volume</span>
                  <span className="text-[11px] text-stone-500">Limits non-essential notifications to maximum 2 high-relevance alerts per day</span>
                </div>
                <input
                  type="checkbox"
                  checked={avoidOverwhelming}
                  onChange={(e) => setAvoidOverwhelming(e.target.checked)}
                  className="w-4 h-4 accent-amber-500 rounded text-amber-500 mt-0.5"
                />
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-stone-100">
            <button
              type="submit"
              className="px-6 py-2.5 bg-stone-950 hover:bg-black text-amber-300 rounded-xl text-xs font-bold transition-all shadow-sm border border-stone-800"
            >
              Save Notification Preferences
            </button>
          </div>
        </form>
      )}

      {/* ======================================================== */}
      {/* SECTION C: NOTIFICATION INBOX */}
      {/* ======================================================== */}
      {activeSubView === 'notifications' && (
        <div className="bg-white rounded-3xl border border-stone-200 p-5 sm:p-7 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-amber-600" />
                <h3 className="text-base sm:text-lg font-bold text-stone-950">
                  Campus Notification Center
                </h3>
              </div>
              <p className="text-xs text-stone-600">
                Filtered strictly by your selected categories ({notificationSettings.interestedCategories.length} active topics).
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  simulateTestNotification();
                  showToast('Simulated incoming personalized alert!');
                }}
                className="px-3 py-1.5 rounded-xl border border-stone-200 hover:bg-stone-50 text-stone-700 text-xs font-bold flex items-center gap-1 transition-colors"
                title="Simulate incoming alert based on your preferences"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>Simulate Alert</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  markAllNotificationsAsRead();
                  showToast('All notifications marked as read.');
                }}
                className="px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold transition-colors"
              >
                Mark All Read
              </button>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex items-center p-1 bg-stone-100 rounded-2xl w-fit flex-wrap gap-1 text-xs">
            <button
              type="button"
              onClick={() => setNotifFilter('all')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-colors ${
                notifFilter === 'all' ? 'bg-white text-stone-950 shadow-2xs' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setNotifFilter('unread')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-colors ${
                notifFilter === 'unread' ? 'bg-white text-stone-950 shadow-2xs' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Unread ({unreadNotificationsCount})
            </button>
            <button
              type="button"
              onClick={() => setNotifFilter('buddy')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-colors ${
                notifFilter === 'buddy' ? 'bg-white text-stone-950 shadow-2xs' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Buddy Matches
            </button>
            <button
              type="button"
              onClick={() => setNotifFilter('reminders')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-colors ${
                notifFilter === 'reminders' ? 'bg-white text-stone-950 shadow-2xs' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              RSVP & Deadlines
            </button>
            <button
              type="button"
              onClick={() => setNotifFilter('deals')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-colors ${
                notifFilter === 'deals' ? 'bg-white text-stone-950 shadow-2xs' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Student Deals
            </button>
          </div>

          {/* Notifications List */}
          {filteredNotifications.length === 0 ? (
            <div className="p-10 text-center space-y-2 border border-dashed border-stone-200 rounded-2xl">
              <Bell className="w-8 h-8 text-stone-300 mx-auto" />
              <p className="text-xs font-bold text-stone-800">No notifications to display in this view</p>
              <p className="text-[11px] text-stone-500">
                You&apos;re all caught up! New alerts will appear here according to your notification preferences.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredNotifications.map((n) => (
                <div
                  key={n.id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    !n.read
                      ? 'bg-amber-50/60 border-amber-300 shadow-2xs'
                      : 'bg-white border-stone-200 hover:border-stone-300'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                      n.type === 'buddy_match'
                        ? 'bg-amber-400 text-stone-950'
                        : n.type === 'registration_deadline'
                        ? 'bg-stone-900 text-amber-300'
                        : n.type === 'student_discount'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-stone-100 text-stone-700'
                    }`}>
                      {n.type === 'buddy_match' ? (
                        <HeartHandshake className="w-4 h-4" />
                      ) : n.type === 'student_discount' ? (
                        <Tag className="w-4 h-4" />
                      ) : (
                        <Bell className="w-4 h-4" />
                      )}
                    </div>

                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-xs sm:text-sm text-stone-950 truncate">
                          {n.title}
                        </h4>
                        {!n.read && (
                          <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                        )}
                        {n.category && (
                          <span className="text-[10px] bg-stone-100 text-stone-600 px-1.5 py-0.2 rounded font-medium">
                            {n.category}
                          </span>
                        )}
                        <span className="text-[10px] text-stone-400">{n.timestamp}</span>
                      </div>
                      <p className="text-xs text-stone-700 leading-normal">
                        {n.message}
                      </p>
                      {n.discountDeal && (
                        <span className="inline-block mt-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                          Deal: {n.discountDeal}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Notification Action Buttons */}
                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    {n.type === 'buddy_match' && (
                      <button
                        type="button"
                        onClick={() => {
                          markNotificationAsRead(n.id);
                          onNavigateToMessages?.();
                        }}
                        className="px-3 py-1.5 bg-amber-400 hover:bg-amber-500 text-stone-950 font-bold text-xs rounded-xl shadow-2xs transition-colors"
                      >
                        View Request
                      </button>
                    )}

                    {n.eventId && n.type !== 'buddy_match' && (
                      <button
                        type="button"
                        onClick={() => {
                          markNotificationAsRead(n.id);
                          const ev = events.find((e) => e.id === n.eventId);
                          if (ev) setSelectedEventForDetail(ev);
                        }}
                        className="px-3 py-1.5 bg-stone-950 hover:bg-black text-amber-300 font-bold text-xs rounded-xl shadow-2xs transition-colors"
                      >
                        {n.actionLabel || 'View Event'}
                      </button>
                    )}

                    {n.actionUrl && (
                      <a
                        href={n.actionUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-xs rounded-xl flex items-center gap-1 transition-colors"
                      >
                        <span>Open Link</span>
                        <ExternalLink className="w-3 h-3 text-stone-500" />
                      </a>
                    )}

                    {!n.read ? (
                      <button
                        type="button"
                        onClick={() => markNotificationAsRead(n.id)}
                        className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg"
                        title="Mark as read"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => deleteNotification(n.id)}
                        className="p-1.5 text-stone-400 hover:text-red-700 rounded-lg"
                        title="Delete notification"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* SYNCHRONIZATION GUIDE MODAL */}
      {/* ======================================================== */}
      {syncModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-stone-100 relative my-auto animate-in fade-in zoom-in-95 duration-150 space-y-5">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 uppercase tracking-wider mb-1">
                <CalendarPlus className="w-3.5 h-3.5 text-amber-600" />
                <span>External Calendar Synchronization</span>
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-stone-950">
                Sync with Google & External Calendars
              </h3>
              <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                Seamlessly export your Waterloo campus schedule to Google Calendar, Apple Calendar, or Outlook without needing any login credentials.
              </p>
            </div>

            {/* Sync options list */}
            <div className="space-y-3 text-xs">
              {/* Option 1: Google Calendar Web Sync */}
              <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200/80 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-stone-950">Option 1: Google Calendar (Web / Mobile)</span>
                  <span className="text-[10px] bg-stone-900 text-amber-300 font-bold px-1.5 py-0.5 rounded">
                    Direct Web Link
                  </span>
                </div>
                <p className="text-[11px] text-stone-600">
                  Each event in your calendar features a 1-click &ldquo;+ Google Calendar&rdquo; button that directly populates the event name, Waterloo venue, dates, and registration links into your Google Calendar.
                </p>
              </div>

              {/* Option 2: All Events .ics File */}
              <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-stone-950">Option 2: Universal Calendar File (.ics)</span>
                  <span className="text-[10px] bg-amber-400 text-stone-950 font-black px-1.5 py-0.5 rounded">
                    Recommended
                  </span>
                </div>
                <p className="text-[11px] text-stone-600">
                  Download a combined `.ics` file containing all ({attendingEvents.length}) events you are attending. Supported by Apple Calendar on iPhone/Mac, Outlook, and Google Calendar.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    downloadAllEventsIcs(attendingEvents);
                    setSyncModalOpen(false);
                    showToast('Downloaded combined WatHive schedule (.ics)!');
                  }}
                  disabled={attendingEvents.length === 0}
                  className="w-full py-2 bg-stone-950 hover:bg-black text-amber-300 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors border border-stone-800 disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5 text-amber-400" />
                  <span>Download Combined .ics Schedule</span>
                </button>
              </div>

              {/* Ticket disclaimer reminder */}
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-stone-700 space-y-1">
                <div className="flex items-center gap-1.5 text-amber-950 font-bold">
                  <Shield className="w-3.5 h-3.5 text-amber-600" />
                  <span>Ticket Distinction Reminder</span>
                </div>
                <p>
                  Calendar sync copies event timings and venues to your personal calendar. It does not replace organizer tickets or guarantee building admission where official tickets are required.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setSyncModalOpen(false)}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Selected Event Detail Modal */}
      {selectedEventForDetail && (
        <EventDetailModal
          isOpen={Boolean(selectedEventForDetail)}
          event={selectedEventForDetail}
          onClose={() => setSelectedEventForDetail(null)}
          onNavigateToMessages={onNavigateToMessages}
        />
      )}
    </div>
  );
};
