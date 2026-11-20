import React, { useEffect, useState } from 'react';
import { X, Sparkles, ArrowLeft, Check } from 'lucide-react';
import {
  BuddyPreferenceTag,
  BuddyQuizAnswers,
  PersonalityQuizProfile
} from '../../types';
import {
  BUDDY_QUIZ_QUESTIONS,
  BUDDY_PREFERENCE_BUBBLES,
  computeBuddyArchetype,
  QuizQuestionKey
} from '../../utils/compatibilityEngine';
import { useApp } from '../../context/AppContext';

interface PersonalityQuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onNavigateToBuddyHub?: () => void;
}

export const PersonalityQuizModal: React.FC<PersonalityQuizModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onNavigateToBuddyHub
}) => {
  const { user, completeQuizAndPopulateMatches } = useApp();

  const totalQuestions = BUDDY_QUIZ_QUESTIONS.length; // 8
  // step 0..7 = Q1..Q8, step 8 = Preferences & Dealbreakers screen
  const [stepIndex, setStepIndex] = useState<number>(0);
  const [answers, setAnswers] = useState<Partial<BuddyQuizAnswers>>(
    () => user?.personalityQuiz?.answers || {}
  );
  const [selectedPrefs, setSelectedPrefs] = useState<BuddyPreferenceTag[]>(
    () => user?.personalityQuiz?.preferenceBubbles || []
  );
  const [justTappedKey, setJustTappedKey] = useState<string | null>(null);

  // Reset to Question 1 cleanly whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setStepIndex(0);
      setAnswers(user?.personalityQuiz?.answers || {});
      setSelectedPrefs(user?.personalityQuiz?.preferenceBubbles || []);
      setJustTappedKey(null);
    }
  }, [isOpen, user?.personalityQuiz]);

  if (!isOpen) return null;

  const isPreferencesScreen = stepIndex >= totalQuestions;
  const currentQuestion = !isPreferencesScreen ? BUDDY_QUIZ_QUESTIONS[stepIndex] : null;
  const progressPercent = isPreferencesScreen
    ? 100
    : ((stepIndex + 1) / totalQuestions) * 100;

  const handleSelectOption = (questionId: QuizQuestionKey, optionKey: 'A' | 'B' | 'C') => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: optionKey
    }));
    setJustTappedKey(optionKey);

    // Brief visual tap feedback then instant auto-advance
    window.setTimeout(() => {
      setJustTappedKey(null);
      setStepIndex((prev) => Math.min(prev + 1, totalQuestions));
    }, 160);
  };

  const togglePreferenceBubble = (tag: BuddyPreferenceTag) => {
    setSelectedPrefs((prev) =>
      prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]
    );
  };

  const handleSaveAndFindBuddies = () => {
    const finalizedAnswers: BuddyQuizAnswers = {
      q1: (answers.q1 as 'A' | 'B') || 'B',
      q2: (answers.q2 as 'A' | 'B') || 'B',
      q3: (answers.q3 as 'A' | 'B' | 'C') || 'C',
      q4: (answers.q4 as 'A' | 'B' | 'C') || 'A',
      q5: (answers.q5 as 'A' | 'B') || 'B',
      q6: (answers.q6 as 'A' | 'B') || 'B',
      q7: (answers.q7 as 'A' | 'B') || 'B',
      q8: (answers.q8 as 'A' | 'B') || 'B'
    };

    const archetype = computeBuddyArchetype(finalizedAnswers);
    const completedProfile: PersonalityQuizProfile = {
      completed: true,
      answers: finalizedAnswers,
      preferenceBubbles: selectedPrefs,
      archetype,
      updatedAt: new Date().toISOString()
    };

    completeQuizAndPopulateMatches(completedProfile);
    onSuccess?.();
    onClose();
    onNavigateToBuddyHub?.();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Buddy Vibe Personality Quiz"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-surface text-ink rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-lift border border-line relative my-auto">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-muted hover:text-ink rounded-full hover:bg-surface-soft transition-colors cursor-pointer"
          aria-label="Close quiz"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="space-y-6">
          {/* Sleek Top Progress Bar & Step Counter */}
          <div className="space-y-2.5 pr-8">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="flex items-center gap-1.5 text-accent-text uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Buddy Vibe Quiz</span>
              </span>
              <span className="text-muted font-semibold tabular-nums">
                {isPreferencesScreen ? 'Final Step' : `${stepIndex + 1} / ${totalQuestions}`}
              </span>
            </div>

            <div className="w-full bg-surface-soft rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-accent h-1.5 transition-all duration-200 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Question Screens (1–8) */}
          {currentQuestion && (
            <div className="space-y-5">
              <h3 className="font-display text-xl sm:text-2xl font-bold text-ink leading-snug">
                {currentQuestion.question}
              </h3>

              <div className="space-y-3">
                {currentQuestion.options.map((opt) => {
                  const isCurrentChoice =
                    justTappedKey === opt.key ||
                    (justTappedKey === null && answers[currentQuestion.id] === opt.key);

                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => handleSelectOption(currentQuestion.id, opt.key)}
                      className={`w-full p-4 sm:p-5 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-4 group active:scale-[0.99] ${
                        isCurrentChoice
                          ? 'bg-accent-soft border-accent shadow-soft'
                          : 'bg-canvas/70 border-line hover:border-accent/70 hover:bg-surface-soft/60'
                      }`}
                    >
                      <span
                        className={`w-9 h-9 rounded-xl font-display font-bold text-sm flex items-center justify-center shrink-0 transition-colors ${
                          isCurrentChoice
                            ? 'bg-accent text-accent-ink'
                            : 'bg-surface border border-line text-muted group-hover:text-ink'
                        }`}
                      >
                        {opt.key}
                      </span>

                      <div className="flex-1 min-w-0 flex items-center justify-between gap-3">
                        <span className="text-sm sm:text-base font-semibold text-ink leading-snug">
                          {opt.label}
                        </span>
                        <span className="text-xl shrink-0" aria-hidden="true">
                          {opt.emoji}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Minimal Back / Helper Row */}
              <div className="flex items-center justify-between pt-2 border-t border-line">
                {stepIndex > 0 ? (
                  <button
                    type="button"
                    onClick={() => setStepIndex((prev) => Math.max(0, prev - 1))}
                    className="px-3 py-2 rounded-xl text-xs font-semibold text-muted hover:text-ink hover:bg-surface-soft flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back</span>
                  </button>
                ) : (
                  <span className="text-[11px] text-muted">Tap a card to advance</span>
                )}

                <button
                  type="button"
                  onClick={onClose}
                  className="text-xs font-medium text-muted hover:text-ink px-2 py-1 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Final Screen: Preferences & Dealbreakers (Bubble Tags) */}
          {isPreferencesScreen && (
            <div className="space-y-5">
              <div className="space-y-1">
                <h3 className="font-display text-xl sm:text-2xl font-bold text-ink leading-snug">
                  Any preferences for your buddy?
                </h3>
                <p className="text-xs sm:text-sm text-muted leading-relaxed">
                  Tap as many as you want—or skip if you&apos;re open to anyone.
                </p>
              </div>

              {/* Clean rounded rectangular container with multi-select interactive pill/bubble tags */}
              <div className="p-4 sm:p-5 rounded-2xl bg-canvas border border-line">
                <div className="flex flex-wrap gap-2">
                  {BUDDY_PREFERENCE_BUBBLES.map((tag) => {
                    const isSelected = selectedPrefs.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => togglePreferenceBubble(tag)}
                        className={`px-3.5 py-2 rounded-full text-xs font-semibold border transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-accent border-accent text-accent-ink shadow-soft'
                            : 'bg-surface border-line text-ink hover:border-accent/60 hover:bg-surface-soft/60'
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[2.8] shrink-0" />}
                        <span>{tag}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-2 border-t border-line">
                <button
                  type="button"
                  onClick={() => setStepIndex(totalQuestions - 1)}
                  className="px-3.5 py-2.5 rounded-xl border border-line text-ink text-xs font-semibold flex items-center gap-1.5 hover:bg-surface-soft transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveAndFindBuddies}
                  className="flex-1 sm:flex-initial px-6 py-2.5 rounded-2xl bg-accent hover:bg-accent-hover text-accent-ink text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-soft transition-colors cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Save &amp; Find Buddies</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
