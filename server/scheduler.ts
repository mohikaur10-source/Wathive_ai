import { db } from './db.js';
import { collector } from './wusaCollector.js';
import { CollectorConfig, SyncRun } from './types.js';

export class CollectorScheduler {
  private timer: NodeJS.Timeout | null = null;
  private nextRunAt: Date | null = null;
  private isEnabled = true;

  constructor() {
    this.scheduleNext();
  }

  public getStatus() {
    return {
      isEnabled: this.isEnabled,
      isBusy: collector.isBusy(),
      nextRunAt: this.nextRunAt ? this.nextRunAt.toISOString() : null,
      config: db.getConfig(),
      lastSync: db.getLastSuccessfulSync()
    };
  }

  public updateSchedule() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.scheduleNext();
  }

  public triggerManualSync(): Promise<SyncRun> {
    return collector.executeSync('manual');
  }

  private scheduleNext() {
    const config = db.getConfig();
    if (!config.auto_sync_enabled) {
      this.isEnabled = false;
      this.nextRunAt = null;
      console.log('[CollectorScheduler] Automated background sync is disabled in configuration.');
      return;
    }

    this.isEnabled = true;
    let delayMs = 24 * 60 * 60 * 1000;

    if (config.frequency_mode === 'hourly') {
      delayMs = 60 * 60 * 1000;
    } else if (config.frequency_mode === 'every_6h') {
      delayMs = 6 * 60 * 60 * 1000;
    } else if (config.frequency_mode === 'every_12h') {
      delayMs = 12 * 60 * 60 * 1000;
    } else {
      // Daily mode at target daily_sync_time (default 06:00 America/Toronto)
      const [hStr, mStr] = config.daily_sync_time.split(':');
      const targetHour = parseInt(hStr || '6', 10);
      const targetMinute = parseInt(mStr || '0', 10);
      delayMs = this.calculateNextTorontoRunMs(targetHour, targetMinute);
    }

    this.nextRunAt = new Date(Date.now() + delayMs);
    console.log(`[CollectorScheduler] Next scheduled sync (${config.frequency_mode}) at: ${this.nextRunAt.toISOString()} (in ${Math.round(delayMs / 60000)} mins)`);

    this.timer = setTimeout(async () => {
      try {
        if (!collector.isBusy()) {
          console.log('[CollectorScheduler] Firing scheduled sync job...');
          await collector.executeSync('scheduled');
        } else {
          console.warn('[CollectorScheduler] Scheduled sync skipped because another sync is currently running.');
        }
      } catch (err: any) {
        console.error('[CollectorScheduler] Scheduled sync job failed:', err);
      } finally {
        this.scheduleNext();
      }
    }, delayMs);
  }

  private calculateNextTorontoRunMs(targetHour = 6, targetMinute = 0): number {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Toronto',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });

    const parts = formatter.formatToParts(now);
    const getPart = (type: string) => parts.find(p => p.type === type)?.value || '00';
    const curY = parseInt(getPart('year'), 10);
    const curMonth = parseInt(getPart('month'), 10);
    const curDay = parseInt(getPart('day'), 10);
    const curH = parseInt(getPart('hour'), 10) % 24;
    const curM = parseInt(getPart('minute'), 10);

    const baseDate = new Date(Date.UTC(curY, curMonth - 1, curDay));
    if (curH > targetHour || (curH === targetHour && curM >= targetMinute)) {
      baseDate.setUTCDate(baseDate.getUTCDate() + 1);
    }

    const y = baseDate.getUTCFullYear();
    const monthStr = String(baseDate.getUTCMonth() + 1).padStart(2, '0');
    const dayStr = String(baseDate.getUTCDate()).padStart(2, '0');
    const hourStr = String(targetHour).padStart(2, '0');
    const minStr = String(targetMinute).padStart(2, '0');

    // Probe offset for DST
    const probe = new Date(`${y}-${monthStr}-${dayStr}T12:00:00Z`);
    const probeFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Toronto',
      timeZoneName: 'shortOffset'
    });
    const probeOffset = probeFormatter.formatToParts(probe).find(p => p.type === 'timeZoneName')?.value || 'GMT-5';
    const numOffset = probeOffset.replace('GMT', '').trim();
    const sign = numOffset.startsWith('+') ? '+' : '-';
    const offsetVal = `${sign}${String(Math.abs(parseInt(numOffset, 10)) || 5).padStart(2, '0')}:00`;

    const targetIso = `${y}-${monthStr}-${dayStr}T${hourStr}:${minStr}:00${offsetVal}`;
    const targetDate = new Date(targetIso);
    const diff = targetDate.getTime() - now.getTime();
    return Number.isFinite(diff) ? Math.max(1000, diff) : 24 * 60 * 60 * 1000;
  }
}

export const scheduler = new CollectorScheduler();
