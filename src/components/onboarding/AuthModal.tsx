import React, { useState } from 'react';
import { Sparkles, Shield, ArrowRight, Check, X, Building, Info, UserCircle2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { EVENT_CATEGORIES, UW_FACULTIES, STUDY_YEARS } from '../../data/mockData';
import { EventCategory, UserPreferences } from '../../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const {
    user,
    loginDemoUser,
    updateOnboardingProfile,
    completeOnboardingPreferences,
    updatePersonalityQuiz
  } = useApp();

  const [mode, setMode] = useState<'welcome' | 'step1' | 'step2' | 'quiz'>('welcome');

  // Step 1 Profile form state
  const [name, setName] = useState('Jordan Taylor');
  const [avatar, setAvatar] = useState('https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80');
  const [school] = useState('University of Waterloo');
  const [faculty, setFaculty] = useState('Engineering');
  const [program, setProgram] = useState('Systems Design Engineering');
  const [year, setYear] = useState('2nd Year');
  const [bio, setBio] = useState('Excited to attend design sprints, campus hackathons, and coffee chats!');
  const [dob, setDob] = useState('2004-09-12');
  const [step1Error, setStep1Error] = useState('');

  // Step 2 Preferences state
  const [selectedCategories, setSelectedCategories] = useState<EventCategory[]>([
    'Technology',
    'Career and networking',
    'Social events'
  ]);
  const [selectedFaculties, setSelectedFaculties] = useState<string[]>(['Engineering', 'Mathematics']);
  const [selectedYears, setSelectedYears] = useState<string[]>(['2nd Year', '3rd Year']);
  const [noPreferences, setNoPreferences] = useState(false);

  // Step 3 Quiz state
  const [quizEnergy, setQuizEnergy] = useState<'introvert' | 'ambivert' | 'extrovert'>('ambivert');
  const [quizEnv, setQuizEnv] = useState<'cozy_relaxed' | 'interactive_workshop' | 'lively_vibrant' | 'active_movement'>('cozy_relaxed');
  const [quizHobbies, setQuizHobbies] = useState<string[]>(['Tech & Coding', 'Foodie & Cafes', 'Board Games & Trivia']);
  const [quizGroup, setQuizGroup] = useState<'duo' | 'small_pod' | 'larger_group' | 'flexible'>('duo');


  if (!isOpen) return null;

  const handleQuickDemoLogin = () => {
    loginDemoUser(false); // Log in as Alex Chen
    onClose();
  };

  const handleStartSignUp = () => {
    loginDemoUser(true); // Create fresh draft user
    setMode('step1');
  };

  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setStep1Error('Please enter your full name.');
      return;
    }
    setStep1Error('');
    updateOnboardingProfile({
      name: name.trim(),
      avatar,
      school,
      faculty,
      program: program.trim() || `${faculty} Student`,
      year,
      bio: bio.trim(),
      dob: dob.trim()
    });
    setMode('step2');
  };

  const toggleCategory = (cat: EventCategory) => {
    if (noPreferences) setNoPreferences(false);
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const toggleFacultyPref = (fac: string) => {
    if (noPreferences) setNoPreferences(false);
    setSelectedFaculties((prev) =>
      prev.includes(fac) ? prev.filter((f) => f !== fac) : [...prev, fac]
    );
  };

  const toggleYearPref = (yr: string) => {
    if (noPreferences) setNoPreferences(false);
    setSelectedYears((prev) =>
      prev.includes(yr) ? prev.filter((y) => y !== yr) : [...prev, yr]
    );
  };

  const handleNoPreferencesToggle = () => {
    setNoPreferences(true);
    setSelectedCategories([]);
    setSelectedFaculties([]);
    setSelectedYears([]);
  };

  const handleStep2Submit = () => {
    const prefs: UserPreferences = {
      categories: noPreferences ? [] : selectedCategories,
      noPreferences,
      preferredFaculties: noPreferences ? [] : selectedFaculties,
      preferredYears: noPreferences ? [] : selectedYears
    };
    completeOnboardingPreferences(prefs);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-surface text-ink rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-lift border border-line my-8 relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-muted hover:text-ink rounded-full hover:bg-surface-soft transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {mode === 'welcome' && (
          <div className="space-y-6">
            <div className="text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-accent text-accent-ink flex items-center justify-center mx-auto text-2xl font-black shadow-soft">
                W
              </div>
              <h2 className="text-2xl font-bold text-ink tracking-tight">
                Welcome to WatHive
              </h2>
              <p className="text-sm text-muted max-w-sm mx-auto leading-relaxed">
                Connect with the University of Waterloo campus community through events,
                student clubs, and friendly buddy matching so you never have to go alone.
              </p>
            </div>

            <div className="p-4 bg-accent-soft border border-accent/30 rounded-2xl text-xs text-ink space-y-1.5">
              <div className="font-bold flex items-center gap-1.5 text-accent-text">
                <Sparkles className="w-4 h-4" />
                <span>Interactive Prototype Mode</span>
              </div>
              <p className="text-muted leading-normal">
                No real passwords required. You can test immediately using the pre-loaded Alex Chen profile (with active chats and incoming buddy requests), or create a custom demo student.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <button
                onClick={handleQuickDemoLogin}
                className="w-full py-3.5 px-4 rounded-xl bg-accent hover:bg-accent-hover text-accent-ink font-bold text-sm flex items-center justify-center gap-2 shadow-soft transition-all cursor-pointer"
              >
                <span>Continue as Alex Chen (Demo 3rd Year)</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={handleStartSignUp}
                className="w-full py-3 px-4 rounded-xl border border-line hover:border-accent text-ink font-semibold text-sm transition-colors hover:bg-surface-soft cursor-pointer"
              >
                Create Custom Demo Student (2-Step Onboarding)
              </button>
            </div>
          </div>
        )}

        {mode === 'step1' && (
          <form onSubmit={handleStep1Submit} className="space-y-5">
            <div className="space-y-1">
              <div className="flex items-center justify-between pr-8">
                <span className="text-xs font-bold text-accent-text">Step 1 of 2</span>
                <span className="text-xs text-muted">Student Profile</span>
              </div>
              <h3 className="text-xl font-bold text-ink">Create your campus profile</h3>
              <p className="text-xs text-muted">
                Your profile is only visible to other students when you opt in to connect for a specific event.
              </p>
            </div>

            {step1Error && (
              <div className="p-3 bg-danger-soft text-danger text-xs rounded-xl border border-danger/30">
                {step1Error}
              </div>
            )}

            <div className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-semibold text-ink mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Jordan Taylor"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-line focus:outline-none focus:ring-2 focus:ring-accent text-sm text-ink bg-canvas placeholder:text-muted"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink mb-1">
                  School or Community
                </label>
                <div className="flex items-center justify-between p-3 rounded-xl border border-line bg-surface-soft/50 text-ink text-sm">
                  <div className="flex items-center gap-2">
                    <Building className="w-4 h-4 text-accent-text" />
                    <span className="font-semibold text-ink">University of Waterloo</span>
                  </div>
                  <span className="text-[11px] text-accent-text font-bold bg-accent-soft border border-accent/30 px-2 py-0.5 rounded-md">
                    First Active Community
                  </span>
                </div>
                <p className="text-[11px] text-muted mt-1">
                  WatHive starts with UW, with multi-campus support designed for future expansion.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">
                    Faculty *
                  </label>
                  <select
                    value={faculty}
                    onChange={(e) => setFaculty(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-line focus:outline-none focus:ring-2 focus:ring-accent text-sm text-ink bg-canvas"
                  >
                    {UW_FACULTIES.map((fac) => (
                      <option key={fac} value={fac}>{fac}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">
                    Year of Study *
                  </label>
                  <select
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-line focus:outline-none focus:ring-2 focus:ring-accent text-sm text-ink bg-canvas"
                  >
                    {STUDY_YEARS.map((yr) => (
                      <option key={yr} value={yr}>{yr}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink mb-1">
                  Program
                </label>
                <input
                  type="text"
                  value={program}
                  onChange={(e) => setProgram(e.target.value)}
                  placeholder="e.g. Systems Design Engineering"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-line focus:outline-none focus:ring-2 focus:ring-accent text-sm text-ink bg-canvas placeholder:text-muted"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink mb-1">
                  Short Bio (Optional)
                </label>
                <textarea
                  rows={2}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell potential event buddies a bit about yourself..."
                  className="w-full px-3.5 py-2 rounded-xl border border-line focus:outline-none focus:ring-2 focus:ring-accent text-sm text-ink bg-canvas placeholder:text-muted resize-none"
                />
              </div>

              <div className="p-3.5 rounded-xl bg-accent-soft/70 border border-accent/30 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-accent-text">
                  <Shield className="w-3.5 h-3.5" />
                  <span>Private Account Information</span>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-muted mb-1">
                    Date of Birth (Optional, strictly private)
                  </label>
                  <input
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-line bg-canvas text-xs text-ink focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                  <p className="text-[11px] text-muted mt-1">
                    Your date of birth is strictly confidential. It is never displayed on your profile or shared with other attendees.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setMode('welcome')}
                className="text-xs font-medium text-muted hover:text-ink px-3 py-2 cursor-pointer"
              >
                Back
              </button>
              <button
                type="submit"
                className="py-2.5 px-5 rounded-xl bg-accent hover:bg-accent-hover text-accent-ink font-bold text-sm flex items-center gap-2 shadow-soft transition-all cursor-pointer"
              >
                <span>Continue to Preferences</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        )}

        {mode === 'step2' && (
          <div className="space-y-5">
            <div className="space-y-1">
              <div className="flex items-center justify-between pr-8">
                <span className="text-xs font-bold text-accent-text">Step 2 of 2</span>
                <span className="text-xs text-muted">Buddy Interests</span>
              </div>
              <h3 className="text-xl font-bold text-ink">Share your interests</h3>
              <p className="text-xs text-muted leading-relaxed">
                Your interests help match you with compatible buddies at campus events. You&apos;ll always see all upcoming events in Explore.
              </p>
            </div>

            {/* Quick No preferences button */}
            <div className="p-3 bg-surface-soft/50 rounded-2xl border border-line flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-ink">Open to anything?</p>
                <p className="text-[11px] text-muted">Match with buddies across all campus event types.</p>
              </div>
              <button
                type="button"
                onClick={handleNoPreferencesToggle}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer shrink-0 ${
                  noPreferences
                    ? 'bg-accent text-accent-ink font-bold'
                    : 'bg-surface border border-line text-ink hover:bg-surface-soft'
                }`}
              >
                No preferences
              </button>
            </div>

            <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
              {/* Event categories */}
              <div>
                <label className="block text-xs font-semibold text-ink mb-2">
                  Event Categories (Multi-select)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {EVENT_CATEGORIES.map((cat) => {
                    const isSelected = selectedCategories.includes(cat as EventCategory);
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => toggleCategory(cat as EventCategory)}
                        className={`text-left p-2.5 rounded-xl border text-xs font-medium transition-colors flex items-center justify-between cursor-pointer ${
                          isSelected && !noPreferences
                            ? 'bg-accent-soft border-accent text-ink font-bold'
                            : 'bg-canvas/50 border-line text-ink hover:border-accent/50'
                        }`}
                      >
                        <span className="truncate pr-1">{cat}</span>
                        {isSelected && !noPreferences && (
                          <Check className="w-3.5 h-3.5 text-accent-text shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Faculty preferences */}
              <div>
                <label className="block text-xs font-semibold text-ink mb-2">
                  Preferred Faculty Events
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {UW_FACULTIES.map((fac) => {
                    const isSelected = selectedFaculties.includes(fac);
                    return (
                      <button
                        key={fac}
                        type="button"
                        onClick={() => toggleFacultyPref(fac)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                          isSelected && !noPreferences
                            ? 'bg-accent-soft border-accent text-ink font-bold'
                            : 'bg-canvas/50 border-line text-muted hover:text-ink'
                        }`}
                      >
                        {fac}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Year preferences */}
              <div>
                <label className="block text-xs font-semibold text-ink mb-2">
                  Target Audience / Year Levels
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {STUDY_YEARS.map((yr) => {
                    const isSelected = selectedYears.includes(yr);
                    return (
                      <button
                        key={yr}
                        type="button"
                        onClick={() => toggleYearPref(yr)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                          isSelected && !noPreferences
                            ? 'bg-accent-soft border-accent text-ink font-bold'
                            : 'bg-canvas/50 border-line text-muted hover:text-ink'
                        }`}
                      >
                        {yr}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-line">
              <button
                type="button"
                onClick={() => setMode('step1')}
                className="text-xs font-medium text-muted hover:text-ink px-3 py-2 cursor-pointer"
              >
                Back
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleStep2Submit}
                  className="px-3.5 py-2.5 rounded-xl text-muted hover:text-ink text-xs font-bold cursor-pointer"
                >
                  Skip Quiz &amp; Finish
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const prefs: UserPreferences = {
                      categories: noPreferences ? [] : selectedCategories,
                      noPreferences,
                      preferredFaculties: noPreferences ? [] : selectedFaculties,
                      preferredYears: noPreferences ? [] : selectedYears
                    };
                    completeOnboardingPreferences(prefs);
                    setMode('quiz');
                  }}
                  className="py-2.5 px-5 rounded-xl bg-accent hover:bg-accent-hover text-accent-ink font-bold text-xs sm:text-sm flex items-center gap-2 shadow-soft transition-all cursor-pointer"
                >
                  <span>Continue to Buddy Quiz</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {mode === 'quiz' && (
          <div className="space-y-5">
            <div className="space-y-1">
              <div className="flex items-center justify-between pr-8">
                <span className="text-xs font-bold text-accent-text">Optional Step 3 of 3</span>
                <span className="text-xs text-muted font-semibold">Buddy Matching</span>
              </div>
              <h3 className="text-xl font-bold text-ink">Personality &amp; Interests Quiz</h3>
              <p className="text-xs text-muted leading-relaxed">
                Personalized matching pairs you with fellow Waterloo students based on compatible social energy and shared passions, rather than arbitrary pairings.
              </p>
            </div>

            <div className="space-y-4 max-h-[48vh] overflow-y-auto pr-1">
              {/* 1. Social Energy */}
              <div>
                <label className="block text-xs font-bold text-ink mb-1.5">
                  1. Social Energy &amp; Introversion
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { val: 'introvert', label: 'Introverted', desc: 'Calm, low-pressure corners' },
                    { val: 'ambivert', label: 'Ambivert', desc: 'Balanced social pacing' },
                    { val: 'extrovert', label: 'Extroverted', desc: 'High energy & crowd-energized' }
                  ].map((item) => (
                    <button
                      key={item.val}
                      type="button"
                      onClick={() => setQuizEnergy(item.val as 'introvert' | 'ambivert' | 'extrovert')}
                      className={`p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                        quizEnergy === item.val
                          ? 'bg-accent-soft border-accent font-bold text-ink shadow-2xs'
                          : 'bg-canvas/50 border-line text-ink hover:border-accent/50'
                      }`}
                    >
                      <div className="font-bold">{item.label}</div>
                      <div className="text-[10px] text-muted mt-0.5">{item.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Atmosphere */}
              <div>
                <label className="block text-xs font-bold text-ink mb-1.5">
                  2. Preferred Atmosphere
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { val: 'cozy_relaxed', label: 'Cozy & Relaxed', desc: 'Low-noise lounges & cafes' },
                    { val: 'interactive_workshop', label: 'Structured Jam', desc: 'Hackathons & design jams' },
                    { val: 'lively_vibrant', label: 'Bustling & Festive', desc: 'Night markets & campus socials' },
                    { val: 'active_movement', label: 'Active & Sports', desc: 'Gym drop-ins & recreation' }
                  ].map((item) => (
                    <button
                      key={item.val}
                      type="button"
                      onClick={() => setQuizEnv(item.val as 'cozy_relaxed' | 'interactive_workshop' | 'lively_vibrant' | 'active_movement')}
                      className={`p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                        quizEnv === item.val
                          ? 'bg-accent-soft border-accent font-bold text-ink shadow-2xs'
                          : 'bg-canvas/50 border-line text-ink hover:border-accent/50'
                      }`}
                    >
                      <div className="font-bold">{item.label}</div>
                      <div className="text-[10px] text-muted mt-0.5">{item.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. Group Size */}
              <div>
                <label className="block text-xs font-bold text-ink mb-1.5">
                  3. Group Size Preference
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { val: 'duo', label: '1-on-1 Buddy Duo', desc: 'Just two of us walking in' },
                    { val: 'small_pod', label: 'Small Pod (3–4)', desc: 'Cozy small circle' },
                    { val: 'larger_group', label: 'Larger Group (5+)', desc: 'Big active group' },
                    { val: 'flexible', label: 'Flexible', desc: 'Open to any size' }
                  ].map((item) => (
                    <button
                      key={item.val}
                      type="button"
                      onClick={() => setQuizGroup(item.val as 'duo' | 'small_pod' | 'larger_group' | 'flexible')}
                      className={`p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                        quizGroup === item.val
                          ? 'bg-accent-soft border-accent font-bold text-ink shadow-2xs'
                          : 'bg-canvas/50 border-line text-ink hover:border-accent/50'
                      }`}
                    >
                      <div className="font-bold">{item.label}</div>
                      <div className="text-[10px] text-muted mt-0.5">{item.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 4. Hobbies */}
              <div>
                <label className="block text-xs font-bold text-ink mb-1.5">
                  4. Hobbies &amp; Interests ({quizHobbies.length} selected)
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'Tech & Coding',
                    'Foodie & Cafes',
                    'Board Games & Trivia',
                    'Gaming & Esports',
                    'Running & Fitness',
                    'Anime & Cinema',
                    'Arts & Crafts',
                    'Music & Concerts',
                    'Sustainability & Nature',
                    'Reading & Writing'
                  ].map((hobby) => {
                    const isSelected = quizHobbies.includes(hobby);
                    return (
                      <button
                        key={hobby}
                        type="button"
                        onClick={() => {
                          setQuizHobbies((prev) =>
                            prev.includes(hobby) ? prev.filter((h) => h !== hobby) : [...prev, hobby]
                          );
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-accent-soft border-accent text-ink font-bold'
                            : 'bg-canvas/50 border-line text-muted hover:text-ink'
                        }`}
                      >
                        {hobby}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-line">
              <button
                type="button"
                onClick={onClose}
                className="text-xs font-medium text-muted hover:text-ink px-3 py-2 cursor-pointer"
              >
                Skip for Now
              </button>
              <button
                type="button"
                onClick={() => {
                  const mappedAnswers = {
                    q1: (quizEnergy === 'extrovert' ? 'A' : 'B') as 'A' | 'B',
                    q2: (quizGroup === 'larger_group' ? 'A' : 'B') as 'A' | 'B',
                    q3: (quizEnv === 'interactive_workshop' ? 'A' : quizEnergy === 'extrovert' ? 'B' : 'C') as 'A' | 'B' | 'C',
                    q4: (quizEnv === 'active_movement' ? 'C' : quizEnv === 'lively_vibrant' ? 'A' : 'B') as 'A' | 'B' | 'C',
                    q5: (quizEnergy === 'extrovert' ? 'A' : 'B') as 'A' | 'B',
                    q6: (quizEnergy === 'introvert' ? 'B' : 'A') as 'A' | 'B',
                    q7: (quizEnergy === 'extrovert' ? 'A' : 'B') as 'A' | 'B',
                    q8: (quizEnv === 'cozy_relaxed' ? 'B' : 'A') as 'A' | 'B'
                  };
                  updatePersonalityQuiz({
                    completed: true,
                    answers: mappedAnswers,
                    preferenceBubbles: [],
                    socialEnergy: quizEnergy,
                    socialEnvironment: quizEnv,
                    hobbies: quizHobbies.length > 0 ? quizHobbies : ['Tech & Coding', 'Foodie & Cafes'],
                    groupSize: quizGroup,
                    experienceTypes: ['Casual Conversations', 'Hands-on Building']
                  });
                  onClose();
                }}
                className="py-2.5 px-6 rounded-xl bg-accent hover:bg-accent-hover text-accent-ink font-bold text-sm flex items-center gap-2 shadow-soft transition-all cursor-pointer"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Save &amp; Start Exploring</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
