import React, { useState } from 'react';
import {
  X,
  Shield,
  Check,
  AlertCircle,
  Building,
  Mail,
  KeyRound,
  ArrowRight,
  Lock,
  Sparkles
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface UWVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const UWVerificationModal: React.FC<UWVerificationModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const { user, verifyUWStudent } = useApp();

  const [step, setStep] = useState<'input' | 'otp' | 'success'>('input');
  const [email, setEmail] = useState(user?.email || 'jordan.k@uwaterloo.ca');
  const [otpCode, setOtpCode] = useState('');
  const [simulatedExpectedOtp] = useState('842195');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSendCode = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const clean = email.trim().toLowerCase();
    if (!clean.endsWith('@uwaterloo.ca')) {
      setError('Please provide a valid University of Waterloo institutional email ending in @uwaterloo.ca');
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setStep('otp');
    }, 600);
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanCode = otpCode.replace(/\D/g, '');
    if (cleanCode.length !== 6 && cleanCode !== simulatedExpectedOtp) {
      setError('Please enter a valid 6-digit confirmation code (demo code: 842195)');
      return;
    }

    const res = verifyUWStudent(email);
    if (res.success) {
      setStep('success');
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 1800);
    } else {
      setError(res.message);
    }
  };

  const handleAutofillCode = () => {
    setOtpCode(simulatedExpectedOtp);
    setError('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-surface text-ink rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-lift border border-line relative my-auto animate-in fade-in zoom-in-95 duration-150">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-muted hover:text-ink rounded-full hover:bg-surface-soft transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {step === 'input' && (
          <form onSubmit={handleSendCode} className="space-y-4">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-accent-text uppercase tracking-wider">
                <Shield className="w-3.5 h-3.5" />
                <span>Student Verification Required</span>
              </div>
              <h3 className="text-xl font-bold text-ink">
                Verify University of Waterloo Status
              </h3>
              <p className="text-xs text-muted leading-relaxed">
                To protect student comfort and safety, WatHive&apos;s personalized buddy-matching system is exclusively available to verified University of Waterloo students.
              </p>
            </div>

            {error && (
              <div className="p-3 bg-danger-soft text-danger text-xs rounded-xl border border-danger/30 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="p-3.5 bg-accent-soft border border-accent/30 rounded-2xl text-xs space-y-1.5 text-ink">
              <div className="font-bold flex items-center gap-1.5 text-accent-text">
                <Lock className="w-3.5 h-3.5" />
                <span>Privacy Protection Guarantee</span>
              </div>
              <p className="text-[11px] text-muted leading-normal">
                Your email address is strictly used for authentication. It is <strong className="text-ink">never publicly displayed</strong> to other students, event organizers, or attendees.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-ink">
                University of Waterloo Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="yourusername@uwaterloo.ca"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-line focus:outline-none focus:ring-2 focus:ring-accent text-xs sm:text-sm text-ink bg-canvas placeholder:text-muted"
                />
              </div>
              <p className="text-[11px] text-muted">
                Must end with <code className="bg-surface-soft px-1.5 py-0.5 rounded font-mono text-ink">@uwaterloo.ca</code>
              </p>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-muted hover:text-ink cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-accent-ink rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-soft transition-all cursor-pointer disabled:opacity-50"
              >
                <span>{isSubmitting ? 'Sending...' : 'Send Verification Code'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-accent-text uppercase tracking-wider">
                <KeyRound className="w-3.5 h-3.5" />
                <span>Verification Passcode</span>
              </div>
              <h3 className="text-xl font-bold text-ink">
                Enter Confirmation Code
              </h3>
              <p className="text-xs text-muted leading-relaxed">
                A 6-digit confirmation code was sent to <strong className="text-ink">{email}</strong>.
              </p>
            </div>

            {error && (
              <div className="p-3 bg-danger-soft text-danger text-xs rounded-xl border border-danger/30 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Quick Demo Simulator Banner */}
            <div className="p-3 bg-surface-soft/60 rounded-2xl border border-line text-xs space-y-1.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="font-bold text-ink flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-accent-text" />
                  <span>Prototype Demo Passcode:</span>
                </span>
                <button
                  type="button"
                  onClick={handleAutofillCode}
                  className="text-[11px] font-bold text-accent-ink bg-accent hover:bg-accent-hover px-2 py-0.5 rounded-md cursor-pointer transition-colors"
                >
                  Click to Auto-fill ({simulatedExpectedOtp})
                </button>
              </div>
              <p className="text-[11px] text-muted">
                In production, this checks token exchange with University of Waterloo WatIAM / Shibboleth authentication.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-ink">
                6-Digit Code
              </label>
              <input
                type="text"
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                placeholder="842195"
                className="w-full text-center tracking-widest text-lg font-mono px-3 py-2.5 rounded-xl border border-line focus:outline-none focus:ring-2 focus:ring-accent text-ink bg-canvas"
              />
            </div>

            <div className="pt-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep('input')}
                className="text-xs font-semibold text-muted hover:text-ink cursor-pointer"
              >
                Change Email
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-accent-ink rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-soft transition-all cursor-pointer"
              >
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                <span>Confirm Verification</span>
              </button>
            </div>
          </form>
        )}

        {step === 'success' && (
          <div className="py-6 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-accent text-accent-ink flex items-center justify-center mx-auto shadow-soft">
              <Check className="w-8 h-8 stroke-[3]" />
            </div>
            <h3 className="text-xl font-bold text-ink">
              Verified Waterloo Student
            </h3>
            <p className="text-xs text-muted max-w-xs mx-auto leading-relaxed">
              Your institutional University of Waterloo student status is confirmed. Personalized buddy matching is now fully unlocked!
            </p>
            <div className="inline-flex items-center gap-1.5 bg-accent-soft text-accent-text text-xs font-bold px-3 py-1 rounded-full border border-accent/30">
              <Shield className="w-3.5 h-3.5" />
              <span>Verified UW Student Badge Active</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
