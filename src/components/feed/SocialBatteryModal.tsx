import React from 'react';
import { X, Sparkles, Check } from 'lucide-react';
import { SocialBatteryTag } from '../../types';
import { SOCIAL_BATTERY_OPTIONS } from '../../utils/compatibilityEngine';

interface SocialBatteryModalProps {
  isOpen: boolean;
  eventTitle: string;
  currentBattery?: SocialBatteryTag;
  onSelect: (battery: SocialBatteryTag) => void;
  onClose: () => void;
}

export const SocialBatteryModal: React.FC<SocialBatteryModalProps> = ({
  isOpen,
  eventTitle,
  currentBattery,
  onSelect,
  onClose
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="social-battery-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-surface text-ink rounded-3xl max-w-md w-full p-6 shadow-lift border border-line relative space-y-5">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-muted hover:text-ink rounded-full hover:bg-surface-soft transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="space-y-1.5 pr-7">
          <div className="flex items-center gap-1.5 text-xs font-bold text-accent-text uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Social Battery Check</span>
          </div>
          <h3
            id="social-battery-title"
            className="font-display text-xl font-bold text-ink leading-snug"
          >
            What&apos;s your energy for this event?
          </h3>
          <p className="text-xs text-muted truncate">
            For <span className="font-semibold text-ink">{eventTitle}</span>
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2.5">
          {SOCIAL_BATTERY_OPTIONS.map((opt) => {
            const isSelected = currentBattery === opt.tag;
            return (
              <button
                key={opt.tag}
                type="button"
                onClick={() => onSelect(opt.tag)}
                className={`w-full p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-3.5 active:scale-[0.99] ${
                  isSelected
                    ? 'bg-accent-soft border-accent shadow-soft'
                    : 'bg-canvas/70 border-line hover:border-accent/70 hover:bg-surface-soft/60'
                }`}
              >
                <span className="text-xl shrink-0" aria-hidden="true">
                  {opt.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-ink">{opt.tag}</span>
                    {isSelected && <Check className="w-4 h-4 text-accent-text stroke-[2.8] shrink-0" />}
                  </div>
                  <p className="text-xs text-muted mt-0.5 leading-snug">{opt.subtitle}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
