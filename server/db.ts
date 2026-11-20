import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import {
  WusaStoredEvent,
  RecurringSeries,
  ChangeHistoryEntry,
  SyncRun,
  CollectorConfig
} from './types.js';
import { capString, sanitizeHttpUrl, stripHtmlToText } from './htmlParser.js';
import { torontoWallClockToUtcMs } from '../src/utils/eventLifecycle.js';

const DATA_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'wusa_collector.db');

export class CollectorDatabase {
  private db: DatabaseSync;

  constructor(dbPath = DB_PATH) {
    this.db = this.openWithRecovery(dbPath);
  }

  private isCorruptionError(err: unknown): boolean {
    if (!err || typeof err !== 'object') return false;
    const e = err as { code?: string; errcode?: number; errstr?: string; message?: string };
    const msg = `${e.errstr || ''} ${e.message || ''}`.toLowerCase();
    return (
      e.errcode === 11 ||
      e.errcode === 26 ||
      msg.includes('malformed') ||
      msg.includes('not a database') ||
      msg.includes('quick_check')
    );
  }

  private removeDbFiles(dbPath: string) {
    for (const suffix of ['', '-wal', '-shm']) {
      const file = `${dbPath}${suffix}`;
      try {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
      } catch {
        // ignore cleanup failure
      }
    }
  }

  private openWithRecovery(dbPath: string): DatabaseSync {
    const attemptOpen = (): DatabaseSync => {
      const database = new DatabaseSync(dbPath);
      this.db = database;
      if (dbPath !== ':memory:') {
        const check = this.db.prepare('PRAGMA quick_check(1)').get() as
          | { quick_check?: string }
          | undefined;
        if (check?.quick_check !== 'ok') {
          throw new Error(`SQLite quick_check failed: ${check?.quick_check || 'unknown'}`);
        }
      }
      this.initSchema();
      return this.db;
    };

    try {
      return attemptOpen();
    } catch (err) {
      if (dbPath !== ':memory:' && this.isCorruptionError(err)) {
        console.warn('[CollectorDB] Corrupted SQLite cache detected; rebuilding fresh database.');
        try {
          this.db?.close();
        } catch {
          // ignore close failure
        }
        this.removeDbFiles(dbPath);
        return attemptOpen();
      }
      throw err;
    }
  }

