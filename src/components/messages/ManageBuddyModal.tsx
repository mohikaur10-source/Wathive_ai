import React, { useEffect, useState } from 'react';
import { Check, ChevronRight, X } from 'lucide-react';
import { BuddyManageAction, Conversation } from '../../types';
import { EventLifecycleShape } from '../../utils/eventLifecycle';
import {
  derivePairingLifecycleState,
  getAllowedManageActions,
  shouldShowLastMinuteReminder
} from '../../utils/pairingLifecycle';
import { getPairingDisplayState } from '../../utils/pairingLogic';
import { getFirstName } from '../../utils/buddySeeding';

interface ManageBuddyModalProps {
  isOpen: boolean;
  conversation: Conversation | null;
  event: EventLifecycleShape | null;
  nowMs: number;
  onClose: () => void;
  onConfirmBuddy: () => void;
  onConfirmRematch: () => void;
  onConfirmNoLongerNeed: () => void;
  onConfirmUnableToAttend: () => void;
  onOpenReport: () => void;
}

type ActiveConfirmationStep =
  | { type: 'menu' }
  | { type: 'last_minute'; nextAction: 'find_another' | 'no_longer_need' | 'unable_to_attend' }
  | { type: 'find_another' }
  | { type: 'no_longer_need' }
  | { type: 'unable_to_attend' };

const ACTION_ROW_COPY: Record<
  Exclude<BuddyManageAction, 'block_or_report'>,
  { title: string; subtitle: string }
> = {
  confirm_buddy: {
    title: 'Confirm my buddy',
    subtitle: "I'm comfortable attending with this person."
  },
  find_another: {
    title: 'Find me another buddy',
    subtitle: "I'd prefer to attend with someone else."
  },
  no_longer_need: {
    title: "I don't need a buddy anymore",
    subtitle: "I'm still attending the event."
  },
  unable_to_attend: {
    title: 'I can no longer attend this event',
    subtitle: 'Cancel my event attendance and buddy pairing.'
  }
};

