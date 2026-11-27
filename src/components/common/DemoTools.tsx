import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { isDemoModeEnabled } from '../../utils/demoClock';

export const DemoTools: React.FC = () => {
  const {
    demoClockMs,
    demoGetMatched,
    demoSimulatePairingEnded,
    demoSimulateBuddyCancelled,
    demoAdvanceWithin24Hours,
    demoAdvanceToEventStart,
    demoAdvanceToEventEnd,
    demoResetClock
  } = useApp();

  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState('');

  if (!isDemoModeEnabled()) return null;

  const runAction = (fn: () => { ok: boolean; message: string }) => {
    const res = fn();
    setStatus(res.message);
  };

  return (
    <div className="fixed bottom-20 md:bottom-4 left-4 z-50">
      {open ? (
        <div className="w-60 bg-surface text-ink rounded-2xl border border-line shadow-lift p-3 space-y-2">
          <div className="flex items-center justify-between gap-2 pb-1 border-b border-line">
            <span className="text-xs font-bold text-ink">Demo</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close demo panel"
              className="p-1 rounded-lg text-muted hover:text-ink hover:bg-surface-soft cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-1.5">
            <button
              type="button"
              onClick={() => runAction(demoGetMatched)}
              className="w-full text-left px-3 py-1.5 rounded-xl bg-canvas hover:bg-accent hover:text-accent-ink border border-line text-xs font-semibold transition-colors cursor-pointer"
            >
              Get matched
            </button>
            <button
              type="button"
              onClick={() => runAction(demoSimulatePairingEnded)}
              className="w-full text-left px-3 py-1.5 rounded-xl bg-canvas hover:bg-accent hover:text-accent-ink border border-line text-xs font-semibold transition-colors cursor-pointer"
            >
              Pairing ends
            </button>
            <button
              type="button"
              onClick={() => runAction(demoSimulateBuddyCancelled)}
              className="w-full text-left px-3 py-1.5 rounded-xl bg-canvas hover:bg-accent hover:text-accent-ink border border-line text-xs font-semibold transition-colors cursor-pointer"
            >
              Buddy cancels
            </button>
            <button
              type="button"
              onClick={() => runAction(demoAdvanceWithin24Hours)}
              className="w-full text-left px-3 py-1.5 rounded-xl bg-canvas hover:bg-accent hover:text-accent-ink border border-line text-xs font-semibold transition-colors cursor-pointer"
            >
              Event &lt; 24h
            </button>
            <button
              type="button"
              onClick={() => runAction(demoAdvanceToEventStart)}
              className="w-full text-left px-3 py-1.5 rounded-xl bg-canvas hover:bg-accent hover:text-accent-ink border border-line text-xs font-semibold transition-colors cursor-pointer"
            >
              Event starts
            </button>
            <button
              type="button"
              onClick={() => runAction(demoAdvanceToEventEnd)}
              className="w-full text-left px-3 py-1.5 rounded-xl bg-canvas hover:bg-accent hover:text-accent-ink border border-line text-xs font-semibold transition-colors cursor-pointer"
            >
              Event ends
            </button>
            <button
              type="button"
              onClick={() => {
                demoResetClock();
                setStatus('Clock reset to live time.');
              }}
              className="w-full text-left px-3 py-1.5 rounded-xl bg-surface-soft hover:bg-accent hover:text-accent-ink text-xs font-semibold transition-colors cursor-pointer"
            >
              Reset clock
            </button>
          </div>

          {(status || demoClockMs !== null) && (
            <p className="text-[11px] text-muted leading-snug pt-1 border-t border-line">
              {status || 'Demo clock active.'}
            </p>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="px-3 py-1.5 rounded-xl bg-surface hover:bg-accent hover:text-accent-ink text-ink border border-line shadow-soft text-xs font-semibold transition-colors cursor-pointer"
        >
          Demo
        </button>
      )}
    </div>
  );
};
