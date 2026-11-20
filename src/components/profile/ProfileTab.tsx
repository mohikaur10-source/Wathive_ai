import React, { useState } from 'react';
import {
  User,
  Bookmark,
  Calendar,
  Edit3,
  RotateCcw,
  LogOut,
  Shield,
  Sparkles,
  Check,
  X,
  CheckCircle2,
  ChevronDown,
  Pin,
  SlidersHorizontal
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { EventFilterTag, EventItem } from '../../types';
import { EVENT_CATEGORIES, UW_FACULTIES, STUDY_YEARS } from '../../data/mockData';
import {
  SAVABLE_LOCATION_BUCKETS,
  PRICE_FILTER_OPTIONS,
  getFilterTagKey
} from '../../utils/eventFilters';
import { computeBuddyArchetype } from '../../utils/compatibilityEngine';
import { UWVerificationModal } from '../common/UWVerificationModal';
import { PersonalityQuizModal } from '../common/PersonalityQuizModal';
import { MyEventsList } from '../common/MyEventsList';
import { EventDetailModal } from '../feed/EventDetailModal';
import { safeMediaUrl } from '../../utils/urlSafety';

const BUDDY_PRIVACY_KEY = 'wathive_buddy_show_academic';

interface ProfileTabProps {
  onNavigateToMessages?: (subTab?: 'conversations' | 'requests') => void;
}

export const ProfileTab: React.FC<ProfileTabProps> = ({ onNavigateToMessages }) => {
  const {
    user,
    logout,
    updateProfile,
    events,
    savedEventIds,
    attendingEventIds,
    savedFilters,
    toggleSavedFilter,
    removeSavedFilter,
    clearSavedFilters,
    blockedUserIds,
    unblockUser,
    allAttendees,
    resetDemoData
  } = useApp();

  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [filterPickerOpen, setFilterPickerOpen] = useState(false);
  const [savedFiltersFeedback, setSavedFiltersFeedback] = useState(false);
  const [expandedEventsPanel, setExpandedEventsPanel] = useState<'going' | 'saved' | null>(null);
  const [selectedEventForDetail, setSelectedEventForDetail] = useState<EventItem | null>(null);
  const [quizModalOpen, setQuizModalOpen] = useState(false);
  const [verificationModalOpen, setVerificationModalOpen] = useState(false);
  const [blockedListOpen, setBlockedListOpen] = useState(false);
  const [actionNotice, setActionNotice] = useState('');

  // Simple buddy privacy preference persisted cleanly in localStorage
  const [shareAcademicWithBuddies, setShareAcademicWithBuddies] = useState<boolean>(() => {
    try {
      return localStorage.getItem(BUDDY_PRIVACY_KEY) !== '0';
    } catch {
      return true;
    }
  });

  // Edit profile state
  const [editName, setEditName] = useState(user?.name || '');
  const [editFaculty, setEditFaculty] = useState(user?.faculty || 'Engineering');
  const [editProgram, setEditProgram] = useState(user?.program || '');
  const [editYear, setEditYear] = useState(user?.year || '3rd Year');

  const showNotice = (msg: string) => {
    setActionNotice(msg);
    window.setTimeout(() => setActionNotice(''), 3000);
  };

  const flashAutoSaved = () => {
    setSavedFiltersFeedback(true);
    window.setTimeout(() => setSavedFiltersFeedback(false), 1800);
  };

  if (!user) {
    return (
      <div className="max-w-xl mx-auto p-12 bg-surface rounded-3xl border border-line shadow-soft text-center space-y-3">
        <User className="w-10 h-10 text-muted mx-auto" />
        <h2 className="font-display text-xl font-bold text-ink">You&apos;re signed out</h2>
        <p className="text-sm text-muted">
          Use the menu in the top-right corner to sign back in and manage your hive profile.
        </p>
      </div>
    );
  }

  const goingEvents = events.filter((e) => attendingEventIds.includes(e.id));
  const savedEvents = events.filter((e) => savedEventIds.includes(e.id));
  const activeGoingCount = goingEvents.length;
  const activeSavedCount = savedEvents.length;

  const hasCompletedQuiz = Boolean(user.personalityQuiz?.completed && user.personalityQuiz?.answers);
  const userArchetype = hasCompletedQuiz
    ? user.personalityQuiz?.archetype || computeBuddyArchetype(user.personalityQuiz?.answers)
    : null;
  const userPrefBubbles = user.personalityQuiz?.preferenceBubbles || [];

  const savedFilterKeys = new Set(
    savedFilters.map((f) => getFilterTagKey(f.type, f.value))
  );

  const handleToggleSavedFilter = (tag: EventFilterTag) => {
    toggleSavedFilter(tag);
    flashAutoSaved();
  };

  const handleRemoveSavedFilter = (tag: EventFilterTag) => {
    removeSavedFilter(tag);
    flashAutoSaved();
  };

  const handleClearSavedFilters = () => {
    clearSavedFilters();
    flashAutoSaved();
    showNotice('Cleared all saved filters.');
  };

  const handleTogglePrivacyPref = () => {
    const next = !shareAcademicWithBuddies;
    setShareAcademicWithBuddies(next);
    try {
      localStorage.setItem(BUDDY_PRIVACY_KEY, next ? '1' : '0');
    } catch {
      // ignore storage errors
    }
    showNotice(
      next
        ? 'Faculty & year will be visible to buddies when you opt in.'
        : 'Faculty & year hidden on buddy previews by default.'
    );
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile({
      name: editName.trim() || user.name,
      faculty: editFaculty,
      program: editProgram.trim(),
      year: editYear
    });
    setEditProfileOpen(false);
    showNotice('Profile updated.');
  };

  return (
    <div className="max-w-3xl mx-auto w-full space-y-6">
      {actionNotice && (
        <div className="p-3 bg-surface border border-accent rounded-2xl shadow-soft text-xs font-semibold text-ink flex items-center gap-2">
          <Check className="w-4 h-4 text-accent-text stroke-[2.8]" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Profile Header Card */}
      <section className="bg-surface rounded-3xl border border-line shadow-soft p-6 sm:p-7 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <img
              src={user.avatar}
              alt={user.name}
              referrerPolicy="no-referrer"
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover ring-2 ring-accent/70 shrink-0"
            />
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-display text-2xl font-bold text-ink tracking-tight">
                  {user.name}
                </h1>
                {user.isVerifiedUWStudent ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-success-soft text-success text-[11px] font-semibold">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>UW Verified</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setVerificationModalOpen(true)}
                    className="px-2.5 py-0.5 rounded-full bg-accent text-accent-ink text-[11px] font-bold cursor-pointer hover:bg-accent-hover transition-colors"
                  >
                    Verify @uwaterloo.ca
                  </button>
                )}
              </div>

              <p className="text-sm text-muted">
                {user.faculty}
                {user.program ? ` · ${user.program}` : ''} · {user.year}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setEditName(user.name);
              setEditFaculty(user.faculty);
              setEditProgram(user.program);
              setEditYear(user.year);
              setEditProfileOpen(true);
            }}
            className="self-start sm:self-center px-3.5 py-2 rounded-2xl border border-line bg-canvas hover:bg-surface-soft text-ink text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5 text-accent-text" />
            <span>Edit</span>
          </button>
        </div>

        {/* Saved & Going Counts — Interactive buttons showing exact event lists */}
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-line">
          <button
            type="button"
            aria-expanded={expandedEventsPanel === 'going'}
            onClick={() =>
              setExpandedEventsPanel((prev) => (prev === 'going' ? null : 'going'))
            }
            className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-left transition-colors cursor-pointer ${
              expandedEventsPanel === 'going'
                ? 'bg-accent-soft border-accent shadow-soft'
                : 'bg-canvas border-line hover:border-accent/60 hover:bg-surface-soft/50'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-accent-soft text-accent-text flex items-center justify-center shrink-0">
                <Calendar className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="font-display text-lg font-bold text-ink leading-none tabular-nums">
                  {activeGoingCount}
                </p>
                <p className="text-xs text-muted mt-1">Going</p>
              </div>
            </div>
            <ChevronDown
              className={`w-4 h-4 text-muted shrink-0 transition-transform duration-150 ${
                expandedEventsPanel === 'going' ? 'rotate-180 text-ink' : ''
              }`}
            />
          </button>

          <button
            type="button"
            aria-expanded={expandedEventsPanel === 'saved'}
            onClick={() =>
              setExpandedEventsPanel((prev) => (prev === 'saved' ? null : 'saved'))
            }
            className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-left transition-colors cursor-pointer ${
              expandedEventsPanel === 'saved'
                ? 'bg-accent-soft border-accent shadow-soft'
                : 'bg-canvas border-line hover:border-accent/60 hover:bg-surface-soft/50'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-accent-soft text-accent-text flex items-center justify-center shrink-0">
                <Bookmark className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="font-display text-lg font-bold text-ink leading-none tabular-nums">
                  {activeSavedCount}
                </p>
                <p className="text-xs text-muted mt-1">Saved</p>
              </div>
            </div>
            <ChevronDown
              className={`w-4 h-4 text-muted shrink-0 transition-transform duration-150 ${
                expandedEventsPanel === 'saved' ? 'rotate-180 text-ink' : ''
              }`}
            />
          </button>
        </div>

        {/* Expanded Going / Saved Events List (same format as My Events page) */}
        {expandedEventsPanel && (
          <div className="pt-4 border-t border-line space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-base font-bold text-ink">
                {expandedEventsPanel === 'going' ? 'Going Events' : 'Saved Events'}
              </h2>
              <button
                type="button"
                onClick={() => setExpandedEventsPanel(null)}
                className="text-xs font-semibold text-muted hover:text-ink cursor-pointer"
              >
                Hide
              </button>
            </div>

            {expandedEventsPanel === 'going' ? (
              goingEvents.length > 0 ? (
                <MyEventsList
                  events={goingEvents}
                  onSelectEvent={(ev) => setSelectedEventForDetail(ev)}
                  onNavigateToMessages={() => onNavigateToMessages?.('conversations')}
                  onExportToast={showNotice}
                  badgeMode="going"
                />
              ) : (
                <p className="text-xs text-muted py-2">
                  You haven&apos;t marked any upcoming events as Going yet.
                </p>
              )
            ) : savedEvents.length > 0 ? (
              <MyEventsList
                events={savedEvents}
                onSelectEvent={(ev) => setSelectedEventForDetail(ev)}
                onNavigateToMessages={() => onNavigateToMessages?.('conversations')}
                onExportToast={showNotice}
                badgeMode="saved"
              />
            ) : (
              <p className="text-xs text-muted py-2">
                You haven&apos;t saved any upcoming events yet.
              </p>
            )}
          </div>
        )}
      </section>

      {/* Saved Filters (Replaces Interests) */}
      <section className="bg-surface rounded-3xl border border-line shadow-soft p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Pin className="w-4 h-4 text-accent-text" />
            <h2 className="font-display text-lg font-bold text-ink">Saved Filters</h2>
            {savedFiltersFeedback && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-success-soft text-success text-[11px] font-semibold">
                <Check className="w-3 h-3 stroke-[2.8]" />
                <span>Auto-saved</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {savedFilters.length > 0 && (
              <button
                type="button"
                onClick={handleClearSavedFilters}
                className="text-xs font-semibold text-muted hover:text-danger cursor-pointer"
              >
                Clear all
              </button>
            )}
            <button
              type="button"
              onClick={() => setFilterPickerOpen((prev) => !prev)}
              className="text-xs font-semibold text-accent-text hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>{filterPickerOpen ? 'Done' : 'Add / Edit'}</span>
            </button>
          </div>
        </div>

        <p className="text-xs text-muted leading-relaxed">
          Filters saved here are automatically applied whenever you visit Explore and stay pinned until you remove them here.
        </p>

        {/* Active Saved Filter Pills */}
        {savedFilters.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {savedFilters.map((filter) => (
              <span
                key={getFilterTagKey(filter.type, filter.value)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent-soft text-ink text-xs font-semibold border border-accent/40"
              >
                <Pin className="w-3 h-3 text-accent-text shrink-0" />
                <span>{filter.label}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveSavedFilter(filter)}
                  aria-label={`Remove saved filter ${filter.label}`}
                  className="p-0.5 rounded-full text-accent-text hover:bg-accent/30 transition-colors cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted">
            No saved filters yet — click &ldquo;Add / Edit&rdquo; to pin default event categories, faculties, locations, or price filters.
          </p>
        )}

        {/* Inline Toggle Picker for All Existing Event Filter Categories/Tags */}
        {filterPickerOpen && (
          <div className="pt-4 border-t border-line space-y-4">
            {/* Categories */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-ink block">Categories</span>
              <div className="flex flex-wrap gap-1.5">
                {EVENT_CATEGORIES.map((cat) => {
                  const tag: EventFilterTag = { type: 'category', value: cat, label: cat };
                  const isActive = savedFilterKeys.has(getFilterTagKey(tag.type, tag.value));
                  return (
                    <button
                      key={cat}
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => handleToggleSavedFilter(tag)}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-accent border-accent text-accent-ink shadow-soft'
                          : 'bg-canvas border-line text-muted hover:text-ink hover:border-accent/50'
                      }`}
                    >
                      {isActive && <Check className="w-3 h-3 stroke-[2.8]" />}
                      <span>{cat}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Faculty */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-ink block">Faculty</span>
              <div className="flex flex-wrap gap-1.5">
                {UW_FACULTIES.map((fac) => {
                  const tag: EventFilterTag = { type: 'faculty', value: fac, label: fac };
                  const isActive = savedFilterKeys.has(getFilterTagKey(tag.type, tag.value));
                  return (
                    <button
                      key={fac}
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => handleToggleSavedFilter(tag)}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-accent border-accent text-accent-ink shadow-soft'
                          : 'bg-canvas border-line text-muted hover:text-ink hover:border-accent/50'
                      }`}
                    >
                      {isActive && <Check className="w-3 h-3 stroke-[2.8]" />}
                      <span>{fac}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Location */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-ink block">Location</span>
              <div className="flex flex-wrap gap-1.5">
                {SAVABLE_LOCATION_BUCKETS.map((loc) => {
                  const tag: EventFilterTag = { type: 'location', value: loc.id, label: loc.label };
                  const isActive = savedFilterKeys.has(getFilterTagKey(tag.type, tag.value));
                  return (
                    <button
                      key={loc.id}
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => handleToggleSavedFilter(tag)}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-accent border-accent text-accent-ink shadow-soft'
                          : 'bg-canvas border-line text-muted hover:text-ink hover:border-accent/50'
                      }`}
                    >
                      {isActive && <Check className="w-3 h-3 stroke-[2.8]" />}
                      <span>{loc.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Price */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-ink block">Price</span>
              <div className="flex flex-wrap gap-1.5">
                {PRICE_FILTER_OPTIONS.map((p) => {
                  const tag: EventFilterTag = { type: 'price', value: p.value, label: p.label };
                  const isActive = savedFilterKeys.has(getFilterTagKey(tag.type, tag.value));
                  return (
                    <button
                      key={p.value}
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => handleToggleSavedFilter(tag)}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-accent border-accent text-accent-ink shadow-soft'
                          : 'bg-canvas border-line text-muted hover:text-ink hover:border-accent/50'
                      }`}
                    >
                      {isActive && <Check className="w-3 h-3 stroke-[2.8]" />}
                      <span>{p.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Buddy Vibe — Archetype Badge + Retake Personality Quiz (or 30-second Onboarding Card) */}
      <section className="bg-surface rounded-3xl border border-line shadow-soft p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-accent-text" />
            <h2 className="font-display text-lg font-bold text-ink">Buddy Vibe</h2>
          </div>

          {hasCompletedQuiz && (
            <button
              type="button"
              onClick={() => setQuizModalOpen(true)}
              className="px-3.5 py-2 rounded-2xl bg-accent hover:bg-accent-hover text-accent-ink text-xs font-bold inline-flex items-center gap-1.5 shadow-soft transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retake Personality Quiz</span>
            </button>
          )}
        </div>

        {hasCompletedQuiz && userArchetype ? (
          <div className="space-y-3">
            <div className="p-4 rounded-2xl bg-canvas border border-line flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-accent-soft border border-accent/35 flex items-center justify-center text-xl shrink-0">
                <span aria-hidden="true">{userArchetype.emoji}</span>
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-accent text-accent-ink text-xs font-bold">
                    {userArchetype.title}
                  </span>
                </div>
                <p className="text-xs text-muted leading-relaxed">
                  {userArchetype.summary}
                </p>
              </div>
            </div>

            {userPrefBubbles.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-muted block">
                  Buddy preferences
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {userPrefBubbles.map((pref) => (
                    <span
                      key={pref}
                      className="px-2.5 py-1 rounded-full bg-accent-soft border border-accent/30 text-ink text-xs font-medium"
                    >
                      {pref}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-canvas border border-accent/40 space-y-3">
            <div className="space-y-1">
              <p className="font-display text-sm font-bold text-ink">
                Find your Buddy Archetype in 30 seconds
              </p>
              <p className="text-xs text-muted leading-relaxed">
                Answer 8 quick tap-to-pick questions and set your buddy preferences to unlock personalized matches and Icebreaker Hooks.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setQuizModalOpen(true)}
              className="px-4 py-2 rounded-2xl bg-accent hover:bg-accent-hover text-accent-ink text-xs font-bold inline-flex items-center gap-1.5 shadow-soft transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Take 30-Second Quiz</span>
            </button>
          </div>
        )}
      </section>

      {/* Simple Buddy Privacy Preference */}
      <section className="bg-surface rounded-3xl border border-line shadow-soft p-6 flex items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <Shield className="w-4 h-4 text-accent-text mt-0.5 shrink-0" />
          <div>
            <h2 className="font-display text-base font-bold text-ink">
              Buddy privacy
            </h2>
            <p className="text-xs text-muted mt-0.5">
              Share my faculty &amp; year on buddy cards when I opt into matching.
            </p>
          </div>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={shareAcademicWithBuddies}
          onClick={handleTogglePrivacyPref}
          className={`w-11 h-6 rounded-full transition-colors p-0.5 shrink-0 cursor-pointer ${
            shareAcademicWithBuddies ? 'bg-accent' : 'bg-surface-soft border border-line'
          }`}
        >
          <span
            className={`block w-5 h-5 rounded-full bg-surface shadow-soft transition-transform ${
              shareAcademicWithBuddies ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </section>

      {/* Blocked users */}
      <section className="bg-surface rounded-3xl border border-line shadow-soft overflow-hidden">
        <button
          type="button"
          aria-expanded={blockedListOpen}
          onClick={() => setBlockedListOpen((prev) => !prev)}
          className="w-full px-6 py-4 flex items-center justify-between gap-3 text-left hover:bg-surface-soft/40 transition-colors cursor-pointer"
        >
          <span className="font-display text-base font-bold text-ink">Blocked users</span>
          <div className="flex items-center gap-2 text-xs text-muted">
            <span className="tabular-nums font-semibold">{blockedUserIds.length}</span>
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-150 ${
                blockedListOpen ? 'rotate-180' : ''
              }`}
            />
          </div>
        </button>

        {blockedListOpen && (
          <div className="px-6 pb-4 pt-2 border-t border-line space-y-2">
            {blockedUserIds.length === 0 ? (
              <p className="text-xs text-muted py-1">None.</p>
            ) : (
              blockedUserIds.map((id) => {
                const profile = allAttendees[id];
                const displayName = profile?.name || 'Student';
                const avatar = safeMediaUrl(profile?.avatar) || '';
                return (
                  <div
                    key={id}
                    className="flex items-center justify-between gap-3 py-1.5"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {avatar ? (
                        <img
                          src={avatar}
                          alt={displayName}
                          referrerPolicy="no-referrer"
                          className="w-8 h-8 rounded-full object-cover shrink-0 bg-surface-soft"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-surface-soft text-ink text-xs font-semibold flex items-center justify-center shrink-0">
                          {displayName.charAt(0)}
                        </div>
                      )}
                      <span className="text-xs font-semibold text-ink truncate">
                        {displayName}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        unblockUser(id);
                        showNotice('Unblocked.');
                      }}
                      className="px-3 py-1.5 rounded-xl border border-line bg-canvas hover:bg-surface-soft text-xs font-semibold text-ink transition-colors cursor-pointer shrink-0"
                    >
                      Unblock
                    </button>
                  </div>
                );
              })
            )}
          </div>
        )}
      </section>

      {/* Account Actions */}
      <div className="flex items-center justify-between px-1 pt-1 text-xs">
        <button
          type="button"
          onClick={() => {
            resetDemoData();
            showNotice('Demo state restored.');
          }}
          className="text-muted hover:text-ink font-medium flex items-center gap-1.5 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset demo data</span>
        </button>

        <button
          type="button"
          onClick={logout}
          className="text-danger hover:underline font-semibold flex items-center gap-1.5 cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign out</span>
        </button>
      </div>

      {/* Edit Profile Modal */}
      {editProfileOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-xs">
          <div className="bg-surface rounded-3xl max-w-md w-full p-6 shadow-lift border border-line relative">
            <button
              type="button"
              onClick={() => setEditProfileOpen(false)}
              className="absolute top-4 right-4 p-2 text-muted hover:text-ink rounded-full cursor-pointer"
              aria-label="Close edit profile"
            >
              <X className="w-4 h-4" />
            </button>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <h3 className="font-display text-lg font-bold text-ink">Edit Profile</h3>

              <div>
                <label className="block text-xs font-semibold text-muted mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-2xl border border-line bg-canvas text-ink focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted mb-1">Faculty</label>
                  <select
                    value={editFaculty}
                    onChange={(e) => setEditFaculty(e.target.value)}
                    className="w-full px-3 py-2.5 text-xs rounded-2xl border border-line bg-canvas text-ink focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    {UW_FACULTIES.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted mb-1">Year</label>
                  <select
                    value={editYear}
                    onChange={(e) => setEditYear(e.target.value)}
                    className="w-full px-3 py-2.5 text-xs rounded-2xl border border-line bg-canvas text-ink focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    {STUDY_YEARS.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted mb-1">Program</label>
                <input
                  type="text"
                  value={editProgram}
                  onChange={(e) => setEditProgram(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-2xl border border-line bg-canvas text-ink focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditProfileOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-muted hover:text-ink cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-accent hover:bg-accent-hover text-accent-ink rounded-2xl text-xs font-bold shadow-soft cursor-pointer"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <UWVerificationModal
        isOpen={verificationModalOpen}
        onClose={() => setVerificationModalOpen(false)}
        onSuccess={() => showNotice('Verified as University of Waterloo student!')}
      />

      <PersonalityQuizModal
        isOpen={quizModalOpen}
        onClose={() => setQuizModalOpen(false)}
        onSuccess={() => showNotice('Buddy vibe updated!')}
        onNavigateToBuddyHub={() => onNavigateToMessages?.('requests')}
      />

      {selectedEventForDetail && (
        <EventDetailModal
          isOpen={Boolean(selectedEventForDetail)}
          event={selectedEventForDetail}
          onClose={() => setSelectedEventForDetail(null)}
          onNavigateToMessages={() => onNavigateToMessages?.('conversations')}
        />
      )}
    </div>
  );
};
