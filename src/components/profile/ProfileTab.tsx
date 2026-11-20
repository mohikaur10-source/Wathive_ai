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
  ChevronDown
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { EventCategory, UserPreferences } from '../../types';
import { EVENT_CATEGORIES, UW_FACULTIES, STUDY_YEARS } from '../../data/mockData';
import { UWVerificationModal } from '../common/UWVerificationModal';
import { PersonalityQuizModal } from '../common/PersonalityQuizModal';
import { safeMediaUrl } from '../../utils/urlSafety';

const BUDDY_PRIVACY_KEY = 'wathive_buddy_show_academic';

export const ProfileTab: React.FC = () => {
  const {
    user,
    logout,
    updateProfile,
    updatePreferences,
    events,
    savedEventIds,
    attendingEventIds,
    blockedUserIds,
    unblockUser,
    allAttendees,
    resetDemoData
  } = useApp();

  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [editInterestsOpen, setEditInterestsOpen] = useState(false);
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

  // Edit interests state
  const [prefCategories, setPrefCategories] = useState<EventCategory[]>(
    user?.preferences.categories || []
  );

  const showNotice = (msg: string) => {
    setActionNotice(msg);
    window.setTimeout(() => setActionNotice(''), 3000);
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

  const activeGoingCount = events.filter((e) => attendingEventIds.includes(e.id)).length;
  const activeSavedCount = events.filter((e) => savedEventIds.includes(e.id)).length;

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

  const handleSaveInterests = (e: React.FormEvent) => {
    e.preventDefault();
    const newPrefs: UserPreferences = {
      ...user.preferences,
      categories: prefCategories,
      noPreferences: prefCategories.length === 0
    };
    updatePreferences(newPrefs);
    setEditInterestsOpen(false);
    showNotice('Interests updated.');
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

        {/* Saved & Going Counts */}
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-line">
          <div className="p-3.5 rounded-2xl bg-canvas border border-line flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent-soft text-accent-text flex items-center justify-center shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <p className="font-display text-lg font-bold text-ink leading-none tabular-nums">
                {activeGoingCount}
              </p>
              <p className="text-xs text-muted mt-1">Going</p>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-canvas border border-line flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent-soft text-accent-text flex items-center justify-center shrink-0">
              <Bookmark className="w-4 h-4" />
            </div>
            <div>
              <p className="font-display text-lg font-bold text-ink leading-none tabular-nums">
                {activeSavedCount}
              </p>
              <p className="text-xs text-muted mt-1">Saved</p>
            </div>
          </div>
        </div>
      </section>

      {/* Interests */}
      <section className="bg-surface rounded-3xl border border-line shadow-soft p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold text-ink">Interests</h2>
          <button
            type="button"
            onClick={() => {
              setPrefCategories(user.preferences.categories);
              setEditInterestsOpen(true);
            }}
            className="text-xs font-semibold text-accent-text hover:underline cursor-pointer"
          >
            Edit
          </button>
        </div>

        {user.preferences.categories.length > 0 || (user.personalityQuiz?.hobbies.length ?? 0) > 0 ? (
          <div className="flex flex-wrap gap-2">
            {user.preferences.categories.map((cat) => (
              <span
                key={cat}
                className="px-3 py-1.5 rounded-xl bg-accent-soft text-ink text-xs font-semibold border border-accent/30"
              >
                {cat}
              </span>
            ))}
            {user.personalityQuiz?.hobbies.map((hobby) => (
              <span
                key={hobby}
                className="px-3 py-1.5 rounded-xl bg-canvas text-muted text-xs font-medium border border-line"
              >
                {hobby}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted">
            No interests added yet — used only for buddy matching.
          </p>
        )}
      </section>

      {/* Personality Quiz Result */}
      <section className="bg-surface rounded-3xl border border-line shadow-soft p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-accent-text" />
            <h2 className="font-display text-lg font-bold text-ink">Buddy Vibe</h2>
          </div>
          <button
            type="button"
            onClick={() => setQuizModalOpen(true)}
            className="text-xs font-semibold text-accent-text hover:underline cursor-pointer"
          >
            {user.personalityQuiz ? 'Retake' : 'Take quiz'}
          </button>
        </div>

        {user.personalityQuiz ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3.5 rounded-2xl bg-canvas border border-line">
              <span className="text-[11px] text-muted block">Social energy</span>
              <span className="font-semibold text-ink capitalize mt-0.5 block">
                {user.personalityQuiz.socialEnergy}
              </span>
            </div>
            <div className="p-3.5 rounded-2xl bg-canvas border border-line">
              <span className="text-[11px] text-muted block">Atmosphere</span>
              <span className="font-semibold text-ink capitalize mt-0.5 block">
                {user.personalityQuiz.socialEnvironment.replace('_', ' ')}
              </span>
            </div>
            <div className="p-3.5 rounded-2xl bg-canvas border border-line">
              <span className="text-[11px] text-muted block">Group size</span>
              <span className="font-semibold text-ink capitalize mt-0.5 block">
                {user.personalityQuiz.groupSize.replace('_', ' ')}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted">
            Complete the 1-minute quiz to see compatibility scores with potential event buddies.
          </p>
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

      {/* Edit Interests Modal */}
      {editInterestsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-xs">
          <div className="bg-surface rounded-3xl max-w-md w-full p-6 shadow-lift border border-line relative">
            <button
              type="button"
              onClick={() => setEditInterestsOpen(false)}
              className="absolute top-4 right-4 p-2 text-muted hover:text-ink rounded-full cursor-pointer"
              aria-label="Close edit interests"
            >
              <X className="w-4 h-4" />
            </button>

            <form onSubmit={handleSaveInterests} className="space-y-4">
              <h3 className="font-display text-lg font-bold text-ink">Select Interests</h3>
              <div className="grid grid-cols-2 gap-2">
                {EVENT_CATEGORIES.map((cat) => {
                  const isSelected = prefCategories.includes(cat as EventCategory);
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() =>
                        setPrefCategories((prev) =>
                          prev.includes(cat as EventCategory)
                            ? prev.filter((c) => c !== cat)
                            : [...prev, cat as EventCategory]
                        )
                      }
                      className={`text-left p-2.5 rounded-2xl border text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-accent-soft border-accent text-ink'
                          : 'bg-canvas border-line text-muted hover:text-ink'
                      }`}
                    >
                      <span className="truncate pr-1">{cat}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-accent-text shrink-0" />}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditInterestsOpen(false)}
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
      />
    </div>
  );
};
