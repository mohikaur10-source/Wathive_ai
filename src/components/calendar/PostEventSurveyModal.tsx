import React, { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import {
  BuddyAttendanceAnswer,
  BuddyLikertAnswer,
  BuddySurveySubmission,
  BuddyUseAgainAnswer,
  EventItem
} from '../../types';
import {
  buildSanitizedSurveySubmission,
  canSubmitBuddySurvey,
  getSurveyQuestionVisibility
} from '../../utils/surveyLogic';

interface PostEventSurveyModalProps {
  isOpen: boolean;
  event: EventItem | null;
  hadBuddyPairing: boolean;
  onClose: () => void;
  onDismissNotNow: (eventId: string) => void;
  onSubmit: (submission: BuddySurveySubmission) => void;
}

const Q1_OPTIONS: { value: BuddyAttendanceAnswer; label: string }[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'independent', label: 'No, I attended independently' },
  { value: 'did_not_attend', label: 'I did not attend' }
];

const LIKERT_OPTIONS: { value: BuddyLikertAnswer; label: string }[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'somewhat', label: 'Somewhat' },
  { value: 'no', label: 'No' },
  { value: 'not_applicable', label: 'Not applicable' }
];

const Q4_OPTIONS: { value: BuddyUseAgainAnswer; label: string }[] = [
  { value: 'definitely', label: 'Definitely' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'probably_not', label: 'Probably not' }
];

export const PostEventSurveyModal: React.FC<PostEventSurveyModalProps> = ({
  isOpen,
  event,
  hadBuddyPairing,
  onClose,
  onDismissNotNow,
  onSubmit
}) => {
  const [q1, setQ1] = useState<BuddyAttendanceAnswer | null>(null);
  const [q2, setQ2] = useState<BuddyLikertAnswer | null>(null);
  const [q3, setQ3] = useState<BuddyLikertAnswer | null>(null);
  const [q4, setQ4] = useState<BuddyUseAgainAnswer | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setQ1(null);
    setQ2(null);
    setQ3(null);
    setQ4(null);
    setFeedbackText('');
    setSubmitted(false);
  }, [isOpen, event?.id]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen || !event) return null;

  const { showQ2, showQ3 } = getSurveyQuestionVisibility(hadBuddyPairing, q1);
  const canSubmit = canSubmitBuddySurvey({
    hadBuddyPairing,
    attendedWithBuddy: q1,
    comfortableWithBuddy: q2,
    matchedAppropriately: q3,
    useMatchingAgain: q4
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !q1 || !q4) return;
    const submission = buildSanitizedSurveySubmission({
      eventId: event.id,
      hadBuddyPairing,
      attendedWithBuddy: q1,
      comfortableWithBuddy: q2,
      matchedAppropriately: q3,
      useMatchingAgain: q4,
      feedbackText
    });
    onSubmit(submission);
    setSubmitted(true);
    window.setTimeout(() => {
      onClose();
    }, 1100);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="post-event-survey-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-surface text-ink rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-lift border border-line">
        {submitted ? (
          <div className="py-10 text-center space-y-3">
            <div className="w-11 h-11 rounded-full bg-accent text-accent-ink mx-auto flex items-center justify-center shadow-soft">
              <Check className="w-5 h-5 stroke-[2.6]" />
            </div>
            <h3 id="post-event-survey-title" className="font-display text-lg font-bold text-ink">
              Thank you
            </h3>
            <p className="text-xs text-muted">
              Private. Your buddy won&apos;t see this.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 id="post-event-survey-title" className="font-display text-lg font-bold text-ink">
                  How was your WatHive experience?
                </h3>
                <p className="text-xs text-muted mt-0.5 truncate">{event.title}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close survey"
                className="p-1.5 rounded-xl text-muted hover:text-ink hover:bg-surface-soft cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Q1 */}
            <fieldset className="space-y-2">
              <legend className="text-xs font-semibold text-ink">
                Did you attend the event with your buddy?
              </legend>
              <div className="flex flex-wrap gap-2">
                {Q1_OPTIONS.map((opt) => {
                  const selected = q1 === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => {
                        setQ1(opt.value);
                        if (opt.value !== 'yes') setQ2(null);
                      }}
                      className={`px-3.5 py-2 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${
                        selected
                          ? 'bg-accent text-accent-ink border-accent'
                          : 'bg-canvas text-ink border-line hover:bg-surface-soft'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {/* Q2 (only if had buddy pairing AND answered Yes to Q1) */}
            {showQ2 && (
              <fieldset className="space-y-2">
                <legend className="text-xs font-semibold text-ink">
                  Did you feel comfortable with your buddy?
                </legend>
                <div className="flex flex-wrap gap-2">
                  {LIKERT_OPTIONS.map((opt) => {
                    const selected = q2 === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setQ2(opt.value)}
                        className={`px-3.5 py-2 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${
                          selected
                            ? 'bg-accent text-accent-ink border-accent'
                            : 'bg-canvas text-ink border-line hover:bg-surface-soft'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            )}

            {/* Q3 (only if had buddy pairing) */}
            {showQ3 && (
              <fieldset className="space-y-2">
                <legend className="text-xs font-semibold text-ink">
                  Did you feel the matching system paired you appropriately?
                </legend>
                <div className="flex flex-wrap gap-2">
                  {LIKERT_OPTIONS.map((opt) => {
                    const selected = q3 === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setQ3(opt.value)}
                        className={`px-3.5 py-2 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${
                          selected
                            ? 'bg-accent text-accent-ink border-accent'
                            : 'bg-canvas text-ink border-line hover:bg-surface-soft'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            )}

            {/* Q4 */}
            <fieldset className="space-y-2">
              <legend className="text-xs font-semibold text-ink">
                Would you use buddy matching again?
              </legend>
              <div className="flex flex-wrap gap-2">
                {Q4_OPTIONS.map((opt) => {
                  const selected = q4 === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setQ4(opt.value)}
                      className={`px-3.5 py-2 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${
                        selected
                          ? 'bg-accent text-accent-ink border-accent'
                          : 'bg-canvas text-ink border-line hover:bg-surface-soft'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {/* Q5 */}
            <div className="space-y-1.5">
              <label htmlFor="post-event-feedback-text" className="block text-xs font-semibold text-ink">
                Anything else? (optional)
              </label>
              <textarea
                id="post-event-feedback-text"
                rows={3}
                maxLength={1000}
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value.slice(0, 1000))}
                placeholder="Share any thoughts..."
                className="w-full px-3.5 py-2.5 rounded-2xl border border-line bg-canvas text-ink placeholder:text-muted text-xs focus:outline-none focus:ring-2 focus:ring-accent resize-none"
              />
            </div>

            <div className="flex items-center justify-between gap-3 pt-1 border-t border-line">
              <p className="text-[11px] text-muted">
                Private. Your buddy won&apos;t see this.
              </p>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    onDismissNotNow(event.id);
                    onClose();
                  }}
                  className="px-4 py-2 text-xs font-semibold text-muted hover:text-ink rounded-full cursor-pointer"
                >
                  Not now
                </button>
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="px-5 py-2 rounded-full bg-accent hover:bg-accent-hover disabled:opacity-40 text-accent-ink text-xs font-bold shadow-soft transition-colors cursor-pointer disabled:cursor-not-allowed"
                >
                  Submit
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
