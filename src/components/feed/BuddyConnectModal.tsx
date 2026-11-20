import React, { useState } from 'react';
import { X, Send, Sparkles, Building, GraduationCap, MapPin, Shield, AlertCircle } from 'lucide-react';
import { AttendeeProfile, EventItem } from '../../types';
import { useApp } from '../../context/AppContext';

interface BuddyConnectModalProps {
  isOpen: boolean;
  event: EventItem;
  attendee: AttendeeProfile | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const BuddyConnectModal: React.FC<BuddyConnectModalProps> = ({
  isOpen,
  event,
  attendee,
  onClose,
  onSuccess
}) => {
  const { user, sendConnectionRequest, dailyBuddyRequestsCount, maxDailyRequests } = useApp();
  const [introMessage, setIntroMessage] = useState(
    "Want to meet at the registration desk?"
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !attendee) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    const res = sendConnectionRequest(event.id, attendee.id, introMessage.trim());
    if (res.success) {
      setIsSubmitting(false);
      onSuccess();
      onClose();
    } else {
      setIsSubmitting(false);
      setError(res.message);
    }
  };

  const publicMeetingSuggestions = [
    "Want to meet at the registration desk?",
    "Is this your first time attending?",
    "Want to meet by the entrance 10 minutes before?"
  ];

  const remainingDaily = Math.max(0, maxDailyRequests - dailyBuddyRequestsCount);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-surface text-ink rounded-3xl max-w-md w-full p-6 shadow-lift border border-line relative my-auto animate-in fade-in zoom-in-95 duration-150">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-muted hover:text-ink rounded-full hover:bg-surface-soft transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between pr-8">
              <span className="text-xs font-bold text-accent-text">Event Buddy Request</span>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                remainingDaily > 0 ? 'bg-surface-soft text-muted' : 'bg-danger-soft text-danger'
              }`}>
                {remainingDaily} of {maxDailyRequests} daily requests left
              </span>
            </div>
            <h3 className="text-lg font-bold text-ink mt-0.5">
              Want to go together?
            </h3>
            <p className="text-xs text-muted">
              For <span className="font-semibold text-ink">{event.title}</span>
            </p>
          </div>

          {/* Attendee Profile Preview Card with Compatibility Breakdown */}
          <div className="p-4 bg-surface-soft/50 rounded-2xl border border-line space-y-2.5">
            <div className="flex items-start gap-3">
              <img
                src={attendee.avatar}
                alt={attendee.name}
                referrerPolicy="no-referrer"
                className="w-12 h-12 rounded-full object-cover border-2 border-accent shrink-0"
              />
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h4 className="font-bold text-ink text-sm">{attendee.name}</h4>
                  <span className="text-[10px] bg-accent-soft text-accent-text border border-accent/30 font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1">
                    <Shield className="w-2.5 h-2.5" />
                    Verified @uwaterloo.ca
                  </span>
                </div>
                {(attendee.faculty || attendee.year) && (
                  <div className="text-xs text-muted flex items-center gap-1.5 flex-wrap">
                    {attendee.faculty && (
                      <span>{attendee.faculty} {attendee.program ? `· ${attendee.program}` : ''}</span>
                    )}
                    {attendee.year && (
                      <span className="text-muted">({attendee.year})</span>
                    )}
                  </div>
                )}
                {attendee.bio && (
                  <p className="text-[11px] text-muted italic pt-0.5 line-clamp-2">
                    &ldquo;{attendee.bio}&rdquo;
                  </p>
                )}
              </div>
            </div>

            {/* Compatibility Badge if personality quiz is present */}
            {user?.personalityQuiz && attendee.personalityQuiz && (
              <div className="pt-2 border-t border-line flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 font-bold text-accent-text">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Personality &amp; Interest Match</span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-accent text-accent-ink font-black text-[11px] shadow-2xs">
                  High Compatibility
                </span>
              </div>
            )}
          </div>

          {error && (
            <div className="p-3 bg-danger-soft text-danger text-xs rounded-xl border border-danger/30 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-ink">
                  Optional Short Introduction / Meeting Spot
                </label>
                <span className="text-[10px] text-muted font-medium">Public spots recommended</span>
              </div>
              <textarea
                rows={2}
                value={introMessage}
                onChange={(e) => setIntroMessage(e.target.value)}
                placeholder="Say hello and suggest where to meet..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-line bg-canvas text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent text-xs resize-none"
              />
            </div>

            {/* Encourage public meeting locations with starters */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-muted block">
                Public meeting spot suggestions:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {publicMeetingSuggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => setIntroMessage(suggestion)}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-surface-soft hover:bg-accent-soft text-ink font-medium transition-colors text-left cursor-pointer"
                  >
                    &ldquo;{suggestion}&rdquo;
                  </button>
                ))}
              </div>
            </div>

            {/* Safety reminder */}
            <div className="p-3 bg-surface-soft/50 rounded-xl text-[11px] text-muted space-y-1 border border-line">
              <div className="flex items-center gap-1.5 text-ink font-bold">
                <Shield className="w-3.5 h-3.5 text-accent-text" />
                <span>Safety Reminder</span>
              </div>
              <p>
                &ldquo;You choose what to share. You can leave or block a conversation at any time.&rdquo;
              </p>
              <p className="text-[10px] text-muted">
                Live location is never shared. Always meet at a well-lit public spot like the event entrance or check-in desk.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-xs font-semibold text-muted hover:text-ink rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || remainingDaily <= 0}
                className="px-5 py-2.5 bg-accent hover:bg-accent-hover disabled:opacity-50 text-accent-ink rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-soft transition-all cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Sending...' : 'Want to go together?'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