  private initSchema() {
    this.db.exec(`
      PRAGMA busy_timeout = 5000;
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS wusa_events (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        slug TEXT,
        description TEXT NOT NULL,
        description_text TEXT NOT NULL,
        excerpt TEXT,
        organizer_json TEXT,
        start_date TEXT NOT NULL,
        end_date TEXT,
        start_iso TEXT NOT NULL,
        end_iso TEXT,
        timezone TEXT NOT NULL DEFAULT 'America/Toronto',
        all_day INTEGER NOT NULL DEFAULT 0,
        venue_json TEXT,
        category TEXT NOT NULL,
        categories_json TEXT NOT NULL,
        cost TEXT,
        registration_url TEXT,
        registration_deadline TEXT,
        source_image_url TEXT,
        original_wusa_url TEXT NOT NULL,
        cancellation_status TEXT NOT NULL DEFAULT 'scheduled',
        temporal_status TEXT NOT NULL DEFAULT 'upcoming',
        is_multi_day INTEGER NOT NULL DEFAULT 0,
        is_recurring INTEGER NOT NULL DEFAULT 0,
        series_id TEXT,
        recurrence_rule TEXT,
        review_status TEXT NOT NULL DEFAULT 'clean',
        review_flags_json TEXT NOT NULL DEFAULT '[]',
        approval_status TEXT NOT NULL DEFAULT 'pending',
        admin_notes TEXT,
        content_hash TEXT NOT NULL,
        first_imported_at TEXT NOT NULL,
        last_checked_at TEXT NOT NULL,
        last_changed_at TEXT NOT NULL,
        raw_payload TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_events_start_date ON wusa_events(start_date);
      CREATE INDEX IF NOT EXISTS idx_events_temporal ON wusa_events(temporal_status);
      CREATE INDEX IF NOT EXISTS idx_events_review ON wusa_events(review_status);
      CREATE INDEX IF NOT EXISTS idx_events_approval ON wusa_events(approval_status);
      CREATE INDEX IF NOT EXISTS idx_events_url ON wusa_events(original_wusa_url);

      CREATE TABLE IF NOT EXISTS recurring_series (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        slug_base TEXT NOT NULL,
        recurrence_description TEXT,
        total_occurrences INTEGER NOT NULL DEFAULT 0,
        first_occurrence TEXT,
        last_occurrence TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS change_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id TEXT NOT NULL,
        field_name TEXT NOT NULL,
        old_value TEXT,
        new_value TEXT,
        changed_at TEXT NOT NULL,
        sync_run_id TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_history_event ON change_history(event_id);

      CREATE TABLE IF NOT EXISTS sync_runs (
        id TEXT PRIMARY KEY,
        trigger_type TEXT NOT NULL,
        started_at TEXT NOT NULL,
        completed_at TEXT,
        duration_ms INTEGER,
        status TEXT NOT NULL,
        events_found INTEGER NOT NULL DEFAULT 0,
        events_new INTEGER NOT NULL DEFAULT 0,
        events_updated INTEGER NOT NULL DEFAULT 0,
        events_unchanged INTEGER NOT NULL DEFAULT 0,
        events_failed INTEGER NOT NULL DEFAULT 0,
        pages_crawled INTEGER NOT NULL DEFAULT 0,
        page_limit_reached INTEGER NOT NULL DEFAULT 0,
        error_message TEXT,
        logs_json TEXT NOT NULL DEFAULT '[]'
      );

      CREATE TABLE IF NOT EXISTS collector_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    // Safe migration: add `archived`, `start_utc`, `end_utc`, `source`, `source_url` columns if they do not exist yet
    const cols = this.db.prepare('PRAGMA table_info(wusa_events)').all() as Array<{ name: string }>;
    if (!cols.some(c => c.name === 'archived')) {
      this.db.exec('ALTER TABLE wusa_events ADD COLUMN archived INTEGER NOT NULL DEFAULT 0');
    }
    if (!cols.some(c => c.name === 'start_utc')) {
      this.db.exec('ALTER TABLE wusa_events ADD COLUMN start_utc TEXT');
    }
    if (!cols.some(c => c.name === 'end_utc')) {
      this.db.exec('ALTER TABLE wusa_events ADD COLUMN end_utc TEXT');
    }
    if (!cols.some(c => c.name === 'source')) {
      this.db.exec("ALTER TABLE wusa_events ADD COLUMN source TEXT NOT NULL DEFAULT 'wusa'");
    }
    if (!cols.some(c => c.name === 'source_url')) {
      this.db.exec('ALTER TABLE wusa_events ADD COLUMN source_url TEXT');
    }
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_events_archived ON wusa_events(archived)');
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_events_end_utc ON wusa_events(end_utc)');
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_events_source ON wusa_events(source)');

    // Ensure default config exists (hourly auto-sync enabled, past_days_scope forced to 0)
    const defaultConfigs: Record<string, string> = {
      past_days_scope: '0',
      future_days_scope: '180',
      daily_sync_time: '06:00',
      frequency_mode: 'hourly',
      page_limit: '20',
      request_delay_ms: '350',
      auto_sync_enabled: '1',
      detail_enrichment_enabled: '1'
    };

    const checkStmt = this.db.prepare('SELECT key, value FROM collector_config WHERE key = ?');
    const insertStmt = this.db.prepare('INSERT INTO collector_config (key, value) VALUES (?, ?)');
    const updateFreqStmt = this.db.prepare("UPDATE collector_config SET value = 'hourly' WHERE key = 'frequency_mode' AND value = 'daily'");
    const forcePastScopeStmt = this.db.prepare("INSERT OR REPLACE INTO collector_config (key, value) VALUES ('past_days_scope', '0')");

    for (const [k, v] of Object.entries(defaultConfigs)) {
      if (!checkStmt.get(k)) {
        insertStmt.run(k, v);
      }
    }
    updateFreqStmt.run();
    forcePastScopeStmt.run();

    // Backfill start_utc / end_utc for existing rows missing UTC bounds
    this.backfillUtcBounds();

    // Archive past events on database initialization
    this.archivePastEvents();
  }

  private computeUtcWindow(
    startDate: string,
    endDate: string | null,
    startIso?: string | null,
    endIso?: string | null
  ): { startUtc: string; endUtc: string } {
    let startMs = startIso ? Date.parse(startIso) : NaN;
    if (Number.isNaN(startMs) && startDate) {
      const datePart = startDate.slice(0, 10);
      const timePart = startDate.slice(11, 19) || '00:00:00';
      startMs = torontoWallClockToUtcMs(datePart, timePart);
    }
    const startUtc = Number.isFinite(startMs) ? new Date(startMs).toISOString() : new Date().toISOString();

    let endMs = endIso ? Date.parse(endIso) : NaN;
    if (Number.isNaN(endMs)) {
      const rawEnd = endDate && endDate.trim() ? endDate : '';
      const endDatePart = rawEnd ? rawEnd.slice(0, 10) : startDate.slice(0, 10);
      const endTimePart = rawEnd && rawEnd.length >= 16 ? rawEnd.slice(11, 19) || '23:59:59' : '23:59:59';
      const msPad = endTimePart.startsWith('23:59:59') ? 999 : 0;
      endMs = torontoWallClockToUtcMs(endDatePart, endTimePart, msPad);
    } else if (endDate && endDate.includes('23:59:59') && endMs % 1000 === 0) {
      endMs += 999;
    }

    const endUtc = Number.isFinite(endMs)
      ? new Date(endMs).toISOString()
      : new Date(torontoWallClockToUtcMs(startDate.slice(0, 10), '23:59:59', 999)).toISOString();

    return { startUtc, endUtc };
  }

  private backfillUtcBounds() {
    const missingRows = this.db
      .prepare('SELECT id, start_date, end_date, start_iso, end_iso FROM wusa_events WHERE start_utc IS NULL OR end_utc IS NULL')
      .all() as Array<{
        id: string;
        start_date: string;
        end_date: string | null;
        start_iso: string;
        end_iso: string | null;
      }>;

    if (missingRows.length === 0) return;

    const stmt = this.db.prepare('UPDATE wusa_events SET start_utc = ?, end_utc = ? WHERE id = ?');
    for (const row of missingRows) {
      const { startUtc, endUtc } = this.computeUtcWindow(row.start_date, row.end_date, row.start_iso, row.end_iso);
      stmt.run(startUtc, endUtc, row.id);
    }
  }

  public getTorontoDateTimeNow(now: Date = new Date()): { dateStr: string; timeStr: string; dateTimeStr: string } {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Toronto',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    });
    const parts = formatter.formatToParts(now);
    const getPart = (t: string) => parts.find(p => p.type === t)?.value || '00';
    const dateStr = `${getPart('year')}-${getPart('month')}-${getPart('day')}`;
    const timeStr = `${String(parseInt(getPart('hour'), 10) % 24).padStart(2, '0')}:${getPart('minute')}`;
    return { dateStr, timeStr, dateTimeStr: `${dateStr} ${timeStr}` };
  }

  /**
   * Automatically archives events whose end date/time is strictly before current time in America/Toronto.
   */
  public archivePastEvents(): number {
    const nowMs = Date.now();
    const rows = this.db
      .prepare('SELECT id, start_date, end_date, start_iso, end_iso, start_utc, end_utc, archived, temporal_status FROM wusa_events')
      .all() as Array<{
        id: string;
        start_date: string;
        end_date: string | null;
        start_iso: string;
        end_iso: string | null;
        start_utc: string | null;
        end_utc: string | null;
        archived: number;
        temporal_status: string;
      }>;

    const archiveStmt = this.db.prepare("UPDATE wusa_events SET archived = 1, temporal_status = 'past' WHERE id = ?");
    const unarchiveStmt = this.db.prepare('UPDATE wusa_events SET archived = 0 WHERE id = ?');

    let archivedCount = 0;
    for (const row of rows) {
      const effectiveEndUtc =
        row.end_utc ||
        this.computeUtcWindow(row.start_date, row.end_date, row.start_iso, row.end_iso).endUtc;
      const endMs = Date.parse(effectiveEndUtc);
      const isPast = Number.isNaN(endMs) ? true : endMs <= nowMs;

      if (isPast && (row.archived !== 1 || row.temporal_status !== 'past')) {
        archiveStmt.run(row.id);
        archivedCount++;
      } else if (!isPast && row.archived === 1 && row.temporal_status === 'past') {
        unarchiveStmt.run(row.id);
      }
    }
    return archivedCount;
  }

  /**
   * Archives community events belonging to a specific source + feed URL that disappeared from the latest successful fetch.
   */
  public archiveMissingEventsForSource(
    source: 'community_sheet' | 'community_ics',
    sourceUrl: string,
    activeIds: string[]
  ): number {
    const activeSet = new Set(activeIds);
    const rows = this.db
      .prepare('SELECT id FROM wusa_events WHERE source = ? AND source_url = ? AND archived = 0')
      .all(source, sourceUrl) as Array<{ id: string }>;

    const stmt = this.db.prepare('UPDATE wusa_events SET archived = 1 WHERE id = ?');
    let count = 0;
    for (const row of rows) {
      if (!activeSet.has(row.id)) {
        stmt.run(row.id);
        count++;
      }
    }
    return count;
  }

  // --- CONFIG ---

  public getConfig(): CollectorConfig {
    const rows = this.db.prepare('SELECT key, value FROM collector_config').all() as Array<{ key: string; value: string }>;
    const map = new Map(rows.map(r => [r.key, r.value]));

    return {
      past_days_scope: parseInt(map.get('past_days_scope') || '0', 10),
      future_days_scope: parseInt(map.get('future_days_scope') || '180', 10),
      daily_sync_time: map.get('daily_sync_time') || '06:00',
      frequency_mode: (map.get('frequency_mode') as any) || 'hourly',
      page_limit: parseInt(map.get('page_limit') || '20', 10),
      request_delay_ms: parseInt(map.get('request_delay_ms') || '350', 10),
      auto_sync_enabled: map.get('auto_sync_enabled') === '1',
      detail_enrichment_enabled: map.get('detail_enrichment_enabled') !== '0'
    };
  }

  public saveConfig(config: Partial<CollectorConfig>) {
    const stmt = this.db.prepare('INSERT OR REPLACE INTO collector_config (key, value) VALUES (?, ?)');
    if (config.past_days_scope !== undefined) stmt.run('past_days_scope', String(config.past_days_scope));
    if (config.future_days_scope !== undefined) stmt.run('future_days_scope', String(config.future_days_scope));
    if (config.daily_sync_time !== undefined) stmt.run('daily_sync_time', config.daily_sync_time);
    if (config.frequency_mode !== undefined) stmt.run('frequency_mode', config.frequency_mode);
    if (config.page_limit !== undefined) stmt.run('page_limit', String(config.page_limit));
    if (config.request_delay_ms !== undefined) stmt.run('request_delay_ms', String(config.request_delay_ms));
    if (config.auto_sync_enabled !== undefined) stmt.run('auto_sync_enabled', config.auto_sync_enabled ? '1' : '0');
    if (config.detail_enrichment_enabled !== undefined) stmt.run('detail_enrichment_enabled', config.detail_enrichment_enabled ? '1' : '0');
  }

  // --- EVENTS ---

  public getStoredEvent(id: string): WusaStoredEvent | null {
    const row = this.db.prepare('SELECT * FROM wusa_events WHERE id = ?').get(id) as any;
    return row ? this.mapRowToEvent(row) : null;
  }

  public findEventByUrlAndDate(url: string, startDate: string): WusaStoredEvent | null {
    const row = this.db.prepare('SELECT * FROM wusa_events WHERE original_wusa_url = ? AND start_date = ?').get(url, startDate) as any;
    return row ? this.mapRowToEvent(row) : null;
  }

  public findEventByUrl(url: string): WusaStoredEvent | null {
    const row = this.db.prepare('SELECT * FROM wusa_events WHERE original_wusa_url = ? LIMIT 1').get(url) as any;
    return row ? this.mapRowToEvent(row) : null;
  }

  public getAllEventsRaw(includeArchived = false): WusaStoredEvent[] {
    this.archivePastEvents();
    if (includeArchived) {
      const rows = this.db.prepare('SELECT * FROM wusa_events ORDER BY COALESCE(start_utc, start_iso, start_date) ASC').all() as any[];
      return rows.map(r => this.mapRowToEvent(r));
    }
    const nowUtcIso = new Date().toISOString();
    const rows = this.db
      .prepare("SELECT * FROM wusa_events WHERE archived = 0 AND approval_status != 'rejected' AND (source = 'wusa' OR approval_status = 'approved') AND (end_utc IS NULL OR end_utc > ?) ORDER BY COALESCE(start_utc, start_iso, start_date) ASC")
      .all(nowUtcIso) as any[];
    return rows.map(r => this.mapRowToEvent(r));
  }

  public getEvents(filters: {
    search?: string;
    status?: string;
    temporal_status?: string;
    category?: string;
    review_status?: string;
    approval_status?: string;
    page?: number;
    limit?: number;
  }): { events: WusaStoredEvent[]; total: number; page: number; limit: number } {
    this.archivePastEvents();
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const offset = (page - 1) * limit;

    let whereClauses: string[] = ['archived = 0'];
    let params: any[] = [];

    if (filters.search) {
      const term = `%${filters.search.trim().toLowerCase()}%`;
      whereClauses.push('(LOWER(title) LIKE ? OR LOWER(description_text) LIKE ? OR LOWER(venue_json) LIKE ? OR LOWER(category) LIKE ? OR id = ?)');
      params.push(term, term, term, term, filters.search.trim());
    }

    if (filters.temporal_status && filters.temporal_status !== 'all') {
      whereClauses.push('temporal_status = ?');
      params.push(filters.temporal_status);
    }

    if (filters.status === 'cancelled') {
      whereClauses.push("cancellation_status = 'cancelled'");
    }

    if (filters.category && filters.category !== 'all') {
      whereClauses.push('category = ?');
      params.push(filters.category);
    }

    if (filters.review_status && filters.review_status !== 'all') {
      whereClauses.push('review_status = ?');
      params.push(filters.review_status);
    }

    if (filters.approval_status && filters.approval_status !== 'all') {
      whereClauses.push('approval_status = ?');
      params.push(filters.approval_status);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countRow = this.db.prepare(`SELECT COUNT(*) as count FROM wusa_events ${whereSql}`).get(...params) as any;
    const total = countRow ? countRow.count : 0;

    const query = `
      SELECT * FROM wusa_events 
      ${whereSql} 
      ORDER BY 
        CASE 
          WHEN temporal_status = 'upcoming' THEN 1 
          WHEN temporal_status = 'ongoing' THEN 0 
          ELSE 2 
        END ASC,
        start_date ASC
      LIMIT ? OFFSET ?
    `;

    const rows = this.db.prepare(query).all(...params, limit, offset) as any[];
    return {
      events: rows.map(r => this.mapRowToEvent(r)),
      total,
      page,
      limit
    };
  }

  /**
   * Upserts an event with strict change tracking and non-destructive overwrite guards
   */
  public upsertEvent(
    event: WusaStoredEvent,
    syncRunId: string
  ): { status: 'new' | 'updated' | 'unchanged' | 'failed'; diffCount: number } {
    try {
      const eventSource: 'wusa' | 'community_sheet' | 'community_ics' = event.source || 'wusa';
      const isCommunity = eventSource !== 'wusa';

      const existing = isCommunity
        ? this.getStoredEvent(event.id)
        : (
            this.getStoredEvent(event.id) ||
            this.findEventByUrlAndDate(event.original_wusa_url, event.start_date) ||
            this.findEventByUrl(event.original_wusa_url)
          );
      const now = new Date().toISOString();

      const utcBounds = this.computeUtcWindow(event.start_date, event.end_date, event.start_iso, event.end_iso);
      const startUtc = event.start_utc || utcBounds.startUtc;
      const endUtc = event.end_utc || utcBounds.endUtc;

      if (!existing) {
        // Brand new event
        const insertStmt = this.db.prepare(`
          INSERT INTO wusa_events (
            id, title, slug, description, description_text, excerpt,
            organizer_json, start_date, end_date, start_iso, end_iso, start_utc, end_utc, timezone, all_day,
            venue_json, category, categories_json, cost, registration_url, registration_deadline,
            source, source_url, source_image_url, original_wusa_url, cancellation_status, temporal_status, archived,
            is_multi_day, is_recurring, series_id, recurrence_rule,
            review_status, review_flags_json, approval_status, admin_notes,
            content_hash, first_imported_at, last_checked_at, last_changed_at, raw_payload
          ) VALUES (
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?, ?
          )
        `);

        const safeTitle = capString(event.title, 300);
        const safeDescText = capString(stripHtmlToText(event.description_text || event.description || ''), 10_000);
        const safeExcerpt = event.excerpt ? capString(stripHtmlToText(event.excerpt), 1000) : null;
        const safeOriginalUrl = sanitizeHttpUrl(event.original_wusa_url) || (isCommunity ? '' : `https://wusa.ca/event/${encodeURIComponent(event.id)}/`);

        insertStmt.run(
          capString(event.id, 64),
          safeTitle,
          event.slug ? capString(event.slug, 200) : null,
          safeDescText,
          safeDescText,
          safeExcerpt,
          event.organizer ? JSON.stringify(event.organizer) : null,
          event.start_date,
          event.end_date,
          event.start_iso,
          event.end_iso,
          startUtc,
          endUtc,
          event.timezone,
          event.all_day ? 1 : 0,
          event.venue ? JSON.stringify(event.venue) : null,
          capString(event.category, 100),
          JSON.stringify(event.categories || []),
          event.cost ? capString(event.cost, 120) : null,
          sanitizeHttpUrl(event.registration_url),
          event.registration_deadline ? capString(event.registration_deadline, 200) : null,
          eventSource,
          event.source_url || null,
          sanitizeHttpUrl(event.source_image_url),
          safeOriginalUrl,
          event.cancellation_status,
          event.temporal_status,
          event.temporal_status === 'past' ? 1 : 0,
          event.is_multi_day ? 1 : 0,
          event.is_recurring ? 1 : 0,
          event.series_id,
          event.recurrence_rule ? capString(event.recurrence_rule, 1000) : null,
          event.review_status,
          JSON.stringify(event.review_flags || []),
          event.approval_status || 'pending',
          event.admin_notes || null,
          event.content_hash,
          now, // first_imported_at
          now, // last_checked_at
          now, // last_changed_at
          null
        );

        return { status: 'new', diffCount: 0 };
      }

      // Existing event: Check for meaningful field changes
      const diffs: Array<{ field: string; oldVal: string | null; newVal: string | null }> = [];

      // Check fields for updates - for WUSA keep non-empty guard against scrape glitches; for community sources treat feed row as authoritative
      const checkField = (field: string, oldVal: any, newVal: any) => {
        if (!isCommunity && oldVal && (newVal === null || newVal === undefined || newVal === '')) {
          return; // preserve existing valid value
        }

        const oldStr = typeof oldVal === 'object' ? JSON.stringify(oldVal) : String(oldVal ?? '');
        const newStr = typeof newVal === 'object' ? JSON.stringify(newVal) : String(newVal ?? '');

        if (oldStr !== newStr) {
          diffs.push({ field, oldVal: oldStr, newVal: newStr });
        }
      };

      checkField('title', existing.title, event.title);
      checkField('description_text', existing.description_text, event.description_text);
      checkField('category', existing.category, event.category);
      checkField('start_date', existing.start_date, event.start_date);
      checkField('end_date', existing.end_date, event.end_date);
      checkField('start_iso', existing.start_iso, event.start_iso);
      checkField('end_iso', existing.end_iso, event.end_iso);
      checkField('all_day', existing.all_day, event.all_day);
      checkField('cost', existing.cost, event.cost);
      checkField('venue', existing.venue, event.venue);
      checkField('organizer', existing.organizer, event.organizer);
      checkField('registration_url', existing.registration_url, event.registration_url);
      checkField('registration_deadline', existing.registration_deadline, event.registration_deadline);
      checkField('cancellation_status', existing.cancellation_status, event.cancellation_status);
      checkField('source_image_url', existing.source_image_url, event.source_image_url);
      if (isCommunity) {
        checkField('approval_status', existing.approval_status, event.approval_status);
        checkField('source_url', existing.source_url, event.source_url);
      }

      // Preserve existing manual approval or notes for WUSA; sync approval for community rows
      const approvalStatus = isCommunity ? (event.approval_status || existing.approval_status) : existing.approval_status;
      const adminNotes = existing.admin_notes;

      // Merge review flags so manual or previously flagged issues are retained
      const mergedFlags = Array.from(new Set([...existing.review_flags, ...(event.review_flags || [])]));
      const reviewStatus = mergedFlags.length > 0 ? 'needs_review' : 'clean';

      if (diffs.length === 0) {
        // Unchanged: update last_checked_at, refreshed temporal status, UTC bounds, and archived state
        this.db.prepare(`
          UPDATE wusa_events 
          SET last_checked_at = ?, temporal_status = ?, archived = ?, start_utc = ?, end_utc = ? 
          WHERE id = ?
        `).run(now, event.temporal_status, event.temporal_status === 'past' ? 1 : 0, startUtc, endUtc, existing.id);

        return { status: 'unchanged', diffCount: 0 };
      }

      // Record diffs into change_history table
      const historyStmt = this.db.prepare(`
        INSERT INTO change_history (event_id, field_name, old_value, new_value, changed_at, sync_run_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      for (const d of diffs) {
        historyStmt.run(existing.id, d.field, d.oldVal, d.newVal, now, syncRunId);
      }

      // Update the event with safe merged values
      const updateStmt = this.db.prepare(`
        UPDATE wusa_events SET
          title = ?,
          description = ?,
          description_text = ?,
          excerpt = ?,
          organizer_json = ?,
          start_date = ?,
          end_date = ?,
          start_iso = ?,
          end_iso = ?,
          start_utc = ?,
          end_utc = ?,
          timezone = ?,
          all_day = ?,
          venue_json = ?,
          category = ?,
          categories_json = ?,
          cost = ?,
          registration_url = ?,
          registration_deadline = ?,
          source = ?,
          source_url = ?,
          source_image_url = ?,
          original_wusa_url = ?,
          cancellation_status = ?,
          temporal_status = ?,
          archived = ?,
          is_multi_day = ?,
          is_recurring = ?,
          series_id = ?,
          recurrence_rule = ?,
          review_status = ?,
          review_flags_json = ?,
          approval_status = ?,
          admin_notes = ?,
          content_hash = ?,
          last_checked_at = ?,
          last_changed_at = ?,
          raw_payload = ?
        WHERE id = ?
      `);

      const safeUpdDesc = capString(
        stripHtmlToText(
          isCommunity
            ? (event.description_text || event.description || '')
            : (event.description_text || event.description || existing.description_text || existing.description || '')
        ),
        10_000
      );

      updateStmt.run(
        capString(event.title || existing.title, 300),
        safeUpdDesc,
        safeUpdDesc,
        isCommunity
          ? (event.excerpt ? capString(stripHtmlToText(event.excerpt), 1000) : null)
          : ((event.excerpt || existing.excerpt) ? capString(stripHtmlToText(event.excerpt || existing.excerpt || ''), 1000) : null),
        event.organizer ? JSON.stringify(event.organizer) : (isCommunity ? null : (existing.organizer ? JSON.stringify(existing.organizer) : null)),
        event.start_date || existing.start_date,
        isCommunity ? event.end_date : (event.end_date || existing.end_date),
        event.start_iso || existing.start_iso,
        isCommunity ? event.end_iso : (event.end_iso || existing.end_iso),
        startUtc,
        endUtc,
        event.timezone || existing.timezone,
        event.all_day ? 1 : 0,
        event.venue ? JSON.stringify(event.venue) : (isCommunity ? null : (existing.venue ? JSON.stringify(existing.venue) : null)),
        capString(event.category || existing.category, 100),
        JSON.stringify(event.categories || existing.categories || []),
        isCommunity
          ? (event.cost ? capString(event.cost, 120) : null)
          : ((event.cost || existing.cost) ? capString(event.cost || existing.cost || '', 120) : null),
        isCommunity ? sanitizeHttpUrl(event.registration_url) : sanitizeHttpUrl(event.registration_url || existing.registration_url),
        isCommunity
          ? (event.registration_deadline ? capString(event.registration_deadline, 200) : null)
          : ((event.registration_deadline || existing.registration_deadline) ? capString(event.registration_deadline || existing.registration_deadline || '', 200) : null),
        eventSource,
        event.source_url ?? existing.source_url ?? null,
        isCommunity ? sanitizeHttpUrl(event.source_image_url) : sanitizeHttpUrl(event.source_image_url || existing.source_image_url),
        isCommunity
          ? (sanitizeHttpUrl(event.original_wusa_url) || '')
          : (sanitizeHttpUrl(event.original_wusa_url || existing.original_wusa_url) || existing.original_wusa_url),
        event.cancellation_status || existing.cancellation_status,
        event.temporal_status,
        event.temporal_status === 'past' ? 1 : 0,
        event.is_multi_day ? 1 : 0,
        event.is_recurring ? 1 : 0,
        event.series_id || existing.series_id,
        (event.recurrence_rule || existing.recurrence_rule) ? capString(event.recurrence_rule || existing.recurrence_rule || '', 1000) : null,
        reviewStatus,
        JSON.stringify(mergedFlags),
        approvalStatus,
        adminNotes,
        event.content_hash,
        now, // last_checked_at
        now, // last_changed_at
        null,
        existing.id
      );

      return { status: 'updated', diffCount: diffs.length };
    } catch (err) {
      console.error(`Error upserting event ${event.id}:`, err);
      return { status: 'failed', diffCount: 0 };
    }
  }

  public updateEventManual(id: string, updates: Partial<WusaStoredEvent>): boolean {
    const existing = this.getStoredEvent(id);
    if (!existing) return false;

    const now = new Date().toISOString();
    const historyStmt = this.db.prepare(`
      INSERT INTO change_history (event_id, field_name, old_value, new_value, changed_at, sync_run_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    // Record admin edits
    for (const [k, newVal] of Object.entries(updates)) {
      if (k === 'id' || k === 'first_imported_at' || k === 'last_checked_at') continue;
      const oldVal = (existing as any)[k];
      const oldStr = typeof oldVal === 'object' ? JSON.stringify(oldVal) : String(oldVal ?? '');
      const newStr = typeof newVal === 'object' ? JSON.stringify(newVal) : String(newVal ?? '');
      if (oldStr !== newStr) {
        historyStmt.run(id, `manual_${k}`, oldStr, newStr, now, 'manual_admin_edit');
      }
    }

    const merged = { ...existing, ...updates, last_changed_at: now };

    this.db.prepare(`
      UPDATE wusa_events SET
        title = ?,
        description = ?,
        venue_json = ?,
        cost = ?,
        registration_url = ?,
        start_date = ?,
        end_date = ?,
        approval_status = ?,
        review_status = ?,
        review_flags_json = ?,
        admin_notes = ?,
        last_changed_at = ?
      WHERE id = ?
    `).run(
      merged.title,
      merged.description,
      merged.venue ? JSON.stringify(merged.venue) : null,
      merged.cost,
      merged.registration_url,
      merged.start_date,
      merged.end_date,
      merged.approval_status,
      merged.review_status,
      JSON.stringify(merged.review_flags || []),
      merged.admin_notes,
      now,
      id
    );

    return true;
  }

  public getEventHistory(eventId: string): ChangeHistoryEntry[] {
    const rows = this.db.prepare('SELECT * FROM change_history WHERE event_id = ? ORDER BY changed_at DESC').all(eventId) as any[];
    return rows.map(r => ({
      id: r.id,
      event_id: r.event_id,
      field_name: r.field_name,
      old_value: r.old_value,
      new_value: r.new_value,
      changed_at: r.changed_at,
      sync_run_id: r.sync_run_id
    }));
  }

  // --- RECURRING SERIES ---

  public upsertSeries(series: RecurringSeries) {
    const existing = this.db.prepare('SELECT * FROM recurring_series WHERE id = ?').get(series.id) as any;
    const now = new Date().toISOString();

    if (!existing) {
      this.db.prepare(`
        INSERT INTO recurring_series (
          id, title, slug_base, recurrence_description, total_occurrences,
          first_occurrence, last_occurrence, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        series.id,
        series.title,
        series.slug_base,
        series.recurrence_description,
        series.total_occurrences,
        series.first_occurrence,
        series.last_occurrence,
        now,
        now
      );
    } else {
      this.db.prepare(`
        UPDATE recurring_series SET
          title = ?,
          recurrence_description = ?,
          total_occurrences = ?,
          first_occurrence = ?,
          last_occurrence = ?,
          updated_at = ?
        WHERE id = ?
      `).run(
        series.title,
        series.recurrence_description,
        series.total_occurrences,
        series.first_occurrence,
        series.last_occurrence,
        now,
        series.id
      );
    }
  }

  public getRecurringSeries(): RecurringSeries[] {
    const rows = this.db.prepare('SELECT * FROM recurring_series ORDER BY title ASC').all() as any[];
    return rows.map(r => ({
      id: r.id,
      title: r.title,
      slug_base: r.slug_base,
      recurrence_description: r.recurrence_description,
      total_occurrences: r.total_occurrences,
      first_occurrence: r.first_occurrence,
      last_occurrence: r.last_occurrence,
      created_at: r.created_at,
      updated_at: r.updated_at
    }));
  }

  // --- SYNC RUNS ---

  public recordSyncRunStart(run: SyncRun) {
    this.db.prepare(`
      INSERT INTO sync_runs (
        id, trigger_type, started_at, completed_at, duration_ms, status,
        events_found, events_new, events_updated, events_unchanged, events_failed,
        pages_crawled, page_limit_reached, error_message, logs_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      run.id,
      run.trigger_type,
      run.started_at,
      run.completed_at,
      run.duration_ms,
      run.status,
      run.events_found,
      run.events_new,
      run.events_updated,
      run.events_unchanged,
      run.events_failed,
      run.pages_crawled,
      run.page_limit_reached ? 1 : 0,
      run.error_message,
      JSON.stringify(run.logs || [])
    );
  }

  public updateSyncRun(run: SyncRun) {
    this.db.prepare(`
      UPDATE sync_runs SET
        completed_at = ?,
        duration_ms = ?,
        status = ?,
        events_found = ?,
        events_new = ?,
        events_updated = ?,
        events_unchanged = ?,
        events_failed = ?,
        pages_crawled = ?,
        page_limit_reached = ?,
        error_message = ?,
        logs_json = ?
      WHERE id = ?
    `).run(
      run.completed_at,
      run.duration_ms,
      run.status,
      run.events_found,
      run.events_new,
      run.events_updated,
      run.events_unchanged,
      run.events_failed,
      run.pages_crawled,
      run.page_limit_reached ? 1 : 0,
      run.error_message,
      JSON.stringify(run.logs || []),
      run.id
    );
  }

  public getSyncRuns(limit = 20): SyncRun[] {
    const rows = this.db.prepare('SELECT * FROM sync_runs ORDER BY started_at DESC LIMIT ?').all(limit) as any[];
    return rows.map(r => ({
      id: r.id,
      trigger_type: r.trigger_type,
      started_at: r.started_at,
      completed_at: r.completed_at,
      duration_ms: r.duration_ms,
      status: r.status,
      events_found: r.events_found,
      events_new: r.events_new,
      events_updated: r.events_updated,
      events_unchanged: r.events_unchanged,
      events_failed: r.events_failed,
      pages_crawled: r.pages_crawled,
      page_limit_reached: Boolean(r.page_limit_reached),
      error_message: r.error_message,
      logs: JSON.parse(r.logs_json || '[]')
    }));
  }

  public getLastSuccessfulSync(): SyncRun | null {
    const row = this.db.prepare("SELECT * FROM sync_runs WHERE status = 'completed' ORDER BY completed_at DESC LIMIT 1").get() as any;
    if (!row) return null;
    return {
      id: row.id,
      trigger_type: row.trigger_type,
      started_at: row.started_at,
      completed_at: row.completed_at,
      duration_ms: row.duration_ms,
      status: row.status,
      events_found: row.events_found,
      events_new: row.events_new,
      events_updated: row.events_updated,
      events_unchanged: row.events_unchanged,
      events_failed: row.events_failed,
      pages_crawled: row.pages_crawled,
      page_limit_reached: Boolean(row.page_limit_reached),
      error_message: row.error_message,
      logs: JSON.parse(row.logs_json || '[]')
    };
  }

  // --- STATS & METRICS ---

  public getStats() {
    const totalEvents = (this.db.prepare('SELECT COUNT(*) as count FROM wusa_events').get() as any)?.count || 0;
    const upcoming = (this.db.prepare("SELECT COUNT(*) as count FROM wusa_events WHERE temporal_status = 'upcoming'").get() as any)?.count || 0;
    const ongoing = (this.db.prepare("SELECT COUNT(*) as count FROM wusa_events WHERE temporal_status = 'ongoing'").get() as any)?.count || 0;
    const past = (this.db.prepare("SELECT COUNT(*) as count FROM wusa_events WHERE temporal_status = 'past'").get() as any)?.count || 0;
    const cancelled = (this.db.prepare("SELECT COUNT(*) as count FROM wusa_events WHERE cancellation_status = 'cancelled'").get() as any)?.count || 0;
    const needsReview = (this.db.prepare("SELECT COUNT(*) as count FROM wusa_events WHERE review_status = 'needs_review'").get() as any)?.count || 0;
    const approved = (this.db.prepare("SELECT COUNT(*) as count FROM wusa_events WHERE approval_status = 'approved'").get() as any)?.count || 0;
    const pending = (this.db.prepare("SELECT COUNT(*) as count FROM wusa_events WHERE approval_status = 'pending'").get() as any)?.count || 0;
    const seriesCount = (this.db.prepare('SELECT COUNT(*) as count FROM recurring_series').get() as any)?.count || 0;

    const categoriesRows = this.db.prepare('SELECT category, COUNT(*) as count FROM wusa_events GROUP BY category ORDER BY count DESC').all() as any[];

    return {
      totalEvents,
      upcoming,
      ongoing,
      past,
      cancelled,
      needsReview,
      approved,
      pending,
      seriesCount,
      categories: categoriesRows.map(r => ({ category: r.category, count: r.count })),
      lastSuccessfulSync: this.getLastSuccessfulSync()
    };
  }

  // Helper row mapper
  private mapRowToEvent(r: any): WusaStoredEvent {
    return {
      id: r.id,
      title: r.title,
      slug: r.slug,
      description: r.description,
      description_text: r.description_text,
      excerpt: r.excerpt,
      organizer: r.organizer_json ? JSON.parse(r.organizer_json) : null,
      start_date: r.start_date,
      end_date: r.end_date,
      start_iso: r.start_iso,
      end_iso: r.end_iso,
      start_utc: r.start_utc ?? null,
      end_utc: r.end_utc ?? null,
      timezone: r.timezone,
      all_day: Boolean(r.all_day),
      venue: r.venue_json ? JSON.parse(r.venue_json) : null,
      category: r.category,
      categories: JSON.parse(r.categories_json || '[]'),
      cost: r.cost,
      registration_url: r.registration_url,
      registration_deadline: r.registration_deadline,
      source: (r.source as 'wusa' | 'community_sheet' | 'community_ics') || 'wusa',
      source_url: r.source_url ?? null,
      source_image_url: r.source_image_url,
      original_wusa_url: r.original_wusa_url,
      cancellation_status: r.cancellation_status,
      temporal_status: r.temporal_status,
      is_multi_day: Boolean(r.is_multi_day),
      is_recurring: Boolean(r.is_recurring),
      series_id: r.series_id,
      recurrence_rule: r.recurrence_rule,
      review_status: r.review_status,
      review_flags: JSON.parse(r.review_flags_json || '[]'),
      approval_status: r.approval_status,
      admin_notes: r.admin_notes,
      content_hash: r.content_hash,
      first_imported_at: r.first_imported_at,
      last_checked_at: r.last_checked_at,
      last_changed_at: r.last_changed_at,
      raw_payload: r.raw_payload
    };
  }
}

// Singleton database instance
export const db = new CollectorDatabase();
