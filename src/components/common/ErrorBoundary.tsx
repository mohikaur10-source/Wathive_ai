import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  title?: string;
  message?: string;
  actionLabel?: string;
  resetKeys?: unknown[];
  onReset?: () => void;
  className?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

function areResetKeysEqual(a?: unknown[], b?: unknown[]): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (!Object.is(a[i], b[i])) return false;
  }
  return true;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('WatHive UI boundary caught error:', error);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (this.state.hasError && !areResetKeysEqual(prevProps.resetKeys, this.props.resetKeys)) {
      this.setState({ hasError: false });
    }
  }

  private handleReset = () => {
    this.setState({ hasError: false });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      const {
        title = 'Something went wrong',
        message = 'We hit an unexpected issue loading this view.',
        actionLabel = 'Try again',
        className = ''
      } = this.props;

      return (
        <div
          role="alert"
          className={`flex-1 flex flex-col items-center justify-center p-8 text-center bg-surface rounded-3xl border border-line gap-3 ${className}`}
        >
          <h2 className="font-display text-base font-bold text-ink">{title}</h2>
          <p className="text-xs text-muted max-w-sm leading-relaxed">{message}</p>
          <button
            type="button"
            onClick={this.handleReset}
            className="px-4 py-2 rounded-full bg-accent hover:bg-accent-hover text-accent-ink text-xs font-semibold shadow-soft transition-colors cursor-pointer"
          >
            {actionLabel}
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