export const ManageBuddyModal: React.FC<ManageBuddyModalProps> = ({
  isOpen,
  conversation,
  event,
  nowMs,
  onClose,
  onConfirmBuddy,
  onConfirmRematch,
  onConfirmNoLongerNeed,
  onConfirmUnableToAttend,
  onOpenReport
}) => {
  const [step, setStep] = useState<ActiveConfirmationStep>({ type: 'menu' });

  useEffect(() => {
    if (isOpen) {
      setStep({ type: 'menu' });
    }
  }, [isOpen, conversation?.id]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen || !conversation) return null;

  const firstName = getFirstName(conversation.partner?.name);
  const pairingState = getPairingDisplayState(conversation);
  const lifecycleState = derivePairingLifecycleState({
    isBuddyMatchingActive: true,
    conversation
  });
  const allowedActions = getAllowedManageActions(lifecycleState, pairingState.userConfirmed);
  const menuActions = allowedActions.filter(
    (action): action is Exclude<BuddyManageAction, 'block_or_report'> =>
      action !== 'block_or_report'
  );
  const canBlockOrReport = allowedActions.includes('block_or_report');

  const eventShape: EventLifecycleShape = event || { date: conversation.eventDate };
  const needsLastMinuteReminder = (() => {
    try {
      return shouldShowLastMinuteReminder({
        conversation,
        event: eventShape,
        nowMs
      });
    } catch {
      return false;
    }
  })();

  const handleSelectAction = (action: Exclude<BuddyManageAction, 'block_or_report'>) => {
    if (action === 'confirm_buddy') {
      onConfirmBuddy();
      onClose();
      return;
    }

    if (needsLastMinuteReminder) {
      setStep({ type: 'last_minute', nextAction: action });
      return;
    }

    setStep({ type: action });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="manage-buddy-dialog-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-surface text-ink rounded-3xl max-w-md w-full p-6 shadow-lift border border-line space-y-4">
        {step.type === 'menu' && (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3
                  id="manage-buddy-dialog-title"
                  className="font-display font-bold text-ink text-lg leading-snug"
                >
                  Manage buddy pairing
                </h3>
                <p className="text-xs text-muted mt-0.5 truncate">
                  {firstName} · {conversation.eventTitle}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close manage buddy modal"
                className="p-1.5 rounded-xl text-muted hover:text-ink hover:bg-surface-soft transition-colors cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              {menuActions.map((action) => {
                const copy = ACTION_ROW_COPY[action];
                return (
                  <button
                    key={action}
                    type="button"
                    onClick={() => handleSelectAction(action)}
                    className="w-full text-left px-4 py-3 rounded-2xl border border-line bg-canvas/70 hover:bg-surface-soft transition-colors flex items-center justify-between gap-3 cursor-pointer"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink">{copy.title}</p>
                      <p className="text-xs text-muted mt-0.5">{copy.subtitle}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted shrink-0" />
                  </button>
                );
              })}
            </div>

            {canBlockOrReport && (
              <div className="pt-1 text-center">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenReport();
                  }}
                  className="text-xs font-medium text-danger hover:underline cursor-pointer"
                >
                  Block or report a concern
                </button>
              </div>
            )}
          </>
        )}

        {step.type === 'last_minute' && (
          <>
            <div className="flex items-start justify-between gap-3">
              <h3
                id="manage-buddy-dialog-title"
                className="font-display font-bold text-ink text-lg leading-snug"
              >
                Your event is approaching!
              </h3>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="p-1.5 rounded-xl text-muted hover:text-ink hover:bg-surface-soft transition-colors cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-sm text-ink/90 leading-relaxed">
              <p>
                Your buddy may be relying on you to attend together. If you cancel, we&apos;ll try
                our best to find them another buddy. However, due to the limited time remaining, a
                replacement may not be available.
              </p>
              <p className="text-xs text-muted">We understand that plans can change.</p>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStep({ type: step.nextAction })}
                className="px-4 py-2.5 rounded-full text-xs font-semibold text-muted hover:text-ink hover:bg-surface-soft transition-colors cursor-pointer"
              >
                Continue with cancellation
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-full bg-accent hover:bg-accent-hover text-accent-ink text-xs font-semibold shadow-soft transition-colors cursor-pointer"
              >
                Keep my buddy
              </button>
            </div>
          </>
        )}

        {step.type === 'find_another' && (
          <>
            <div className="flex items-start justify-between gap-3">
              <h3
                id="manage-buddy-dialog-title"
                className="font-display font-bold text-ink text-lg leading-snug"
              >
                Find another buddy?
              </h3>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="p-1.5 rounded-xl text-muted hover:text-ink hover:bg-surface-soft transition-colors cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-sm text-ink/90 leading-relaxed">
              <p>
                Your current pairing will end, and your conversation will close. We&apos;ll search
                for another available buddy.
              </p>
              <p className="text-xs text-muted">A replacement buddy is not guaranteed.</p>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-full text-xs font-semibold text-muted hover:text-ink hover:bg-surface-soft transition-colors cursor-pointer"
              >
                Keep my current buddy
              </button>
              <button
                type="button"
                onClick={() => {
                  onConfirmRematch();
                  onClose();
                }}
                className="px-5 py-2.5 rounded-full bg-accent hover:bg-accent-hover text-accent-ink text-xs font-semibold shadow-soft transition-colors cursor-pointer"
              >
                Confirm rematch
              </button>
            </div>
          </>
        )}

        {step.type === 'no_longer_need' && (
          <>
            <div className="flex items-start justify-between gap-3">
              <h3
                id="manage-buddy-dialog-title"
                className="font-display font-bold text-ink text-lg leading-snug"
              >
                No longer need a buddy?
              </h3>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="p-1.5 rounded-xl text-muted hover:text-ink hover:bg-surface-soft transition-colors cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-sm text-ink/90 leading-relaxed">
              <p>We&apos;ll remove you from buddy matching and close your current conversation.</p>
              <p className="flex items-center gap-1.5 text-xs font-medium text-ink">
                <Check className="w-3.5 h-3.5 text-accent-text stroke-[2.5] shrink-0" />
                <span>Your event RSVP will remain active.</span>
              </p>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-full text-xs font-semibold text-muted hover:text-ink hover:bg-surface-soft transition-colors cursor-pointer"
              >
                Keep my buddy
              </button>
              <button
                type="button"
                onClick={() => {
                  onConfirmNoLongerNeed();
                  onClose();
                }}
                className="px-5 py-2.5 rounded-full bg-accent hover:bg-accent-hover text-accent-ink text-xs font-semibold shadow-soft transition-colors cursor-pointer"
              >
                Leave buddy matching
              </button>
            </div>
          </>
        )}

        {step.type === 'unable_to_attend' && (
          <>
            <div className="flex items-start justify-between gap-3">
              <h3
                id="manage-buddy-dialog-title"
                className="font-display font-bold text-ink text-lg leading-snug"
              >
                Unable to attend?
              </h3>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="p-1.5 rounded-xl text-muted hover:text-ink hover:bg-surface-soft transition-colors cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-sm text-ink/90 leading-relaxed">
              Cancelling your attendance will also cancel your buddy pairing. Your buddy will be
              notified, and we&apos;ll do our best to find them another student to attend with.
            </p>

            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  onConfirmUnableToAttend();
                  onClose();
                }}
                className="px-4 py-2.5 rounded-full text-xs font-semibold text-danger hover:bg-danger-soft transition-colors cursor-pointer"
              >
                Cancel my event RSVP
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-full bg-accent hover:bg-accent-hover text-accent-ink text-xs font-semibold shadow-soft transition-colors cursor-pointer"
              >
                Keep my RSVP
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
