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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-stone-100 relative my-auto animate-in fade-in zoom-in-95 duration-150">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-700 rounded-full hover:bg-stone-100 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-800">Event Buddy Request</span>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                remainingDaily > 0 ? 'bg-stone-100 text-stone-700' : 'bg-red-100 text-red-800'
              }`}>
                {remainingDaily} of {maxDailyRequests} daily requests left
              </span>
            </div>
            <h3 className="text-lg font-bold text-stone-950 mt-0.5">
              Want to go together?
            </h3>
            <p className="text-xs text-stone-600">
              For <span className="font-semibold text-stone-900">{event.title}</span>
            </p>
          </div>

          {/* Attendee Profile Preview Card with Compatibility Breakdown */}
          <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200/90 space-y-2.5">
            <div className="flex items-start gap-3">
              <img
                src={attendee.avatar}
                alt={attendee.name}
                referrerPolicy="no-referrer"
                className="w-12 h-12 rounded-full object-cover border-2 border-amber-400 shrink-0"
              />
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h4 className="font-bold text-stone-950 text-sm">{attendee.name}</h4>
                  <span className="text-[10px] bg-stone-950 text-amber-300 font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1">
                    <Shield className="w-2.5 h-2.5 text-amber-400" />
                    Verified @uwaterloo.ca
                  </span>
                </div>
                {(attendee.faculty || attendee.year) && (
                  <div className="text-xs text-stone-600 flex items-center gap-1.5 flex-wrap">
                    {attendee.faculty && (
                      <span>{attendee.faculty} {attendee.program ? `· ${attendee.program}` : ''}</span>
                    )}
                    {attendee.year && (
                      <span className="text-stone-400">({attendee.year})</span>
                    )}
                  </div>
                )}
                {attendee.bio && (
                  <p className="text-[11px] text-stone-600 italic pt-0.5 line-clamp-2">
                    &ldquo;{attendee.bio}&rdquo;
                  </p>
                )}
              </div>
            </div>

            {/* Compatibility Badge if personality quiz is present */}
            {user?.personalityQuiz && attendee.personalityQuiz && (
              <div className="pt-2 border-t border-stone-200 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 font-bold text-amber-900">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>Personality & Interest Match</span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-amber-400 text-stone-950 font-black text-[11px] shadow-2xs">
                  High Compatibility
                </span>
              </div>
            )}
          </div>

          {error && (
            <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-stone-700">
                  Optional Short Introduction / Meeting Spot
                </label>
                <span className="text-[10px] text-stone-500 font-medium">Public spots recommended</span>
              </div>
              <textarea
                rows={2}
                value={introMessage}
                onChange={(e) => setIntroMessage(e.target.value)}
                placeholder="Say hello and suggest where to meet..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500 text-xs text-stone-900 resize-none"
              />
            </div>

            {/* Requirement 6: Encourage public meeting locations with starters */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-stone-600 block">
                Public meeting spot suggestions:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {publicMeetingSuggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => setIntroMessage(suggestion)}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-amber-100 hover:text-stone-950 text-stone-700 font-medium transition-colors text-left"
                  >
                    &ldquo;{suggestion}&rdquo;
                  </button>
                ))}
              </div>
            </div>

            {/* Requirement 6: Safety reminder */}
            <div className="p-3 bg-stone-50 rounded-xl text-[11px] text-stone-600 space-y-1 border border-stone-200/60">
              <div className="flex items-center gap-1.5 text-stone-900 font-bold">
                <Shield className="w-3.5 h-3.5 text-amber-600" />
                <span>Safety Reminder</span>
              </div>
              <p>
                &ldquo;You choose what to share. You can leave or block a conversation at any time.&rdquo;
              </p>
              <p className="text-[10px] text-stone-500">
                Live location is never shared. Always meet at a well-lit public spot like the event entrance or check-in desk.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-xs font-semibold text-stone-600 hover:text-stone-900 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || remainingDaily <= 0}
                className="px-5 py-2.5 bg-stone-950 hover:bg-black disabled:opacity-50 text-amber-300 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all border border-stone-800"
              >
                <Send className="w-3.5 h-3.5 text-amber-400" />
                <span>{isSubmitting ? 'Sending...' : 'Want to go together?'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
