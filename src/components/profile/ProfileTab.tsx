import React, { useState } from 'react';
import {
  User,
  Settings,
  Bookmark,
  Calendar,
  PlusCircle,
  Eye,
  EyeOff,
  Edit3,
  Sliders,
  RotateCcw,
  LogOut,
  Shield,
  Building,
  GraduationCap,
  Sparkles,
  Check,
  AlertTriangle,
  X,
  ExternalLink,
  Ban,
  HeartHandshake,
  CheckCircle2,
  Award
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { EventItem, UserPreferences, EventCategory } from '../../types';
import { EVENT_CATEGORIES, UW_FACULTIES, STUDY_YEARS, formatPublicName } from '../../data/mockData';
import { EventDetailModal } from '../feed/EventDetailModal';
import { UWVerificationModal } from '../common/UWVerificationModal';
import { PersonalityQuizModal } from '../common/PersonalityQuizModal';

interface ProfileTabProps {
  onOpenCreateEvent?: (draft?: EventItem) => void;
}

export const ProfileTab: React.FC<ProfileTabProps> = ({ onOpenCreateEvent }) => {
  const {
    user,
    logout,
    updateProfile,
    updatePreferences,
    events,
    savedEventIds,
    attendingEventIds,
    attendeeVisibility,
    disableBuddyMatching,
    toggleGoing,
    toggleSaveEvent,
    cancelEvent,
    resetDemoData,
    blockedUserIds,
    unblockUser,
    allAttendees
  } = useApp();

  const [activeSubSection, setActiveSubSection] = useState<'attending' | 'saved' | 'created'>('attending');
  const [verificationInfoOpen, setVerificationInfoOpen] = useState(false);

  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [editPrefsOpen, setEditPrefsOpen] = useState(false);
  const [accountSettingsOpen, setAccountSettingsOpen] = useState(false);
  const [selectedEventForDetail, setSelectedEventForDetail] = useState<EventItem | null>(null);
  const [quizModalOpen, setQuizModalOpen] = useState(false);
  const [verificationModalOpen, setVerificationModalOpen] = useState(false);
  const [actionNotice, setActionNotice] = useState('');

  // Edit Profile form state
  const [editName, setEditName] = useState(user?.name || '');
  const [editAvatar, setEditAvatar] = useState(user?.avatar || '');
  const [editFaculty, setEditFaculty] = useState(user?.faculty || 'Engineering');
  const [editProgram, setEditProgram] = useState(user?.program || '');
  const [editYear, setEditYear] = useState(user?.year || '3rd Year');
  const [editBio, setEditBio] = useState(user?.bio || '');
  const [editDob, setEditDob] = useState(user?.dob || '');

  // Edit Preferences form state
  const [prefCategories, setPrefCategories] = useState<EventCategory[]>(
    user?.preferences.categories || []
  );
  const [prefFaculties, setPrefFaculties] = useState<string[]>(
    user?.preferences.preferredFaculties || []
  );
  const [prefYears, setPrefYears] = useState<string[]>(
    user?.preferences.preferredYears || []
  );
  const [prefNoPreferences, setPrefNoPreferences] = useState(
    user?.preferences.noPreferences || false
  );

  if (!user) {
    return (
      <div className="p-12 text-center space-y-4">
        <User className="w-12 h-12 text-stone-300 mx-auto" />
        <h2 className="text-xl font-bold text-stone-900">You are logged out</h2>
        <p className="text-xs text-stone-600">Please sign in with a demo account to view profile.</p>
      </div>
    );
  }

  // Filtered lists
  const attendingEvents = events.filter((e) => attendingEventIds.includes(e.id));
  const savedEvents = events.filter((e) => savedEventIds.includes(e.id));
  const createdEvents = events.filter((e) => e.creatorId === user.id);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile({
      name: editName.trim(),
      avatar: editAvatar.trim(),
      faculty: editFaculty,
      program: editProgram.trim(),
      year: editYear,
      bio: editBio.trim(),
      dob: editDob.trim()
    });
    setEditProfileOpen(false);
    setActionNotice('Profile updated successfully.');
    setTimeout(() => setActionNotice(''), 3000);
  };

  const handleSavePreferences = (e: React.FormEvent) => {
    e.preventDefault();
    const newPrefs: UserPreferences = {
      categories: prefNoPreferences ? [] : prefCategories,
      noPreferences: prefNoPreferences,
      preferredFaculties: prefNoPreferences ? [] : prefFaculties,
      preferredYears: prefNoPreferences ? [] : prefYears
    };
    updatePreferences(newPrefs);
    setEditPrefsOpen(false);
    setActionNotice('Feed preferences updated.');
    setTimeout(() => setActionNotice(''), 3000);
  };

  const handleResetData = () => {
    if (window.confirm('Reset all demo state to fresh default events, chats, and requests?')) {
      resetDemoData();
      setAccountSettingsOpen(false);
      setActionNotice('Demo data restored to initial state.');
      setTimeout(() => setActionNotice(''), 3000);
    }
  };

  return (
    <div className="pb-20 md:pb-12 max-w-5xl mx-auto space-y-6">
      {/* Notice Banner */}
      {actionNotice && (
        <div className="p-3.5 bg-amber-500/10 border border-amber-300 text-amber-950 text-xs font-semibold rounded-2xl flex items-center gap-2 animate-in fade-in">
          <Check className="w-4 h-4 text-amber-600 shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Main Profile Header Card */}
      <div className="bg-white rounded-3xl border border-stone-200 p-6 sm:p-8 shadow-xs relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-4">
            <img
              src={user.avatar}
              alt={user.name}
              referrerPolicy="no-referrer"
              className="w-18 h-18 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-stone-200 shrink-0 shadow-xs"
            />
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight">
                  {user.name}
                </h1>
                <button
                  type="button"
                  onClick={() => setVerificationInfoOpen(true)}
                  className="text-[11px] font-bold text-stone-950 bg-amber-400 border border-amber-400 hover:bg-amber-500 px-2.5 py-0.5 rounded-full shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
                  title="Click to view Demo Verification details"
                >
                  <Shield className="w-3 h-3 text-stone-950" />
                  <span>Demo verification (@uwaterloo.ca email)</span>
                </button>
              </div>

              <div className="flex items-center gap-2 text-xs text-stone-600 flex-wrap">
                <div className="flex items-center gap-1">
                  <Building className="w-3.5 h-3.5 text-amber-600" />
                  <span className="font-medium text-stone-800">{user.school}</span>
                </div>
                <span aria-hidden="true" className="text-stone-400">·</span>
                <div className="flex items-center gap-1">
                  <GraduationCap className="w-3.5 h-3.5 text-stone-500" />
                  <span>{user.faculty} ({user.program})</span>
                </div>
                <span aria-hidden="true" className="text-stone-400">·</span>
                <span>{user.year}</span>
              </div>

              <p className="text-[11px] text-stone-500 pt-0.5">
                Buddy profile name: <strong className="text-stone-800">{formatPublicName(user.name)}</strong> (First name & last initial).
              </p>

              {user.bio && (
                <p className="text-xs text-stone-700 max-w-xl pt-0.5 leading-relaxed">
                  {user.bio}
                </p>
              )}

            </div>
          </div>

          {/* Quick Header Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
            <button
              onClick={() => {
                setEditName(user.name);
                setEditAvatar(user.avatar);
                setEditFaculty(user.faculty);
                setEditProgram(user.program);
                setEditYear(user.year);
                setEditBio(user.bio);
                setEditDob(user.dob);
                setEditProfileOpen(true);
              }}
              className="px-3.5 py-2 rounded-xl border border-stone-200 hover:bg-stone-50 text-stone-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Profile</span>
            </button>

            <button
              onClick={() => {
                setPrefCategories(user.preferences.categories);
                setPrefFaculties(user.preferences.preferredFaculties);
                setPrefYears(user.preferences.preferredYears);
                setPrefNoPreferences(user.preferences.noPreferences);
                setEditPrefsOpen(true);
              }}
              className="px-3.5 py-2 rounded-xl border border-stone-200 hover:bg-stone-50 text-stone-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Preferences</span>
            </button>

            <button
              onClick={() => setAccountSettingsOpen(true)}
              className="p-2 rounded-xl border border-stone-200 hover:bg-stone-50 text-stone-600 transition-colors"
              title="Account Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Global Attendance Visibility Privacy Notice */}
        <div className="mt-6 pt-5 border-t border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs bg-stone-50/80 -mx-6 -mb-6 p-4 sm:px-6">
          <div className="flex items-center gap-2 text-stone-700">
            <Shield className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong className="text-stone-900">Privacy & Buddy Settings:</strong> Attendance is strictly private by default. You control &ldquo;Open to meeting attendees&rdquo; per event.
            </span>
          </div>
          <span className="text-[11px] text-stone-500">
            DOB & Email are never displayed
          </span>
        </div>
      </div>

      {/* CORE DIFFERENTIATOR: Personalized Buddy Compatibility & Verification Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1 & 2: Personality & Interest Quiz Profile (2 Cols) */}
        <div className="md:col-span-2 bg-white rounded-3xl border border-stone-200 p-6 shadow-xs space-y-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <HeartHandshake className="w-5 h-5 text-amber-600 shrink-0" />
                <h3 className="text-base font-bold text-stone-950">
                  Buddy Compatibility Profile
                </h3>
                <span className="text-[10px] bg-amber-400 text-stone-950 font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Core Feature
                </span>
              </div>
              <p className="text-xs text-stone-600">
                Powers transparent compatibility matching with students attending the same events.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setQuizModalOpen(true)}
              className="px-3.5 py-1.5 bg-stone-950 hover:bg-black text-amber-300 text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-2xs transition-all border border-stone-800"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>{user.personalityQuiz ? 'Retake Quiz' : 'Take 1-Min Quiz'}</span>
            </button>
          </div>

          {user.personalityQuiz ? (
            <div className="space-y-3 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200/80 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-stone-500 block">Social Energy</span>
                  <span className="font-bold text-stone-950 block">{user.personalityQuiz.socialEnergy}</span>
                </div>

                <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200/80 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-stone-500 block">Preferred Atmosphere</span>
                  <span className="font-bold text-stone-950 block capitalize truncate" title={user.personalityQuiz.socialEnvironment}>
                    {user.personalityQuiz.socialEnvironment.replace('_', ' ')}
                  </span>
                </div>

                <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200/80 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-stone-500 block">Group Size</span>
                  <span className="font-bold text-stone-950 block capitalize">{user.personalityQuiz.groupSize.replace('_', ' ')}</span>
                </div>
              </div>

              {/* Hobbies list */}
              <div className="p-3 bg-amber-500/10 rounded-2xl border border-amber-300/80 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-950">Active Interests & Hobbies</span>
                  <span className="text-[10px] text-amber-900 font-semibold">{user.personalityQuiz.hobbies.length} Selected</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {user.personalityQuiz.hobbies.map((hobby) => (
                    <span
                      key={hobby}
                      className="px-2.5 py-1 rounded-xl bg-white border border-amber-200 text-stone-900 font-medium text-[11px] shadow-2xs"
                    >
                      {hobby}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 bg-stone-50 rounded-2xl border border-stone-200 text-center space-y-2">
              <Sparkles className="w-8 h-8 text-amber-500 mx-auto" />
              <p className="text-xs font-bold text-stone-900">
                You haven&apos;t taken the compatibility quiz yet!
              </p>
              <p className="text-xs text-stone-500 max-w-sm mx-auto">
                Answer 5 quick multiple-choice questions about your social vibe, atmosphere preferences, and interests to find like-minded event buddies.
              </p>
              <button
                type="button"
                onClick={() => setQuizModalOpen(true)}
                className="mt-2 px-4 py-2 bg-amber-400 hover:bg-amber-500 text-stone-950 font-black text-xs rounded-xl shadow-xs transition-colors"
              >
                Start 1-Minute Quiz
              </button>
            </div>
          )}
        </div>

        {/* Card 3: Waterloo Student Verification (1 Col) */}
        <div className="bg-white rounded-3xl border border-stone-200 p-6 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-600 shrink-0" />
              <h3 className="text-base font-bold text-stone-950">
                Waterloo Verification
              </h3>
            </div>

            {user.isVerifiedUWStudent ? (
              <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-950">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Verified Waterloo Student</span>
                </div>
                <p className="text-[11px] text-stone-700 leading-relaxed">
                  Your account is verified with University of Waterloo student credentials. Buddy matching features are unlocked.
                </p>
              </div>
            ) : (
              <div className="p-3.5 bg-amber-100 rounded-2xl border border-amber-300 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-950">
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>Unverified Account</span>
                </div>
                <p className="text-[11px] text-stone-700 leading-relaxed">
                  Verify your @uwaterloo.ca email address to unlock personalized buddy matching.
                </p>
              </div>
            )}

            <div className="text-[11px] text-stone-500 space-y-1">
              <div className="flex items-center gap-1.5 text-stone-700 font-semibold">
                <Shield className="w-3.5 h-3.5 text-amber-600" />
                <span>Privacy Protection</span>
              </div>
              <p>
                Student emails and DOB are never made public. Only your first name, last initial, and optional bio are shown to opted-in event buddies.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              if (user.isVerifiedUWStudent) {
                setVerificationInfoOpen(true);
              } else {
                setVerificationModalOpen(true);
              }
            }}
            className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold transition-colors ${
              user.isVerifiedUWStudent
                ? 'bg-stone-100 hover:bg-stone-200 text-stone-800'
                : 'bg-amber-400 hover:bg-amber-500 text-stone-950 shadow-xs'
            }`}
          >
            {user.isVerifiedUWStudent ? 'View Verification Info' : 'Verify @uwaterloo.ca Now'}
          </button>
        </div>
      </div>

      {/* Sub-section Navigation */}
      <div className="flex items-center p-1 bg-stone-100 rounded-2xl w-fit">
        <button
          onClick={() => setActiveSubSection('attending')}
          className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl transition-all flex items-center gap-2 ${
            activeSubSection === 'attending'
              ? 'bg-white text-stone-900 shadow-xs'
              : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Events I&apos;m Attending ({attendingEvents.length})</span>
        </button>

        <button
          onClick={() => setActiveSubSection('saved')}
          className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl transition-all flex items-center gap-2 ${
            activeSubSection === 'saved'
              ? 'bg-white text-stone-900 shadow-xs'
              : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          <Bookmark className="w-4 h-4" />
          <span>Saved ({savedEvents.length})</span>
        </button>

        <button
          onClick={() => setActiveSubSection('created')}
          className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl transition-all flex items-center gap-2 ${
            activeSubSection === 'created'
              ? 'bg-white text-stone-900 shadow-xs'
              : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          <PlusCircle className="w-4 h-4" />
          <span>My Created & Drafts ({createdEvents.length})</span>
        </button>
      </div>

      {/* SUB-SECTION 1: Events I'm Attending */}
      {activeSubSection === 'attending' && (
        <div className="space-y-3">
          {attendingEvents.length === 0 ? (
            <div className="p-8 bg-white rounded-3xl border border-stone-200 text-center space-y-2">
              <Calendar className="w-8 h-8 text-stone-300 mx-auto" />
              <p className="text-xs sm:text-sm font-semibold text-stone-800">
                You haven&apos;t marked attendance for any upcoming events
              </p>
              <p className="text-xs text-stone-500">
                Browse the Campus Feed and select &ldquo;I&apos;m Going&rdquo; to opt into events and find buddies.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {attendingEvents.map((ev) => {
                const isVisibilityOn = attendeeVisibility[ev.id] ?? false;
                const isCancelled = ev.status === 'cancelled';

                return (
                  <div
                    key={ev.id}
                    className="p-4 sm:p-5 bg-white rounded-2xl border border-stone-200 hover:border-stone-300 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div
                      onClick={() => setSelectedEventForDetail(ev)}
                      className="cursor-pointer min-w-0 flex-1 space-y-1"
                    >
                      <div className="flex items-center gap-2 text-xs text-stone-500 font-medium">
                        <span className="text-amber-700 font-bold">{ev.category}</span>
                        <span aria-hidden="true">·</span>
                        <span>{ev.date} at {ev.startTime}</span>
                        {isCancelled && (
                          <span className="text-[10px] bg-red-100 text-red-800 font-bold px-1.5 py-0.2 rounded-md">
                            Cancelled
                          </span>
                        )}
                      </div>
                      <h4 className="font-bold text-sm sm:text-base text-stone-900 truncate">
                        {ev.title}
                      </h4>
                      <p className="text-xs text-stone-600 truncate">{ev.location}</p>
                    </div>

                    {/* Attendance Controls */}
                    <div className="flex flex-wrap items-center gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-100">
                      {/* Buddy visibility status */}
                      {!ev.isResearchStudy && !isCancelled && (
                        <div>
                          {isVisibilityOn ? (
                            <div className="flex items-center gap-1.5 bg-amber-100 text-stone-950 px-3 py-1.5 rounded-xl border border-amber-300 text-xs font-bold">
                              <Eye className="w-3.5 h-3.5 text-amber-700" />
                              <span>Buddy visible</span>
                              <button
                                type="button"
                                onClick={() => {
                                  disableBuddyMatching(ev.id);
                                  setActionNotice(`Turned off buddy visibility for "${ev.title}".`);
                                  setTimeout(() => setActionNotice(''), 3000);
                                }}
                                className="ml-1 text-[11px] text-red-700 hover:underline font-medium"
                              >
                                (Turn off)
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setSelectedEventForDetail(ev)}
                              className="flex items-center gap-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 px-3 py-1.5 rounded-xl border border-stone-200 text-xs font-medium"
                            >
                              <EyeOff className="w-3.5 h-3.5 text-stone-400" />
                              <span>Buddy matching off</span>
                            </button>
                          )}
                        </div>
                      )}

                      <button
                        onClick={() => toggleGoing(ev.id)}
                        className="text-xs text-red-600 hover:text-red-800 hover:underline font-medium px-2 py-1"
                      >
                        Remove Attendance
                      </button>
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SUB-SECTION 2: Saved Events */}
      {activeSubSection === 'saved' && (
        <div className="space-y-3">
          {savedEvents.length === 0 ? (
            <div className="p-8 bg-white rounded-3xl border border-stone-200 text-center space-y-2">
              <Bookmark className="w-8 h-8 text-stone-300 mx-auto" />
              <p className="text-xs sm:text-sm font-semibold text-stone-800">
                No saved events yet
              </p>
              <p className="text-xs text-stone-500">
                Click the bookmark button on any event card to save it for later.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {savedEvents.map((ev) => (
                <div
                  key={ev.id}
                  className="p-4 sm:p-5 bg-white rounded-2xl border border-stone-200 hover:border-stone-300 transition-colors flex items-center justify-between gap-4"
                >
                  <div
                    onClick={() => setSelectedEventForDetail(ev)}
                    className="cursor-pointer min-w-0 flex-1 space-y-1"
                  >
                    <div className="flex items-center gap-2 text-xs text-stone-500">
                      <span className="text-amber-700 font-bold">{ev.category}</span>
                      <span aria-hidden="true">·</span>
                      <span>{ev.date}</span>
                    </div>
                    <h4 className="font-bold text-sm sm:text-base text-stone-900 truncate">
                      {ev.title}
                    </h4>
                    <p className="text-xs text-stone-600 truncate">{ev.location}</p>
                  </div>

                  <button
                    onClick={() => toggleSaveEvent(ev.id)}
                    className="p-2 text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded-xl"
                    title="Remove from saved"
                  >
                    <Bookmark className="w-4 h-4 fill-amber-400 text-amber-500" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUB-SECTION 3: My Created Events & Drafts */}
      {activeSubSection === 'created' && (
        <div className="space-y-3">
          {createdEvents.length === 0 ? (
            <div className="p-8 bg-white rounded-3xl border border-stone-200 text-center space-y-2">
              <PlusCircle className="w-8 h-8 text-stone-300 mx-auto" />
              <p className="text-xs sm:text-sm font-semibold text-stone-800">
                You haven&apos;t created any events or drafts
              </p>
              <p className="text-xs text-stone-500">
                Head over to the &ldquo;Create Event&rdquo; tab to post an event for your club or group.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {createdEvents.map((ev) => (
                <div
                  key={ev.id}
                  className="p-4 sm:p-5 bg-white rounded-2xl border border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div
                    onClick={() => setSelectedEventForDetail(ev)}
                    className="cursor-pointer min-w-0 flex-1 space-y-1"
                  >
                    <div className="flex items-center gap-2 text-xs">
                      <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                        ev.status === 'published'
                          ? 'bg-amber-400/20 text-stone-950 border border-amber-300'
                          : ev.status === 'draft'
                          ? 'bg-stone-200 text-stone-800'
                          : 'bg-red-100 text-red-900'
                      }`}>
                        {ev.status.toUpperCase()}
                      </span>
                      <span className="text-stone-400">·</span>
                      <span className="text-stone-500">{ev.category}</span>
                    </div>
                    <h4 className="font-bold text-sm sm:text-base text-stone-900 truncate">
                      {ev.title}
                    </h4>
                    <p className="text-xs text-stone-600 truncate">{ev.date} · {ev.location}</p>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    {ev.status !== 'cancelled' && (
                      <button
                        onClick={() => {
                          if (window.confirm(`Are you sure you want to cancel "${ev.title}"? Attendees will be informed.`)) {
                            cancelEvent(ev.id);
                            setActionNotice(`Event "${ev.title}" has been marked as cancelled.`);
                            setTimeout(() => setActionNotice(''), 3000);
                          }
                        }}
                        className="px-3 py-1.5 rounded-xl border border-red-200 text-red-700 hover:bg-red-50 text-xs font-semibold"
                      >
                        Cancel Event
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Edit Profile Modal */}
      {editProfileOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-stone-100 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setEditProfileOpen(false)}
              className="absolute top-5 right-5 p-2 text-stone-400 hover:text-stone-700 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <h3 className="text-lg font-bold text-stone-900">Edit Student Profile</h3>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-stone-200"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Profile Avatar URL
                </label>
                <input
                  type="url"
                  value={editAvatar}
                  onChange={(e) => setEditAvatar(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-stone-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Faculty
                  </label>
                  <select
                    value={editFaculty}
                    onChange={(e) => setEditFaculty(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-stone-200 bg-white"
                  >
                    {UW_FACULTIES.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Year of Study
                  </label>
                  <select
                    value={editYear}
                    onChange={(e) => setEditYear(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-stone-200 bg-white"
                  >
                    {STUDY_YEARS.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Program
                </label>
                <input
                  type="text"
                  value={editProgram}
                  onChange={(e) => setEditProgram(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-stone-200"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Bio
                </label>
                <textarea
                  rows={2}
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-stone-200 resize-none"
                />
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200/80 text-xs space-y-1">
                <span className="font-semibold text-amber-900 flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5 text-amber-600" />
                  <span>Private Account Information</span>
                </span>
                <label className="block text-[11px] text-stone-600">
                  Date of birth (Private)
                </label>
                <input
                  type="date"
                  value={editDob}
                  onChange={(e) => setEditDob(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-amber-200 bg-white text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditProfileOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-stone-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-400 hover:bg-amber-500 text-stone-950 rounded-xl text-xs font-bold shadow-xs transition-all"
                >
                  Save Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Preferences Modal */}
      {editPrefsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-stone-100 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setEditPrefsOpen(false)}
              className="absolute top-5 right-5 p-2 text-stone-400 hover:text-stone-700 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>

            <form onSubmit={handleSavePreferences} className="space-y-4">
              <h3 className="text-lg font-bold text-stone-900">Edit Recommendations</h3>
              <p className="text-xs text-stone-600 leading-normal">
                Personalizes your &ldquo;For You&rdquo; campus feed. You can still view all events anytime.
              </p>

              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-stone-900">Show everything</p>
                  <p className="text-[11px] text-stone-500">Clear custom selections.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPrefNoPreferences(true);
                    setPrefCategories([]);
                    setPrefFaculties([]);
                    setPrefYears([]);
                  }}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    prefNoPreferences
                      ? 'bg-stone-950 text-amber-300 font-bold'
                      : 'bg-white border border-stone-300 text-stone-700 hover:bg-stone-50'
                  }`}
                >
                  No preferences
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-2">
                  Event Categories
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {EVENT_CATEGORIES.map((cat) => {
                    const isSelected = prefCategories.includes(cat as EventCategory);
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => {
                          if (prefNoPreferences) setPrefNoPreferences(false);
                          setPrefCategories((prev) =>
                            prev.includes(cat as EventCategory)
                              ? prev.filter((c) => c !== cat)
                              : [...prev, cat as EventCategory]
                          );
                        }}
                        className={`text-left p-2.5 rounded-xl border text-xs font-medium flex items-center justify-between transition-colors ${
                          isSelected && !prefNoPreferences
                            ? 'bg-amber-400/15 border-amber-400 text-stone-950 font-bold'
                            : 'bg-white border-stone-200 text-stone-700 hover:border-stone-300'
                        }`}
                      >
                        <span className="truncate pr-1">{cat}</span>
                        {isSelected && !prefNoPreferences && (
                          <Check className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditPrefsOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-stone-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-400 hover:bg-amber-500 text-stone-950 rounded-xl text-xs font-bold shadow-xs transition-all"
                >
                  Update Preferences
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Account Settings & Privacy Reassurance Modal */}
      {accountSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-stone-100 relative space-y-5">
            <button
              onClick={() => setAccountSettingsOpen(false)}
              className="absolute top-5 right-5 p-2 text-stone-400 hover:text-stone-700 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <div className="flex items-center gap-2 text-stone-900">
                <Settings className="w-5 h-5 text-amber-600" />
                <h3 className="text-lg font-bold">Account & Privacy Settings</h3>
              </div>
              <p className="text-xs text-stone-500 mt-0.5">
                Manage your credentials and local demo simulation state.
              </p>
            </div>

            {/* Confidential Data Box */}
            <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 space-y-2.5 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-stone-800">
                <Shield className="w-4 h-4 text-amber-600" />
                <span>Strictly Private Information</span>
              </div>
              <div className="space-y-1">
                <p className="text-stone-600">
                  <span className="font-semibold text-stone-700">Account Email:</span> {user.email}
                </p>
                <p className="text-stone-600">
                  <span className="font-semibold text-stone-700">Date of Birth:</span> {user.dob || 'Not specified'}
                </p>
              </div>
              <p className="text-[11px] text-stone-500 pt-1 border-t border-stone-200/60">
                These fields are never exposed on your public profile or shared with event organizers or other students.
              </p>
            </div>

            {/* Blocked Users Section - Requirement 4 */}
            <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-stone-800">
                  <Ban className="w-4 h-4 text-stone-600" />
                  <span>Blocked Users ({blockedUserIds.length})</span>
                </div>
              </div>
              <p className="text-[11px] text-stone-500">
                Blocked users cannot send you buddy requests or see your attendance.
              </p>

              {blockedUserIds.length === 0 ? (
                <p className="text-[11px] text-stone-400 italic">No blocked users.</p>
              ) : (
                <div className="space-y-1.5 pt-1">
                  {blockedUserIds.map((bId) => {
                    const attendee = allAttendees[bId];
                    const name = attendee ? attendee.name : `User ${bId}`;
                    return (
                      <div
                        key={bId}
                        className="flex items-center justify-between p-2 bg-white rounded-xl border border-stone-200"
                      >
                        <span className="font-semibold text-stone-900">{name}</span>
                        <button
                          type="button"
                          onClick={() => {
                            unblockUser(bId);
                            setActionNotice(`Unblocked ${name}.`);
                            setTimeout(() => setActionNotice(''), 3000);
                          }}
                          className="text-[11px] font-bold text-amber-800 hover:text-amber-950 underline"
                        >
                          Unblock
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Reset Demo Data */}
            <div className="p-4 bg-amber-500/10 rounded-2xl border border-amber-300 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-950">
                <RotateCcw className="w-4 h-4 text-amber-700" />
                <span>Reset Demo Simulation State</span>
              </div>
              <p className="text-xs text-stone-600 leading-normal">
                Restores initial sample events, resets buddy requests, and clears any local prototype blocks.
              </p>
              <button
                type="button"
                onClick={handleResetData}
                className="w-full py-2 px-3 bg-white hover:bg-stone-50 text-stone-950 font-bold text-xs rounded-xl border border-stone-300 shadow-2xs transition-colors"
              >
                Reset All Demo Data
              </button>
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-stone-100">
              <button
                type="button"
                onClick={() => {
                  logout();
                  setAccountSettingsOpen(false);
                }}
                className="text-xs text-red-600 hover:text-red-800 font-semibold flex items-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Log Out</span>
              </button>

              <button
                type="button"
                onClick={() => setAccountSettingsOpen(false)}
                className="px-4 py-2 bg-stone-900 text-white rounded-xl text-xs font-semibold"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Demo Verification Info Modal - Requirement 7 */}
      {verificationInfoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-stone-100 relative space-y-4">
            <button
              onClick={() => setVerificationInfoOpen(false)}
              className="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-700 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-amber-600" />
              <h3 className="font-bold text-base text-stone-900">
                About &ldquo;Demo Verification&rdquo;
              </h3>
            </div>

            <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200 text-xs space-y-2 text-stone-800">
              <p className="font-bold text-amber-950">
                How Email Verification Works:
              </p>
              <p className="leading-relaxed">
                In a future production version of WatHive, users would be required to verify their @uwaterloo.ca email address with a one-time passcode.
              </p>
              <p className="leading-relaxed">
                <strong className="text-stone-950">Important clarification:</strong> Email verification only confirms that an account holder had active access to a University of Waterloo email inbox. It does <strong>not</strong> verify an individual&apos;s identity, background, intentions, or personal trustworthiness.
              </p>
              <p className="leading-relaxed text-stone-600 italic">
                WatHive strictly avoids labels such as &ldquo;Safe user&rdquo; or &ldquo;Trusted buddy.&rdquo; We encourage meeting in public campus locations and you can disconnect or block at any time.
              </p>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setVerificationInfoOpen(false)}
                className="px-4 py-2 bg-stone-950 text-amber-300 font-bold rounded-xl text-xs"
              >
                Understood
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
        />
      )}

      {/* UW Verification Modal */}
      <UWVerificationModal
        isOpen={verificationModalOpen}
        onClose={() => setVerificationModalOpen(false)}
        onSuccess={() => {
          setActionNotice("Account verified as University of Waterloo student! Buddy matching is now available.");
          setTimeout(() => setActionNotice(''), 3500);
        }}
      />

      {/* Personality & Interests Quiz Modal */}
      <PersonalityQuizModal
        isOpen={quizModalOpen}
        onClose={() => setQuizModalOpen(false)}
        onSuccess={() => {
          setActionNotice("Personality & interests profile updated! Compatibility scores recalculated.");
          setTimeout(() => setActionNotice(''), 3500);
        }}
      />
    </div>
  );
};

