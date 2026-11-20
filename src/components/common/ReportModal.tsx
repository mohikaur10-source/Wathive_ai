import React, { useState } from 'react';
import { X, ShieldAlert, Ban, Flag, Check, AlertTriangle } from 'lucide-react';
import { AttendeeProfile, EventItem } from '../../types';
import { useApp } from '../../context/AppContext';

interface ReportModalProps {
  isOpen: boolean;
  targetType: 'user' | 'event';
  attendee?: AttendeeProfile | null;
  event?: EventItem | null;
  onClose: () => void;
  onSuccess: (action: 'block' | 'report') => void;
}

const REPORT_REASONS = [
  'Harassment or unwanted contact',
  'Fake profile or impersonation',
  'Inappropriate content',
  'Suspicious event or unsafe meeting request',
  'Other'
];

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  targetType,
  attendee,
  event,
  onClose,
  onSuccess
}) => {
  const { blockUser, reportItem } = useApp();
  const [reportReason, setReportReason] = useState(REPORT_REASONS[0]);
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [actionType, setActionType] = useState<'block' | 'report'>(
    targetType === 'event' ? 'report' : 'report'
  );
  const [submitted, setSubmitted] = useState(false);

  React.useEffect(() => {
    if (!isOpen) {
      setSubmitted(false);
      setAdditionalNotes('');
      setActionType('report');
      setReportReason(REPORT_REASONS[0]);
    }
  }, [isOpen]);

  if (!isOpen) return null;
  if (targetType === 'user' && !attendee) return null;
  if (targetType === 'event' && !event) return null;

  const targetName = targetType === 'user' ? attendee!.name : event!.title;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (actionType === 'block' && targetType === 'user') {
      blockUser(attendee!.id);
      onSuccess('block');
    } else {
      const id = targetType === 'user' ? attendee!.id : event!.id;
      reportItem(targetType, id, targetName, reportReason, additionalNotes);
      onSuccess('report');
    }
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      onClose();
    }, 1800);
  };

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

        {submitted ? (
          <div className="py-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-accent-soft text-accent-text border border-accent/40 flex items-center justify-center mx-auto">
              <Check className="w-6 h-6 stroke-[3]" />
            </div>
            <h3 className="font-bold text-ink text-base">
              {actionType === 'block' ? 'Blocked' : 'Report Recorded'}
            </h3>
            <p className="text-xs text-muted max-w-xs mx-auto leading-relaxed">
              {targetType === 'user'
                ? `${targetName} has been restricted locally. You will not see their profile or messages.`
                : `Event "${targetName}" has been flagged locally for this session.`}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center gap-2 text-ink">
              <ShieldAlert className="w-5 h-5 text-accent-text shrink-0" />
              <h3 className="font-bold text-lg">
                {targetType === 'user' ? 'Safety & Community Report' : 'Report Campus Event'}
              </h3>
            </div>

            {/* Target Details */}
            <div className="p-3 bg-surface-soft/50 rounded-xl border border-line text-xs">
              <span className="text-muted font-medium block">
                {targetType === 'user' ? 'Reporting Student:' : 'Reporting Event:'}
              </span>
              <span className="font-bold text-ink text-sm block mt-0.5">
                {targetName}
              </span>
            </div>

            {/* Simulated Prototype Notice */}
            <div className="p-3 bg-accent-soft rounded-xl border border-accent/30 text-[11px] text-ink space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-accent-text">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>Local Safety Action</span>
              </div>
              <p className="text-muted leading-normal">
                Reports are stored locally in this prototype and immediately restrict this profile or event on your device.
              </p>
            </div>

            {/* Action selector for users */}
            {targetType === 'user' && (
              <div className="grid grid-cols-2 gap-2 p-1 bg-surface-soft rounded-xl text-xs">
                <button
                  type="button"
                  onClick={() => setActionType('report')}
                  className={`py-2 font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                    actionType === 'report' ? 'bg-surface text-ink shadow-2xs font-bold' : 'text-muted'
                  }`}
                >
                  <Flag className="w-3.5 h-3.5 text-danger" />
                  <span>Report &amp; Block</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActionType('block')}
                  className={`py-2 font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                    actionType === 'block' ? 'bg-surface text-ink shadow-2xs font-bold' : 'text-muted'
                  }`}
                >
                  <Ban className="w-3.5 h-3.5 text-muted" />
                  <span>Block Only</span>
                </button>
              </div>
            )}

            {actionType === 'report' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">
                    Select a reason *
                  </label>
                  <select
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-line text-ink bg-canvas focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    {REPORT_REASONS.map((reason) => (
                      <option key={reason} value={reason}>
                        {reason}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">
                    Optional description
                  </label>
                  <textarea
                    rows={2}
                    value={additionalNotes}
                    onChange={(e) => setAdditionalNotes(e.target.value)}
                    placeholder="Provide additional details regarding the situation..."
                    className="w-full px-3 py-2 text-xs rounded-xl border border-line text-ink bg-canvas placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                  />
                </div>
              </div>
            )}

            {targetType === 'user' && (
              <p className="text-[11px] text-muted">
                Blocking immediately conceals the user from buddy discovery and halts requests. The blocked user is never notified.
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-muted hover:text-ink cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer ${
                  actionType === 'report'
                    ? 'bg-danger-soft text-danger border border-danger/30 hover:opacity-90'
                    : 'bg-accent hover:bg-accent-hover text-accent-ink'
                }`}
              >
                {actionType === 'report' ? 'Submit Report & Restrict' : 'Confirm Block'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
