import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Check,
  Compass,
  Users,
  Coffee,
  Heart,
  ArrowRight,
  ArrowLeft,
  Sliders,
  Shield
} from 'lucide-react';
import {
  PersonalityQuizProfile,
  SocialEnergy,
  SocialEnvironment,
  GroupSizePreference
} from '../../types';
import {
  SOCIAL_ENERGY_OPTIONS,
  SOCIAL_ENVIRONMENT_OPTIONS,
  GROUP_SIZE_OPTIONS,
  AVAILABLE_HOBBIES,
  AVAILABLE_EXPERIENCE_TYPES
} from '../../utils/compatibilityEngine';
import { useApp } from '../../context/AppContext';

interface PersonalityQuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const PersonalityQuizModal: React.FC<PersonalityQuizModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const { user, updatePersonalityQuiz } = useApp();

  const currentQuiz = user?.personalityQuiz || {
    completed: false,
    socialEnergy: 'ambivert',
    socialEnvironment: 'cozy_relaxed',
    hobbies: ['Tech & Coding', 'Foodie & Cafes', 'Board Games & Trivia'],
    groupSize: 'duo',
    experienceTypes: ['Casual Conversations', 'Hands-on Building']
  };

  const [quizStep, setQuizStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [socialEnergy, setSocialEnergy] = useState<SocialEnergy>(currentQuiz.socialEnergy);
  const [socialEnvironment, setSocialEnvironment] = useState<SocialEnvironment>(currentQuiz.socialEnvironment);
  const [hobbies, setHobbies] = useState<string[]>(currentQuiz.hobbies);
  const [groupSize, setGroupSize] = useState<GroupSizePreference>(currentQuiz.groupSize);
  const [experienceTypes, setExperienceTypes] = useState<string[]>(currentQuiz.experienceTypes);
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const toggleHobby = (hobby: string) => {
    setHobbies((prev) =>
      prev.includes(hobby) ? prev.filter((h) => h !== hobby) : [...prev, hobby]
    );
  };

  const toggleExperienceType = (exp: string) => {
    setExperienceTypes((prev) =>
      prev.includes(exp) ? prev.filter((e) => e !== exp) : [...prev, exp]
    );
  };

  const handleFinishQuiz = () => {
    const completedQuiz: PersonalityQuizProfile = {
      completed: true,
      socialEnergy,
      socialEnvironment,
      hobbies: hobbies.length > 0 ? hobbies : ['Tech & Coding', 'Foodie & Cafes'],
      groupSize,
      experienceTypes: experienceTypes.length > 0 ? experienceTypes : ['Casual Conversations']
    };

    updatePersonalityQuiz(completedQuiz);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onSuccess?.();
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-stone-100 relative my-auto animate-in fade-in zoom-in-95 duration-150">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-stone-400 hover:text-stone-700 rounded-full hover:bg-stone-100 transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {savedSuccess ? (
          <div className="py-10 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-amber-400 text-stone-950 flex items-center justify-center mx-auto shadow-md">
              <Check className="w-8 h-8 stroke-[3]" />
            </div>
            <h3 className="text-xl font-bold text-stone-950">
              Compatibility Profile Updated!
            </h3>
            <p className="text-xs text-stone-600 max-w-sm mx-auto leading-relaxed">
              Your personality and interest quiz answers have been saved. When browsing event attendees, you&apos;ll see transparent match scores and mutual compatibility reasons.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Header and Step Indicator */}
            <div>
              <div className="flex items-center justify-between text-xs font-bold text-amber-800 uppercase tracking-wider mb-1">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>Personality & Interest Quiz</span>
                </span>
                <span className="text-stone-500 font-semibold normal-case">
                  Step {quizStep} of 5
                </span>
              </div>
              <h3 className="text-xl font-bold text-stone-950">
                {quizStep === 1 && 'Social Energy & Introversion'}
                {quizStep === 2 && 'Preferred Social Atmosphere'}
                {quizStep === 3 && 'Shared Hobbies & Passions'}
                {quizStep === 4 && 'Comfortable Group Dynamics'}
                {quizStep === 5 && 'Types of Shared Experiences'}
              </h3>
              <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                {quizStep === 1 && 'How do you prefer to experience social gatherings and recharge?'}
                {quizStep === 2 && 'What kind of campus settings make you feel most comfortable?'}
                {quizStep === 3 && 'Pick the topics, activities, and hobbies you get most excited about.'}
                {quizStep === 4 && 'How large of a group do you feel most comfortable walking in with?'}
                {quizStep === 5 && 'What kind of event activities do you hope to share with your buddy?'}
              </p>

              {/* Progress bar */}
              <div className="w-full bg-stone-100 rounded-full h-1.5 mt-3 overflow-hidden">
                <div
                  className="bg-amber-400 h-1.5 transition-all duration-300 rounded-full"
                  style={{ width: `${(quizStep / 5) * 100}%` }}
                />
              </div>
            </div>

            {/* STEP 1: Social Energy */}
            {quizStep === 1 && (
              <div className="space-y-3">
                {SOCIAL_ENERGY_OPTIONS.map((opt) => {
                  const isSelected = socialEnergy === opt.value;
                  return (
                    <div
                      key={opt.value}
                      onClick={() => setSocialEnergy(opt.value)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start gap-3.5 ${
                        isSelected
                          ? 'bg-amber-500/10 border-amber-400 shadow-2xs'
                          : 'bg-white border-stone-200 hover:border-stone-300'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                          isSelected
                            ? 'border-amber-500 bg-amber-400 text-stone-950'
                            : 'border-stone-300 bg-white'
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <h4 className="font-bold text-sm text-stone-950">{opt.title}</h4>
                        <p className="text-xs text-stone-600 leading-relaxed">{opt.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* STEP 2: Social Environment */}
            {quizStep === 2 && (
              <div className="space-y-3">
                {SOCIAL_ENVIRONMENT_OPTIONS.map((opt) => {
                  const isSelected = socialEnvironment === opt.value;
                  return (
                    <div
                      key={opt.value}
                      onClick={() => setSocialEnvironment(opt.value)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start gap-3.5 ${
                        isSelected
                          ? 'bg-amber-500/10 border-amber-400 shadow-2xs'
                          : 'bg-white border-stone-200 hover:border-stone-300'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                          isSelected
                            ? 'border-amber-500 bg-amber-400 text-stone-950'
                            : 'border-stone-300 bg-white'
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <h4 className="font-bold text-sm text-stone-950">{opt.title}</h4>
                        <p className="text-xs text-stone-600 leading-relaxed">{opt.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* STEP 3: Hobbies & Passions (Multi-select) */}
            {quizStep === 3 && (
              <div className="space-y-3">
                <span className="text-xs font-semibold text-stone-700 block">
                  Select all that resonate with you ({hobbies.length} selected):
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[46vh] overflow-y-auto pr-1">
                  {AVAILABLE_HOBBIES.map((hobby) => {
                    const isSelected = hobbies.includes(hobby);
                    return (
                      <button
                        key={hobby}
                        type="button"
                        onClick={() => toggleHobby(hobby)}
                        className={`p-3 rounded-xl border text-xs font-semibold text-left transition-all flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? 'bg-amber-400/20 border-amber-400 text-stone-950 font-bold shadow-2xs'
                            : 'bg-white border-stone-200 text-stone-700 hover:border-stone-300'
                        }`}
                      >
                        <span className="truncate pr-1">{hobby}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-amber-700 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* STEP 4: Preferred Group Sizes */}
            {quizStep === 4 && (
              <div className="space-y-3">
                {GROUP_SIZE_OPTIONS.map((opt) => {
                  const isSelected = groupSize === opt.value;
                  return (
                    <div
                      key={opt.value}
                      onClick={() => setGroupSize(opt.value)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start gap-3.5 ${
                        isSelected
                          ? 'bg-amber-500/10 border-amber-400 shadow-2xs'
                          : 'bg-white border-stone-200 hover:border-stone-300'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                          isSelected
                            ? 'border-amber-500 bg-amber-400 text-stone-950'
                            : 'border-stone-300 bg-white'
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <h4 className="font-bold text-sm text-stone-950">{opt.title}</h4>
                        <p className="text-xs text-stone-600 leading-relaxed">{opt.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* STEP 5: Experience Types (Multi-select) */}
            {quizStep === 5 && (
              <div className="space-y-3">
                <span className="text-xs font-semibold text-stone-700 block">
                  Select your preferred experience styles ({experienceTypes.length} selected):
                </span>
                <div className="grid grid-cols-2 gap-2 max-h-[46vh] overflow-y-auto pr-1">
                  {AVAILABLE_EXPERIENCE_TYPES.map((exp) => {
                    const isSelected = experienceTypes.includes(exp);
                    return (
                      <button
                        key={exp}
                        type="button"
                        onClick={() => toggleExperienceType(exp)}
                        className={`p-3 rounded-xl border text-xs font-semibold text-left transition-all flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? 'bg-amber-400/20 border-amber-400 text-stone-950 font-bold shadow-2xs'
                            : 'bg-white border-stone-200 text-stone-700 hover:border-stone-300'
                        }`}
                      >
                        <span className="truncate pr-1">{exp}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-amber-700 shrink-0" />}
                      </button>
                    );
                  })}
                </div>

                <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-[11px] text-stone-600 space-y-1">
                  <span className="font-bold text-stone-900 flex items-center gap-1">
                    <Shield className="w-3.5 h-3.5 text-amber-600" />
                    <span>Transparent Matching Engine</span>
                  </span>
                  <p>
                    These preferences are used to compute compatibility percentages and display common grounds. You can update this quiz anytime from your Profile.
                  </p>
                </div>
              </div>
            )}

            {/* Navigational Buttons */}
            <div className="flex items-center justify-between pt-3 border-t border-stone-100">
              {quizStep > 1 ? (
                <button
                  type="button"
                  onClick={() => setQuizStep((prev) => (prev - 1) as 1 | 2 | 3 | 4 | 5)}
                  className="px-4 py-2.5 rounded-xl border border-stone-200 text-stone-700 text-xs font-bold flex items-center gap-1.5 hover:bg-stone-50 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 text-stone-500 hover:text-stone-800 text-xs font-semibold cursor-pointer"
                >
                  Skip for Now
                </button>
              )}

              {quizStep < 5 ? (
                <button
                  type="button"
                  onClick={() => setQuizStep((prev) => (prev + 1) as 1 | 2 | 3 | 4 | 5)}
                  className="px-5 py-2.5 rounded-xl bg-stone-950 hover:bg-black text-amber-300 text-xs font-bold flex items-center gap-1.5 shadow-sm border border-stone-800 cursor-pointer"
                >
                  <span>Next Question</span>
                  <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleFinishQuiz}
                  className="px-6 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-stone-950 text-xs font-black flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Save Quiz & Finish</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
