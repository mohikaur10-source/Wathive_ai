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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-stone-100 relative my-auto animate-in fade-in zoom-in-95 duration-150">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-700 rounded-full hover:bg-stone-100 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {submitted ? (
          <div className="py-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-amber-400/20 text-stone-950 border border-amber-300 flex items-center justify-center mx-auto">
              <Check className="w-6 h-6 text-amber-600 stroke-[3]" />
            </div>
            <h3 className="font-bold text-stone-900 text-base">
              {actionType === 'block' ? 'User Blocked' : 'Report Recorded (Simulated)'}
            </h3>
            <p className="text-xs text-stone-600 max-w-xs mx-auto leading-relaxed">
              {targetType === 'user'
                ? `${targetName} has been restricted locally. You will not see their profile or messages.`
                : `Event "${targetName}" has been flagged locally for this demo session.`}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center gap-2 text-stone-900">
              <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
              <h3 className="font-bold text-lg">
                {targetType === 'user' ? 'Safety & Community Report' : 'Report Campus Event'}
              </h3>
            </div>

            {/* Target Details */}
            <div className="p-3 bg-stone-50 rounded-xl border border-stone-200/80 text-xs">
              <span className="text-stone-500 font-medium block">
                {targetType === 'user' ? 'Reporting Student:' : 'Reporting Event:'}
              </span>
              <span className="font-bold text-stone-900 text-sm block mt-0.5">
                {targetName}
              </span>
            </div>

            {/* Simulated Prototype Notice - Requirement 5 */}
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-300/80 text-[11px] text-amber-950 space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                <span>Prototype Demonstration Notice</span>
              </div>
              <p className="text-stone-700 leading-normal">
                Reports are simulated in this prototype and are <strong>not monitored</strong> by university staff or a live moderation team. Action will locally restrict this profile or event on your device.
              </p>
            </div>

            {/* Action selector for users */}
            {targetType === 'user' && (
              <div className="grid grid-cols-2 gap-2 p-1 bg-stone-100 rounded-xl text-xs">
                <button
                  type="button"
                  onClick={() => setActionType('report')}
                  className={`py-2 font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                    actionType === 'report' ? 'bg-white text-stone-950 shadow-xs font-bold' : 'text-stone-600'
                  }`}
                >
                  <Flag className="w-3.5 h-3.5 text-red-600" />
                  <span>Report & Block</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActionType('block')}
                  className={`py-2 font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                    actionType === 'block' ? 'bg-white text-stone-950 shadow-xs font-bold' : 'text-stone-600'
                  }`}
                >
                  <Ban className="w-3.5 h-3.5 text-stone-700" />
                  <span>Block Only</span>
                </button>
              </div>
            )}

            {actionType === 'report' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Select a reason *
                  </label>
                  <select
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 text-stone-900 bg-white"
                  >
                    {REPORT_REASONS.map((reason) => (
                      <option key={reason} value={reason}>
                        {reason}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Optional description
                  </label>
                  <textarea
                    rows={2}
                    value={additionalNotes}
                    onChange={(e) => setAdditionalNotes(e.target.value)}
                    placeholder="Provide additional details regarding the situation..."
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 text-stone-900 bg-white resize-none"
                  />
                </div>
              </div>
            )}

            {targetType === 'user' && (
              <p className="text-[11px] text-stone-500">
                Blocking immediately conceals the user from buddy discovery and halts requests. The blocked user is never notified.
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-stone-600 hover:text-stone-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition-all shadow-xs ${
                  actionType === 'report' ? 'bg-red-600 hover:bg-red-700' : 'bg-stone-900 hover:bg-black'
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
