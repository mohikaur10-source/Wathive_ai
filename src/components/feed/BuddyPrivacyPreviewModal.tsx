import React, { useState } from 'react';
import {
  X,
  Shield,
  Eye,
  Check,
  Building,
  GraduationCap,
  Sparkles,
  Lock,
  AlertCircle
} from 'lucide-react';
import { EventItem } from '../../types';
import { useApp, BuddyPrivacySettings } from '../../context/AppContext';
import { formatPublicName } from '../../data/mockData';

interface BuddyPrivacyPreviewModalProps {
  isOpen: boolean;
  event: EventItem;
  onClose: () => void;
  onOptInSuccess: () => void;
}

export const BuddyPrivacyPreviewModal: React.FC<BuddyPrivacyPreviewModalProps> = ({
  isOpen,
  event,
  onClose,
  onOptInSuccess
}) => {
  const { user, enableBuddyMatching, eventBuddySettings } = useApp();

  const currentSettings = eventBuddySettings[event.id] || {
    showFaculty: true,
    showYear: true,
    shortIntro: user?.bio || ''
  };

  const [showFaculty, setShowFaculty] = useState<boolean>(currentSettings.showFaculty);
  const [showYear, setShowYear] = useState<boolean>(currentSettings.showYear);
  const [shortIntro, setShortIntro] = useState<string>(currentSettings.shortIntro);

  if (!isOpen || !user) return null;

  const publicName = formatPublicName(user.name);

  const handleConfirmEnable = (e: React.FormEvent) => {
    e.preventDefault();
    const settings: BuddyPrivacySettings = {
      showFaculty,
      showYear,
      shortIntro: shortIntro.trim()
    };
    enableBuddyMatching(event.id, settings);
    onOptInSuccess();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-stone-100 relative my-auto animate-in fade-in zoom-in-95 duration-150">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-700 rounded-full hover:bg-stone-100 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <form onSubmit={handleConfirmEnable} className="space-y-5">
          {/* Header */}
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-850 uppercase tracking-wider mb-1">
              <Shield className="w-3.5 h-3.5 text-amber-600" />
              <span>Personalized Buddy Matching · Privacy Preview</span>
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-stone-950">
              I want to go with someone!
            </h3>
            <p className="text-xs text-stone-600 mt-1 leading-relaxed">
              &ldquo;Other verified Waterloo students looking for a buddy at this event can see this profile and send you a request.&rdquo;
            </p>
          </div>

          {/* Privacy & Verification statement banner */}
          <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200/90 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-amber-950">
                <Lock className="w-4 h-4 text-amber-700 shrink-0" />
                <span>Waterloo Student Privacy & Verification</span>
              </div>
              <span className="text-[10px] bg-amber-400 text-stone-950 font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                <Check className="w-3 h-3 stroke-[3]" />
                Verified @uwaterloo.ca
              </span>
            </div>
            <p className="text-[11px] text-stone-700 leading-normal">
              Your Date of Birth, email address, phone number, home address, live GPS location, and other event schedules are <strong className="text-stone-950 font-bold">never displayed</strong> or shared.
            </p>
            <p className="text-[11px] text-stone-600">
              Compatibility matching compares your social vibe, group preference, and hobbies to find low-pressure companions attending this event.
            </p>
          </div>

          {/* Live Profile Card Preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-stone-800">
              <span>What attendees at &ldquo;{event.title}&rdquo; will see:</span>
              <span className="text-[11px] font-semibold text-amber-800">Live Preview</span>
            </div>

            <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200/90 shadow-2xs flex items-start gap-3.5">
              <img
                src={user.avatar}
                alt={publicName}
                referrerPolicy="no-referrer"
                className="w-12 h-12 rounded-full object-cover border-2 border-amber-400 shrink-0"
              />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h4 className="font-bold text-stone-950 text-sm">{publicName}</h4>
                  <span className="text-[10px] bg-stone-900 text-amber-300 font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1">
                    <Check className="w-2.5 h-2.5 text-amber-400" />
                    Verified Student
                  </span>
                  {user.personalityQuiz && (
                    <span className="text-[10px] bg-amber-100 text-amber-900 font-medium px-1.5 py-0.5 rounded-md flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5 text-amber-600" />
                      Quiz Profile Active
                    </span>
                  )}
                </div>

                {(showFaculty || showYear) && (
                  <div className="text-xs text-stone-600 space-y-0.5">
                    {showFaculty && (
                      <div className="flex items-center gap-1.5 truncate">
                        <Building className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                        <span className="truncate">{user.faculty} · {user.program}</span>
                      </div>
                    )}
                    {showYear && (
                      <div className="flex items-center gap-1.5 text-stone-500">
                        <GraduationCap className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                        <span>{user.year}</span>
                      </div>
                    )}
                  </div>
                )}

                {shortIntro ? (
                  <p className="text-[11px] text-stone-700 italic pt-1 line-clamp-2">
                    &ldquo;{shortIntro}&rdquo;
                  </p>
                ) : (
                  <p className="text-[11px] text-stone-400 italic pt-1">
                    No custom intro provided.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Privacy Customization Controls */}
          <div className="space-y-3 pt-1 border-t border-stone-100">
            <span className="text-xs font-bold text-stone-900 block">
              Customize What You Share for This Event
            </span>

            <div className="space-y-2">
              <label className="flex items-center justify-between p-3 rounded-xl border border-stone-200 hover:bg-stone-50 cursor-pointer transition-colors text-xs">
                <div>
                  <span className="font-semibold text-stone-900 block">Show Faculty & Program</span>
                  <span className="text-[11px] text-stone-500">{user.faculty} · {user.program}</span>
                </div>
                <input
                  type="checkbox"
                  checked={showFaculty}
                  onChange={(e) => setShowFaculty(e.target.checked)}
                  className="w-4 h-4 accent-amber-500 rounded text-amber-500 focus:ring-amber-500"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl border border-stone-200 hover:bg-stone-50 cursor-pointer transition-colors text-xs">
                <div>
                  <span className="font-semibold text-stone-900 block">Show Year of Study</span>
                  <span className="text-[11px] text-stone-500">{user.year}</span>
                </div>
                <input
                  type="checkbox"
                  checked={showYear}
                  onChange={(e) => setShowYear(e.target.checked)}
                  className="w-4 h-4 accent-amber-500 rounded text-amber-500 focus:ring-amber-500"
                />
              </label>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Optional Short Introduction (Specific to this event)
              </label>
              <textarea
                rows={2}
                value={shortIntro}
                onChange={(e) => setShortIntro(e.target.value)}
                maxLength={140}
                placeholder="e.g., Looking for someone to sit with or walk in together! Feel free to say hi."
                className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500 text-stone-900 resize-none"
              />
              <span className="text-[10px] text-stone-400 block text-right">
                {shortIntro.length}/140
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-stone-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-semibold text-stone-600 hover:text-stone-900 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-stone-950 hover:bg-black text-amber-300 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all border border-stone-800"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Enable &ldquo;I want to go with someone!&rdquo;</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
