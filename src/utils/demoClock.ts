export const DEMO_CLOCK_SESSION_KEY = 'wathive_demo_clock_ms';

export function isDemoModeEnabled(search?: string): boolean {
  try {
    const query =
      search !== undefined
        ? search
        : typeof window !== 'undefined'
        ? window.location.search
        : '';
    return new URLSearchParams(query).get('demo') === '1';
  } catch {
    return false;
  }
}

export function readDemoClockMs(): number | null {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return null;
    const raw = window.sessionStorage.getItem(DEMO_CLOCK_SESSION_KEY);
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  } catch {
    return null;
  }
}

export function writeDemoClockMs(ms: number | null): void {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    if (ms === null || !Number.isFinite(ms)) {
      window.sessionStorage.removeItem(DEMO_CLOCK_SESSION_KEY);
    } else {
      window.sessionStorage.setItem(DEMO_CLOCK_SESSION_KEY, String(Math.round(ms)));
    }
  } catch {
    // ignore storage errors
  }
}

export function getEffectiveNowMs(
  demoClockMs: number | null,
  realNowMs: number = Date.now()
): number {
  return demoClockMs !== null && Number.isFinite(demoClockMs) ? demoClockMs : realNowMs;
}
