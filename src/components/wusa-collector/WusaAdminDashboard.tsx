import React, { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw,
  Calendar,
  Clock,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Edit3,
  Download,
  Search,
  Filter,
  ShieldCheck,
  Layers,
  FileText,
  Database,
  Settings,
  Eye,
  Lock,
  Check,
  DollarSign,
  User,
  Tag,
  ChevronRight,
  ArrowUpRight,
  Sliders,
  History,
  Copy,
  Terminal
} from 'lucide-react';

interface StoredEvent {
  id: string;
  title: string;
  slug: string | null;
  description: string;
  description_text: string;
  excerpt: string | null;
  organizer: { name: string; email?: string; website?: string; phone?: string } | null;
  start_date: string;
  end_date: string | null;
  start_iso: string;
  end_iso: string | null;
  timezone: string;
  all_day: boolean;
  venue: {
    name: string;
    room?: string | null;
    address?: string | null;
    city?: string | null;
    province?: string | null;
    postal_code?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  } | null;
  category: string;
  categories: string[];
  cost: string | null;
  registration_url: string | null;
  registration_deadline: string | null;
  source_image_url: string | null;
  original_wusa_url: string;
  cancellation_status: 'scheduled' | 'cancelled' | 'postponed';
  temporal_status: 'upcoming' | 'ongoing' | 'past';
  is_multi_day: boolean;
  is_recurring: boolean;
  series_id: string | null;
  recurrence_rule: string | null;
  review_status: 'clean' | 'needs_review';
  review_flags: string[];
  approval_status: 'pending' | 'approved' | 'rejected';
  admin_notes: string | null;
  content_hash: string;
  first_imported_at: string;
  last_checked_at: string;
  last_changed_at: string;
}

interface SyncRun {
  id: string;
  trigger_type: 'manual' | 'scheduled';
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  status: 'in_progress' | 'completed' | 'failed' | 'incomplete';
  events_found: number;
  events_new: number;
  events_updated: number;
  events_unchanged: number;
  events_failed: number;
  pages_crawled: number;
  page_limit_reached: boolean;
  error_message: string | null;
  logs: string[];
}

interface RecurringSeries {
  id: string;
  title: string;
  slug_base: string;
  recurrence_description: string | null;
  total_occurrences: number;
  first_occurrence: string | null;
  last_occurrence: string | null;
  created_at: string;
  updated_at: string;
}

interface ChangeHistoryItem {
  id: number;
  event_id: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  changed_at: string;
  sync_run_id: string | null;
}

interface CollectorConfig {
  past_days_scope: number;
  future_days_scope: number;
  daily_sync_time: string;
  frequency_mode: 'daily' | 'hourly' | 'every_6h' | 'every_12h';
  page_limit: number;
  request_delay_ms: number;
  auto_sync_enabled: boolean;
  detail_enrichment_enabled: boolean;
}

interface DashboardStats {
  totalEvents: number;
  upcoming: number;
  ongoing: number;
  past: number;
  cancelled: number;
  needsReview: number;
  approved: number;
  pending: number;
  seriesCount: number;
  categories: Array<{ category: string; count: number }>;
  lastSuccessfulSync: SyncRun | null;
}

export const WusaAdminDashboard: React.FC<{ onBackToWatHive?: () => void }> = ({ onBackToWatHive }) => {
  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return Boolean(localStorage.getItem('wusa_collector_auth'));
  });
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Active View Tab
  const [activeTab, setActiveTab] = useState<'events' | 'series' | 'runs' | 'config' | 'preview'>('events');

  // Core Data States
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [events, setEvents] = useState<StoredEvent[]>([]);
  const [totalEventsCount, setTotalEventsCount] = useState(0);
  const [recurringSeries, setRecurringSeries] = useState<RecurringSeries[]>([]);
  const [syncRuns, setSyncRuns] = useState<SyncRun[]>([]);
  const [config, setConfig] = useState<CollectorConfig | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState('');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'upcoming' | 'ongoing' | 'past' | 'cancelled' | 'needs_review'>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [approvalFilter, setApprovalFilter] = useState('all');
  const [page, setPage] = useState(1);
  const limit = 20;

  // Selected Event Drawer / Modal
  const [selectedEvent, setSelectedEvent] = useState<StoredEvent | null>(null);
  const [eventHistory, setEventHistory] = useState<ChangeHistoryItem[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState<Partial<StoredEvent>>({});
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  // WatHive Preview Data
  const [previewData, setPreviewData] = useState<any>(null);

  // Load Status & Stats
  const fetchStatusAndStats = useCallback(async () => {
    try {
      const res = await fetch('/api/collector/status');
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
        if (data.config) setConfig(data.config);
        setIsSyncing(data.isBusy);
      }
    } catch (err) {
      console.error('Failed to load collector status:', err);
    }
  }, []);

  // Load Events with Filters
  const fetchEvents = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit)
      });
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      if (statusFilter === 'cancelled') {
        params.append('status', 'cancelled');
      } else if (statusFilter === 'needs_review') {
        params.append('review_status', 'needs_review');
      } else if (statusFilter !== 'all') {
        params.append('temporal_status', statusFilter);
      }
      if (categoryFilter !== 'all') params.append('category', categoryFilter);
      if (approvalFilter !== 'all') params.append('approval_status', approvalFilter);

      const res = await fetch(`/api/collector/events?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setEvents(data.events);
        setTotalEventsCount(data.total);
      }
    } catch (err) {
      console.error('Failed to load events:', err);
    }
  }, [page, searchQuery, statusFilter, categoryFilter, approvalFilter]);

  // Load Recurring Series
  const fetchSeries = useCallback(async () => {
    try {
      const res = await fetch('/api/collector/series');
      const data = await res.json();
      if (data.success) {
        setRecurringSeries(data.series);
      }
    } catch (err) {
      console.error('Failed to load series:', err);
    }
  }, []);

  // Load Runs
  const fetchRuns = useCallback(async () => {
    try {
      const res = await fetch('/api/collector/runs');
      const data = await res.json();
      if (data.success) {
        setSyncRuns(data.runs);
      }
    } catch (err) {
      console.error('Failed to load runs:', err);
    }
  }, []);

  // Load Preview Data
  const fetchPreview = useCallback(async () => {
    try {
      const res = await fetch('/api/collector/preview');
      const data = await res.json();
      if (data.success) {
        setPreviewData(data);
      }
    } catch (err) {
      console.error('Failed to load preview:', err);
    }
  }, []);

  // Initial Load when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchStatusAndStats();
      fetchEvents();
      fetchSeries();
      fetchRuns();
      fetchPreview();
    }
  }, [isAuthenticated, fetchStatusAndStats, fetchEvents, fetchSeries, fetchRuns, fetchPreview]);

  // Handle Event Selection
  const handleSelectEvent = async (ev: StoredEvent) => {
    setSelectedEvent(ev);
    setIsEditing(false);
    setEditFormData({
      title: ev.title,
      description: ev.description,
      cost: ev.cost,
      registration_url: ev.registration_url,
      start_date: ev.start_date,
      end_date: ev.end_date,
      approval_status: ev.approval_status,
      admin_notes: ev.admin_notes
    });
    setSaveSuccessMsg('');
    try {
      const res = await fetch(`/api/collector/events/${ev.id}`);
      const data = await res.json();
      if (data.success) {
        setEventHistory(data.history || []);
      }
    } catch (err) {
      console.error('Failed to fetch event history:', err);
    }
  };

  // Trigger Manual Sync
  const handleTriggerSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncStatusMsg('Syncing in progress: fetching WUSA listings and verifying event details...');
    try {
      const res = await fetch('/api/collector/sync', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setSyncStatusMsg(`Sync completed! New: ${data.run.events_new}, Updated: ${data.run.events_updated}, Unchanged: ${data.run.events_unchanged}`);
        await fetchStatusAndStats();
        await fetchEvents();
        await fetchSeries();
        await fetchRuns();
        await fetchPreview();
      } else {
        setSyncStatusMsg(`Sync failed: ${data.error}`);
      }
    } catch (err: any) {
      setSyncStatusMsg(`Network error: ${err.message}`);
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncStatusMsg(''), 6000);
    }
  };

  // Save Event Manual Edits
  const handleSaveEventEdits = async () => {
    if (!selectedEvent) return;
    try {
      const res = await fetch(`/api/collector/events/${selectedEvent.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: editFormData })
      });
      const data = await res.json();
      if (data.success) {
        setSelectedEvent(data.event);
        setEventHistory(data.history || []);
        setIsEditing(false);
        setSaveSuccessMsg('Event updated and audit record logged!');
        fetchEvents();
        fetchStatusAndStats();
        setTimeout(() => setSaveSuccessMsg(''), 4000);
      }
    } catch (err: any) {
      alert(`Save failed: ${err.message}`);
    }
  };

  // Quick Approval Toggle
  const handleQuickApproval = async (ev: StoredEvent, newApproval: 'approved' | 'rejected' | 'pending') => {
    try {
      const res = await fetch(`/api/collector/events/${ev.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: { approval_status: newApproval } })
      });
      const data = await res.json();
      if (data.success) {
        if (selectedEvent?.id === ev.id) {
          setSelectedEvent(data.event);
        }
        fetchEvents();
        fetchStatusAndStats();
      }
    } catch (err: any) {
      console.error('Failed to update approval:', err);
    }
  };

  // Resolve Review Flag
  const handleResolveReview = async (ev: StoredEvent) => {
    try {
      const res = await fetch(`/api/collector/events/${ev.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: {
            review_status: 'clean',
            review_flags: [],
            admin_notes: (ev.admin_notes ? ev.admin_notes + ' | ' : '') + 'Review cleared by admin'
          }
        })
      });
      const data = await res.json();
      if (data.success) {
        setSelectedEvent(data.event);
        fetchEvents();
        fetchStatusAndStats();
      }
    } catch (err: any) {
      console.error('Failed to resolve review:', err);
    }
  };

  // Config Update
  const handleSaveConfig = async (newConfig: Partial<CollectorConfig>) => {
    try {
      const res = await fetch('/api/collector/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: newConfig })
      });
      const data = await res.json();
      if (data.success) {
        setConfig(data.config);
        alert('Configuration saved and scheduler updated!');
      }
    } catch (err: any) {
      alert(`Config save error: ${err.message}`);
    }
  };

  // Auth Submit
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthenticating(true);
    setAuthError('');
    try {
      const res = await fetch('/api/collector/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordInput })
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('wusa_collector_auth', 'true');
        setIsAuthenticated(true);
      } else {
        setAuthError(data.error || 'Invalid credentials');
      }
    } catch (err: any) {
      setAuthError('Connection error to server API');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('wusa_collector_auth');
    setIsAuthenticated(false);
  };

  // --- PRIVATE AUTH GATE SCREEN ---
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-stone-900 text-stone-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-stone-950 border border-stone-800 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-400" />
          
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 mx-auto mb-5">
            <ShieldCheck className="w-7 h-7" />
          </div>

          <div className="text-center mb-6">
            <span className="text-xs uppercase tracking-widest font-mono text-amber-400/90 font-semibold">
              WatHive Infrastructure
            </span>
            <h1 className="text-2xl font-bold text-stone-100 mt-1">WUSA Event Collector</h1>
            <p className="text-sm text-stone-400 mt-2">
              Private administrative console for managing campus event aggregation and verification.
            </p>
          </div>

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-stone-300 mb-1.5">
                Admin Master Secret
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Enter administrator password..."
                  className="w-full bg-stone-900 border border-stone-700 rounded-xl px-4 py-2.5 text-stone-100 placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                  required
                />
                <Lock className="w-4 h-4 text-stone-500 absolute right-3.5 top-3" />
              </div>
              <p className="text-xs text-stone-500 mt-1.5">
                Default server credential: <code className="text-amber-400 bg-stone-900 px-1.5 py-0.5 rounded">wathive_admin_2026</code>
              </p>
            </div>

            {authError && (
              <div className="p-3 rounded-xl bg-red-950/50 border border-red-800/80 text-xs text-red-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{authError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isAuthenticating}
              className="w-full bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 disabled:opacity-50"
            >
              {isAuthenticating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  Access Collector Console
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {onBackToWatHive && (
            <div className="mt-6 text-center border-t border-stone-800/80 pt-4">
              <button
                onClick={onBackToWatHive}
                className="text-xs text-stone-400 hover:text-stone-200 transition-colors"
              >
                ← Return to WatHive Campus App
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- AUTHENTICATED ADMIN CONSOLE ---
  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col font-sans antialiased">
      {/* Top Notification / Banner */}
      {syncStatusMsg && (
        <div className="bg-amber-500 text-stone-950 px-4 py-2 text-xs font-medium text-center flex items-center justify-center gap-2 transition-all">
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>{syncStatusMsg}</span>
        </div>
      )}

      {/* Main Header */}
      <header className="border-b border-stone-800 bg-stone-950/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-stone-950 font-black shadow-md shadow-amber-500/10">
              W
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-stone-100">WUSA Event Collector</h1>
                <span className="bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] uppercase font-mono px-2 py-0.5 rounded-full font-semibold">
                  Private Admin
                </span>
                <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  SQLite WAL Active
                </span>
              </div>
              <p className="text-xs text-stone-400 flex items-center gap-2">
                <span>Source: <a href="https://wusa.ca/events/" target="_blank" rel="noreferrer" className="underline hover:text-amber-400">wusa.ca/events</a></span>
                <span>•</span>
                <span>Scheduler: Daily 6:00 AM America/Toronto</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {onBackToWatHive && (
              <button
                onClick={onBackToWatHive}
                className="text-xs bg-stone-900 hover:bg-stone-800 text-stone-300 border border-stone-700 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
              >
                WatHive Frontend
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              onClick={handleTriggerSync}
              disabled={isSyncing}
              className="bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-semibold px-4 py-2 rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-amber-500/20 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Sync in Progress...' : 'Sync Now'}
            </button>

            <button
              onClick={handleLogout}
              className="text-xs text-stone-400 hover:text-stone-200 p-2 rounded-lg hover:bg-stone-900 transition-colors"
              title="Logout"
            >
              <Lock className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex overflow-x-auto space-x-1 border-t border-stone-800/60 pt-1">
          <button
            onClick={() => setActiveTab('events')}
            className={`px-3.5 py-2 text-xs font-medium rounded-t-lg transition-colors flex items-center gap-2 border-b-2 whitespace-nowrap ${
              activeTab === 'events'
                ? 'border-amber-400 text-amber-400 bg-stone-900/40'
                : 'border-transparent text-stone-400 hover:text-stone-200'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            Events Database ({stats?.totalEvents || 0})
          </button>

          <button
            onClick={() => setActiveTab('series')}
            className={`px-3.5 py-2 text-xs font-medium rounded-t-lg transition-colors flex items-center gap-2 border-b-2 whitespace-nowrap ${
              activeTab === 'series'
                ? 'border-amber-400 text-amber-400 bg-stone-900/40'
                : 'border-transparent text-stone-400 hover:text-stone-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Recurring Series ({recurringSeries.length})
          </button>

          <button
            onClick={() => setActiveTab('runs')}
            className={`px-3.5 py-2 text-xs font-medium rounded-t-lg transition-colors flex items-center gap-2 border-b-2 whitespace-nowrap ${
              activeTab === 'runs'
                ? 'border-amber-400 text-amber-400 bg-stone-900/40'
                : 'border-transparent text-stone-400 hover:text-stone-200'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Sync Runs & Audit ({syncRuns.length})
          </button>

          <button
            onClick={() => setActiveTab('preview')}
            className={`px-3.5 py-2 text-xs font-medium rounded-t-lg transition-colors flex items-center gap-2 border-b-2 whitespace-nowrap ${
              activeTab === 'preview'
                ? 'border-amber-400 text-amber-400 bg-stone-900/40'
                : 'border-transparent text-stone-400 hover:text-stone-200'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            WatHive Integration Preview
          </button>

          <button
            onClick={() => setActiveTab('config')}
            className={`px-3.5 py-2 text-xs font-medium rounded-t-lg transition-colors flex items-center gap-2 border-b-2 whitespace-nowrap ${
              activeTab === 'config'
                ? 'border-amber-400 text-amber-400 bg-stone-900/40'
                : 'border-transparent text-stone-400 hover:text-stone-200'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            Scheduler & Architecture
          </button>
        </div>
      </header>

      {/* Main Dashboard Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-stone-900/70 border border-stone-800 rounded-xl p-3.5">
            <span className="text-[11px] uppercase tracking-wider font-mono text-stone-400">Total Collected</span>
            <div className="text-2xl font-bold text-stone-100 mt-1">{stats?.totalEvents ?? '—'}</div>
            <span className="text-[10px] text-stone-500">Persistent in SQLite</span>
          </div>

          <div className="bg-stone-900/70 border border-stone-800 rounded-xl p-3.5">
            <span className="text-[11px] uppercase tracking-wider font-mono text-emerald-400">Upcoming / Live</span>
            <div className="text-2xl font-bold text-emerald-400 mt-1">
              {(stats?.upcoming ?? 0) + (stats?.ongoing ?? 0)}
            </div>
            <span className="text-[10px] text-stone-500">America/Toronto time</span>
          </div>

          <div className="bg-stone-900/70 border border-stone-800 rounded-xl p-3.5">
            <span className="text-[11px] uppercase tracking-wider font-mono text-stone-400">Past Preserved</span>
            <div className="text-2xl font-bold text-stone-300 mt-1">{stats?.past ?? '—'}</div>
            <span className="text-[10px] text-stone-500">Never deleted</span>
          </div>

          <div className="bg-stone-900/70 border border-amber-900/40 rounded-xl p-3.5">
            <span className="text-[11px] uppercase tracking-wider font-mono text-amber-400">Needs Review</span>
            <div className="text-2xl font-bold text-amber-400 mt-1">{stats?.needsReview ?? '—'}</div>
            <span className="text-[10px] text-amber-500/80">Ambiguous dates/links</span>
          </div>

          <div className="bg-stone-900/70 border border-stone-800 rounded-xl p-3.5">
            <span className="text-[11px] uppercase tracking-wider font-mono text-rose-400">Cancellations</span>
            <div className="text-2xl font-bold text-rose-400 mt-1">{stats?.cancelled ?? 0}</div>
            <span className="text-[10px] text-stone-500">Explicitly flagged</span>
          </div>

          <div className="bg-stone-900/70 border border-stone-800 rounded-xl p-3.5">
            <span className="text-[11px] uppercase tracking-wider font-mono text-purple-400">Recurring Series</span>
            <div className="text-2xl font-bold text-purple-400 mt-1">{stats?.seriesCount ?? '—'}</div>
            <span className="text-[10px] text-stone-500">Separate from occurrences</span>
          </div>
        </div>

        {/* TAB 1: EVENTS DATABASE */}
        {activeTab === 'events' && (
          <div className="space-y-4">
            {/* Filter Controls Bar */}
            <div className="bg-stone-900/80 border border-stone-800 rounded-xl p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="w-4 h-4 text-stone-500 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search events by title, venue, organizer, ID..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                  className="w-full bg-stone-950 border border-stone-800 rounded-lg pl-9 pr-4 py-2 text-xs text-stone-100 placeholder-stone-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Status Selector */}
                <select
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value as any); setPage(1); }}
                  className="bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-xs text-stone-300 focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <option value="all">Status: All Records</option>
                  <option value="upcoming">Status: Upcoming Only</option>
                  <option value="ongoing">Status: Ongoing Now</option>
                  <option value="past">Status: Past Events</option>
                  <option value="needs_review">Flag: Needs Review Only</option>
                  <option value="cancelled">Status: Canceled</option>
                </select>

                {/* Category Selector */}
                <select
                  value={categoryFilter}
                  onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
                  className="bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-xs text-stone-300 focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <option value="all">Category: All</option>
                  {stats?.categories?.map((c) => (
                    <option key={c.category} value={c.category}>
                      {c.category} ({c.count})
                    </option>
                  ))}
                </select>

                {/* Approval Selector */}
                <select
                  value={approvalFilter}
                  onChange={(e) => { setApprovalFilter(e.target.value); setPage(1); }}
                  className="bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-xs text-stone-300 focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <option value="all">Approval: All</option>
                  <option value="approved">Approved</option>
                  <option value="pending">Pending</option>
                  <option value="rejected">Rejected</option>
                </select>

                {/* Export Dropdown */}
                <div className="flex items-center gap-1.5 border-l border-stone-800 pl-2">
                  <a
                    href="/api/collector/export/csv"
                    className="bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs px-2.5 py-2 rounded-lg flex items-center gap-1.5 transition-colors"
                    title="Export CSV"
                  >
                    <Download className="w-3.5 h-3.5" />
                    CSV
                  </a>
                  <a
                    href="/api/collector/export/json"
                    className="bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs px-2.5 py-2 rounded-lg flex items-center gap-1.5 transition-colors"
                    title="Export JSON"
                  >
                    <Download className="w-3.5 h-3.5" />
                    JSON
                  </a>
                </div>
              </div>
            </div>

            {/* Events Table */}
            <div className="bg-stone-900/60 border border-stone-800 rounded-xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-stone-300">
                  <thead className="bg-stone-950/80 text-[11px] uppercase font-mono tracking-wider text-stone-400 border-b border-stone-800">
                    <tr>
                      <th className="py-3 px-4">Event ID / Title</th>
                      <th className="py-3 px-4">Date & Time (Toronto)</th>
                      <th className="py-3 px-4">Venue / Location</th>
                      <th className="py-3 px-4">Cost / Price</th>
                      <th className="py-3 px-4">Classification</th>
                      <th className="py-3 px-4">Review / Flags</th>
                      <th className="py-3 px-4">Approval</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-800/60">
                    {events.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center py-12 text-stone-500">
                          {isSyncing ? (
                            <div className="flex flex-col items-center gap-2">
                              <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
                              <span>Importing live records from WUSA...</span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-2">
                              <Database className="w-6 h-6 text-stone-600" />
                              <span>No events found matching current criteria.</span>
                              <button
                                onClick={handleTriggerSync}
                                className="text-amber-400 underline hover:text-amber-300 text-xs"
                              >
                                Trigger manual import now
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ) : (
                      events.map((ev) => (
                        <tr
                          key={ev.id}
                          className="hover:bg-stone-800/40 transition-colors cursor-pointer"
                          onClick={() => handleSelectEvent(ev)}
                        >
                          {/* Title & ID */}
                          <td className="py-3 px-4 max-w-xs">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className="font-mono text-[10px] text-amber-400/90 bg-amber-500/10 px-1 rounded">
                                #{ev.id}
                              </span>
                              {ev.is_multi_day && (
                                <span className="text-[10px] bg-blue-500/10 text-blue-400 px-1 rounded border border-blue-500/20">
                                  Multi-Day
                                </span>
                              )}
                              {ev.is_recurring && (
                                <span className="text-[10px] bg-purple-500/10 text-purple-400 px-1 rounded border border-purple-500/20">
                                  Recurring
                                </span>
                              )}
                            </div>
                            <div className="font-semibold text-stone-100 hover:text-amber-400 truncate">
                              {ev.title}
                            </div>
                            <div className="text-[10px] text-stone-500 truncate">
                              {ev.organizer?.name || 'WUSA'}
                            </div>
                          </td>

                          {/* Date & Time */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="font-mono text-[11px] text-stone-200">
                              {ev.start_date.slice(0, 10)}
                            </div>
                            <div className="text-[10px] text-stone-400 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-stone-500" />
                              {ev.all_day ? 'All-Day' : `${ev.start_date.slice(11, 16)} ${ev.end_date ? '– ' + ev.end_date.slice(11, 16) : '(no end time)'}`}
                            </div>
                          </td>

                          {/* Venue */}
                          <td className="py-3 px-4 max-w-[200px]">
                            <div className="truncate text-stone-200 font-medium">
                              {ev.venue?.name || 'Campus'}
                            </div>
                            <div className="text-[10px] text-stone-400 truncate">
                              {ev.venue?.room ? `${ev.venue.room}` : (ev.venue?.address || 'Waterloo, ON')}
                            </div>
                          </td>

                          {/* Price */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-mono ${
                              !ev.cost || ev.cost.toLowerCase().includes('free')
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                            }`}>
                              {ev.cost || 'Free / Unknown'}
                            </span>
                          </td>

                          {/* Classification */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className={`inline-block text-[10px] px-2 py-0.5 rounded uppercase font-mono ${
                              ev.temporal_status === 'upcoming'
                                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                : ev.temporal_status === 'ongoing'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold'
                                : 'bg-stone-800 text-stone-400'
                            }`}>
                              {ev.temporal_status}
                            </span>
                          </td>

                          {/* Review Flags */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            {ev.review_status === 'needs_review' ? (
                              <div className="flex items-center gap-1 text-amber-400" title={ev.review_flags.join(', ')}>
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                <span className="text-[11px] underline font-medium">
                                  {ev.review_flags.length} Flag{ev.review_flags.length > 1 ? 's' : ''}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[10px] text-emerald-400/80 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                Clean
                              </span>
                            )}
                          </td>

                          {/* Approval Status */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className={`inline-block text-[10px] font-mono px-2 py-0.5 rounded uppercase ${
                              ev.approval_status === 'approved'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : ev.approval_status === 'rejected'
                                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                : 'bg-stone-800 text-amber-300'
                            }`}>
                              {ev.approval_status}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              <a
                                href={ev.original_wusa_url}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1.5 text-stone-400 hover:text-stone-100 rounded hover:bg-stone-800"
                                title="View original WUSA event page"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                              <button
                                onClick={() => handleSelectEvent(ev)}
                                className="p-1.5 text-stone-400 hover:text-amber-400 rounded hover:bg-stone-800"
                                title="Inspect & Edit Details"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination controls */}
              <div className="bg-stone-950/90 border-t border-stone-800 px-4 py-3 flex items-center justify-between text-xs text-stone-400">
                <div>
                  Showing {events.length} of {totalEventsCount} records
                </div>
                <div className="flex items-center gap-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage(page - 1)}
                    className="px-3 py-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-200 disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <span className="font-mono text-stone-300">Page {page}</span>
                  <button
                    disabled={events.length < limit}
                    onClick={() => setPage(page + 1)}
                    className="px-3 py-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-200 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: RECURRING SERIES & MULTI-DAY */}
        {activeTab === 'series' && (
          <div className="space-y-6">
            <div className="bg-stone-900/80 border border-stone-800 rounded-xl p-5">
              <h2 className="text-base font-bold text-stone-100 flex items-center gap-2">
                <Layers className="w-5 h-5 text-purple-400" />
                Recurring Event Series
              </h2>
              <p className="text-xs text-stone-400 mt-1">
                WUSA publishes recurring events as separate occurrences (e.g., Fruit & Veggie Market, Winter Warm-Up).
                WatHive groups them into parent recurring series while storing each verified occurrence separately.
                <strong> Note: Multi-day events are strictly separated from recurring series.</strong>
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {recurringSeries.map((s) => (
                <div key={s.id} className="bg-stone-900/60 border border-stone-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-mono text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded uppercase">
                        Series #{s.id}
                      </span>
                      <h3 className="text-sm font-bold text-stone-100 mt-1">{s.title}</h3>
                    </div>
                    <span className="bg-stone-800 text-stone-300 text-xs px-2.5 py-1 rounded-full font-mono">
                      {s.total_occurrences} Occurrences
                    </span>
                  </div>

                  <p className="text-xs text-stone-400">
                    {s.recurrence_description || 'Confirmed schedule from WUSA'}
                  </p>

                  <div className="text-[11px] font-mono text-stone-400 bg-stone-950 p-2 rounded-lg flex items-center justify-between">
                    <span>First: {s.first_occurrence || '—'}</span>
                    <span>Latest: {s.last_occurrence || '—'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: SYNC RUNS & AUDIT LOGS */}
        {activeTab === 'runs' && (
          <div className="space-y-4">
            <div className="bg-stone-900/80 border border-stone-800 rounded-xl p-4">
              <h2 className="text-sm font-bold text-stone-100 flex items-center gap-2">
                <History className="w-4 h-4 text-amber-400" />
                Collection Execution History & Error Logs
              </h2>
              <p className="text-xs text-stone-400 mt-1">
                Audits of manual and 6:00 AM America/Toronto scheduled collection cycles, duration, and page limit stops.
              </p>
            </div>

            <div className="space-y-3">
              {syncRuns.map((r) => (
                <div key={r.id} className="bg-stone-900/60 border border-stone-800 rounded-xl p-4 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-stone-200">{r.id}</span>
                      <span className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded ${
                        r.status === 'completed'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : r.status === 'incomplete'
                          ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}>
                        {r.status}
                      </span>
                      <span className="text-[10px] bg-stone-800 text-stone-400 px-2 py-0.5 rounded uppercase font-mono">
                        {r.trigger_type}
                      </span>
                    </div>

                    <div className="text-xs text-stone-400 font-mono">
                      Duration: {r.duration_ms ? `${(r.duration_ms / 1000).toFixed(1)}s` : 'running...'} | {new Date(r.started_at).toLocaleString()}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs font-mono bg-stone-950 p-2.5 rounded-lg text-stone-300">
                    <div>Found: <span className="text-stone-100">{r.events_found}</span></div>
                    <div>New: <span className="text-emerald-400">{r.events_new}</span></div>
                    <div>Updated: <span className="text-blue-400">{r.events_updated}</span></div>
                    <div>Unchanged: <span className="text-stone-400">{r.events_unchanged}</span></div>
                    <div>Failed: <span className="text-rose-400">{r.events_failed}</span></div>
                  </div>

                  {/* Logs toggle / snippet */}
                  {r.logs && r.logs.length > 0 && (
                    <div className="mt-2 bg-stone-950/90 rounded-lg p-3 text-[11px] font-mono text-stone-400 space-y-1 max-h-40 overflow-y-auto">
                      {r.logs.map((l, idx) => (
                        <div key={idx} className="truncate">{l}</div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: WATHIVE PREVIEW */}
        {activeTab === 'preview' && (
          <div className="space-y-6">
            <div className="bg-stone-900/80 border border-stone-800 rounded-xl p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-base font-bold text-stone-100 flex items-center gap-2">
                    <Eye className="w-5 h-5 text-amber-400" />
                    WatHive Consumption Preview (Contract Testing)
                  </h2>
                  <p className="text-xs text-stone-400 mt-1">
                    This previews the exact normalized data structure that WatHive will ingest.
                    The collector remains completely decoupled from the student UI until approval.
                  </p>
                </div>
                <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs px-3 py-1.5 rounded-xl font-mono">
                  Schema: EventItem Interface
                </div>
              </div>
            </div>

            {/* Field Mapping Matrix */}
            <div className="bg-stone-900/60 border border-stone-800 rounded-xl p-5">
              <h3 className="text-xs font-mono uppercase tracking-wider text-stone-400 mb-3">
                Field Transformation & Harmonization Matrix
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                <div className="bg-stone-950 p-3 rounded-lg border border-stone-800">
                  <div className="text-stone-400 font-mono">WUSA ID → WatHive ID</div>
                  <div className="font-semibold text-stone-200 mt-0.5">245501 → wusa_245501</div>
                </div>
                <div className="bg-stone-950 p-3 rounded-lg border border-stone-800">
                  <div className="text-stone-400 font-mono">Categories → Taxonomy</div>
                  <div className="font-semibold text-stone-200 mt-0.5">Mates / Social → Social events</div>
                </div>
                <div className="bg-stone-950 p-3 rounded-lg border border-stone-800">
                  <div className="text-stone-400 font-mono">Timezone Handling</div>
                  <div className="font-semibold text-stone-200 mt-0.5">America/Toronto with DST ISO-8601</div>
                </div>
                <div className="bg-stone-950 p-3 rounded-lg border border-stone-800">
                  <div className="text-stone-400 font-mono">Cost Normalization</div>
                  <div className="font-semibold text-stone-200 mt-0.5">Preserves ranges: "$15.00 – $20.00"</div>
                </div>
                <div className="bg-stone-950 p-3 rounded-lg border border-stone-800">
                  <div className="text-stone-400 font-mono">Source Verification</div>
                  <div className="font-semibold text-stone-200 mt-0.5">Tagged: "wusa_official"</div>
                </div>
                <div className="bg-stone-950 p-3 rounded-lg border border-stone-800">
                  <div className="text-stone-400 font-mono">Moderation Gateway</div>
                  <div className="font-semibold text-stone-200 mt-0.5">Admin approval required before publication</div>
                </div>
              </div>
            </div>

            {/* JSON Schema Sample */}
            <div className="bg-stone-900/60 border border-stone-800 rounded-xl p-5 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-mono uppercase text-stone-400">Sample Transformed Event (JSON)</h3>
                <span className="text-[11px] text-stone-500 font-mono">First 50 items mapped</span>
              </div>
              <pre className="bg-stone-950 text-emerald-400 font-mono text-xs p-4 rounded-xl overflow-x-auto max-h-96 border border-stone-800">
                {previewData?.previewEvents?.[0]
                  ? JSON.stringify(previewData.previewEvents[0], null, 2)
                  : '// No events in database yet. Trigger manual sync to populate preview.'}
              </pre>
            </div>
          </div>
        )}

        {/* TAB 5: SCHEDULER & ARCHITECTURE */}
        {activeTab === 'config' && (
          <div className="space-y-6">
            <div className="bg-stone-900/80 border border-stone-800 rounded-xl p-5">
              <h2 className="text-base font-bold text-stone-100 flex items-center gap-2">
                <Settings className="w-5 h-5 text-amber-400" />
                Scheduler Configuration & Production Architecture
              </h2>
              <p className="text-xs text-stone-400 mt-1">
                Configure background sync frequency, date range windows, page limits, and rate limits.
              </p>
            </div>

            {config && (
              <div className="bg-stone-900/60 border border-stone-800 rounded-xl p-5 space-y-5">
                <h3 className="text-xs font-mono uppercase tracking-wider text-amber-400">Collection Parameters</h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-stone-300 mb-1">
                      Daily Sync Time (America/Toronto)
                    </label>
                    <input
                      type="text"
                      value={config.daily_sync_time}
                      onChange={(e) => setConfig({ ...config, daily_sync_time: e.target.value })}
                      placeholder="06:00"
                      className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-xs font-mono text-stone-100"
                    />
                    <span className="text-[10px] text-stone-500">Default: 06:00 AM Eastern Time</span>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-300 mb-1">
                      Sync Frequency Mode
                    </label>
                    <select
                      value={config.frequency_mode}
                      onChange={(e) => setConfig({ ...config, frequency_mode: e.target.value as any })}
                      className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-xs text-stone-100"
                    >
                      <option value="daily">Daily at specified time (6:00 AM)</option>
                      <option value="every_6h">Every 6 Hours</option>
                      <option value="every_12h">Every 12 Hours</option>
                      <option value="hourly">Hourly (Testing mode)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-300 mb-1">
                      Past Scope (Days to look back)
                    </label>
                    <input
                      type="number"
                      value={config.past_days_scope}
                      onChange={(e) => setConfig({ ...config, past_days_scope: parseInt(e.target.value, 10) || 0 })}
                      className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-xs font-mono text-stone-100"
                    />
                    <span className="text-[10px] text-stone-500">Default: 30 days</span>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-300 mb-1">
                      Future Scope (Days forward)
                    </label>
                    <input
                      type="number"
                      value={config.future_days_scope}
                      onChange={(e) => setConfig({ ...config, future_days_scope: parseInt(e.target.value, 10) || 0 })}
                      className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-xs font-mono text-stone-100"
                    />
                    <span className="text-[10px] text-stone-500">Default: 180 days</span>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-300 mb-1">
                      Pagination Crawl Limit (Pages)
                    </label>
                    <input
                      type="number"
                      value={config.page_limit}
                      onChange={(e) => setConfig({ ...config, page_limit: parseInt(e.target.value, 10) || 1 })}
                      className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-xs font-mono text-stone-100"
                    />
                    <span className="text-[10px] text-stone-500">Stops after N pages; flags run if incomplete</span>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-300 mb-1">
                      Request Delay (ms) for Politeness
                    </label>
                    <input
                      type="number"
                      value={config.request_delay_ms}
                      onChange={(e) => setConfig({ ...config, request_delay_ms: parseInt(e.target.value, 10) || 0 })}
                      className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-xs font-mono text-stone-100"
                    />
                    <span className="text-[10px] text-stone-500">Polite crawler delay (default 350ms)</span>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => handleSaveConfig(config)}
                    className="bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-semibold px-4 py-2 rounded-xl transition-colors shadow-md"
                  >
                    Save & Apply Configuration
                  </button>
                </div>
              </div>
            )}

            {/* Production Hosting Guide */}
            <div className="bg-stone-900/60 border border-stone-800 rounded-xl p-5 space-y-4">
              <h3 className="text-xs font-mono uppercase tracking-wider text-stone-300 flex items-center gap-2">
                <Terminal className="w-4 h-4 text-amber-400" />
                Hosted Backend & Scheduler Architecture Guide
              </h3>

              <div className="text-xs text-stone-400 space-y-3 leading-relaxed">
                <p>
                  <strong>Why client-side timers are insufficient:</strong> A browser <code className="text-stone-300 bg-stone-950 px-1 py-0.5 rounded">setInterval</code> only operates when an admin tab remains open and unthrottled. WatHive’s collector runs independently on the Node.js server process even when all browsers are disconnected.
                </p>

                <div className="bg-stone-950 border border-stone-800 rounded-xl p-4 space-y-2">
                  <div className="font-semibold text-stone-200">Recommended Production Setup:</div>
                  <ol className="list-decimal list-inside space-y-1.5 text-stone-400">
                    <li>
                      <strong>Google Cloud Run Jobs / Kubernetes CronJob:</strong> Invoke <code className="text-amber-400">POST /api/collector/sync</code> at 6:00 a.m. America/Toronto via Google Cloud Scheduler (<code className="text-stone-300">CRON: 0 6 * * *</code> timezone: <code className="text-stone-300">America/Toronto</code>).
                    </li>
                    <li>
                      <strong>Persistent Storage:</strong> Mount a persistent Cloud Storage bucket or persistent disk volume for <code className="text-stone-300">data/wusa_collector.db</code> so event records and change history persist indefinitely across server reboots.
                    </li>
                    <li>
                      <strong>Mutex Guard:</strong> The collector engine contains an in-memory lock that prevents duplicate concurrent runs if a manual sync and scheduled job trigger simultaneously.
                    </li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* EVENT DETAIL & EDIT DRAWER / MODAL */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex justify-end" onClick={() => setSelectedEvent(null)}>
          <div
            className="w-full max-w-2xl bg-stone-950 border-l border-stone-800 h-full overflow-y-auto p-6 space-y-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="flex items-start justify-between border-b border-stone-800 pb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded font-bold">
                    #{selectedEvent.id}
                  </span>
                  <span className="text-xs bg-stone-800 text-stone-300 px-2 py-0.5 rounded font-mono uppercase">
                    {selectedEvent.temporal_status}
                  </span>
                  {selectedEvent.is_multi_day && (
                    <span className="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded">
                      Multi-Day Event
                    </span>
                  )}
                  {selectedEvent.is_recurring && (
                    <span className="text-xs bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded">
                      Recurring Series
                    </span>
                  )}
                </div>
                <h2 className="text-lg font-bold text-stone-100">{selectedEvent.title}</h2>
              </div>

              <button
                onClick={() => setSelectedEvent(null)}
                className="text-stone-400 hover:text-stone-200 text-sm p-1.5 rounded-lg hover:bg-stone-900"
              >
                ✕
              </button>
            </div>

            {saveSuccessMsg && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 p-3 rounded-xl text-xs flex items-center gap-2">
                <Check className="w-4 h-4" />
                <span>{saveSuccessMsg}</span>
              </div>
            )}

            {/* Review Flags Alert if present */}
            {selectedEvent.review_flags && selectedEvent.review_flags.length > 0 && (
              <div className="bg-amber-950/40 border border-amber-800/80 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" />
                    Review Flags ({selectedEvent.review_flags.length})
                  </span>
                  <button
                    onClick={() => handleResolveReview(selectedEvent)}
                    className="text-[11px] bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 px-2.5 py-1 rounded-lg transition-colors"
                  >
                    Clear All Flags
                  </button>
                </div>
                <ul className="text-xs text-amber-300/90 list-disc list-inside space-y-1">
                  {selectedEvent.review_flags.map((flag, idx) => (
                    <li key={idx}>{flag}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Quick Actions (Approval, Original Link) */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-stone-900/60 p-3.5 rounded-xl border border-stone-800">
              <div className="flex items-center gap-2">
                <span className="text-xs text-stone-400">Approval Status:</span>
                <button
                  onClick={() => handleQuickApproval(selectedEvent, 'approved')}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    selectedEvent.approval_status === 'approved'
                      ? 'bg-emerald-500 text-stone-950 font-bold'
                      : 'bg-stone-800 text-stone-300 hover:bg-emerald-950 hover:text-emerald-300'
                  }`}
                >
                  Approve for WatHive
                </button>
                <button
                  onClick={() => handleQuickApproval(selectedEvent, 'rejected')}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    selectedEvent.approval_status === 'rejected'
                      ? 'bg-rose-500 text-stone-950 font-bold'
                      : 'bg-stone-800 text-stone-300 hover:bg-rose-950 hover:text-rose-300'
                  }`}
                >
                  Reject
                </button>
              </div>

              <a
                href={selectedEvent.original_wusa_url}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-amber-400 hover:underline flex items-center gap-1 font-medium"
              >
                Inspect Live WUSA Source
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* Event Details Grid or Edit Form */}
            {isEditing ? (
              <div className="space-y-4 bg-stone-900/40 p-4 rounded-xl border border-stone-800">
                <h3 className="text-xs font-mono uppercase tracking-wider text-amber-400">Manual Event Editor</h3>

                <div>
                  <label className="block text-xs font-medium text-stone-300 mb-1">Title</label>
                  <input
                    type="text"
                    value={editFormData.title || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                    className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-xs text-stone-100"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-stone-300 mb-1">Start Date/Time</label>
                    <input
                      type="text"
                      value={editFormData.start_date || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, start_date: e.target.value })}
                      className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-xs font-mono text-stone-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-300 mb-1">End Date/Time</label>
                    <input
                      type="text"
                      value={editFormData.end_date || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, end_date: e.target.value })}
                      className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-xs font-mono text-stone-100"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-stone-300 mb-1">Cost / Price</label>
                    <input
                      type="text"
                      value={editFormData.cost || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, cost: e.target.value })}
                      placeholder="e.g. Free or $15.00 – $20.00"
                      className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-xs text-stone-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-300 mb-1">Registration URL</label>
                    <input
                      type="text"
                      value={editFormData.registration_url || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, registration_url: e.target.value })}
                      placeholder="https://..."
                      className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-xs text-stone-100"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-300 mb-1">Admin Notes</label>
                  <textarea
                    rows={2}
                    value={editFormData.admin_notes || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, admin_notes: e.target.value })}
                    placeholder="Verification notes or reason for edit..."
                    className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-xs text-stone-100"
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={handleSaveEventEdits}
                    className="bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-semibold px-4 py-2 rounded-xl transition-colors"
                  >
                    Save Changes & Record Audit
                  </button>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs px-3 py-2 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-mono uppercase tracking-wider text-stone-400">Extracted Metadata</h3>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 font-medium"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Edit Record
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-stone-900/60 p-3 rounded-xl border border-stone-800">
                    <span className="text-[10px] text-stone-500 font-mono block">START DATE & TIME</span>
                    <span className="font-semibold text-stone-200 mt-1 block font-mono">{selectedEvent.start_date}</span>
                    <span className="text-[10px] text-stone-500">{selectedEvent.timezone} ({selectedEvent.start_iso.slice(-6)})</span>
                  </div>

                  <div className="bg-stone-900/60 p-3 rounded-xl border border-stone-800">
                    <span className="text-[10px] text-stone-500 font-mono block">END DATE & TIME</span>
                    <span className="font-semibold text-stone-200 mt-1 block font-mono">
                      {selectedEvent.end_date || <span className="text-amber-400">Missing / Ambiguous</span>}
                    </span>
                    <span className="text-[10px] text-stone-500">
                      {selectedEvent.end_iso ? selectedEvent.end_iso.slice(-6) : 'Preserved as null (no guessing)'}
                    </span>
                  </div>

                  <div className="bg-stone-900/60 p-3 rounded-xl border border-stone-800">
                    <span className="text-[10px] text-stone-500 font-mono block">VENUE & ROOM</span>
                    <span className="font-semibold text-stone-200 mt-1 block">{selectedEvent.venue?.name || 'Campus'}</span>
                    <span className="text-[10px] text-stone-400">
                      {selectedEvent.venue?.room || selectedEvent.venue?.address || 'Waterloo, ON'}
                    </span>
                  </div>

                  <div className="bg-stone-900/60 p-3 rounded-xl border border-stone-800">
                    <span className="text-[10px] text-stone-500 font-mono block">PRICE & TICKETING</span>
                    <span className="font-semibold text-stone-200 mt-1 block">{selectedEvent.cost || 'Free'}</span>
                    <span className="text-[10px] text-stone-400">
                      {selectedEvent.registration_url ? 'External Registration' : 'No external ticket required'}
                    </span>
                  </div>
                </div>

                {/* Registration URL display */}
                {selectedEvent.registration_url && (
                  <div className="bg-stone-900/60 p-3 rounded-xl border border-stone-800 text-xs">
                    <span className="text-[10px] text-stone-500 font-mono block mb-1">REGISTRATION URL</span>
                    <a
                      href={selectedEvent.registration_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-amber-400 underline truncate block hover:text-amber-300"
                    >
                      {selectedEvent.registration_url}
                    </a>
                  </div>
                )}

                {/* Description Preview */}
                <div className="bg-stone-900/60 p-4 rounded-xl border border-stone-800 space-y-2">
                  <span className="text-[10px] text-stone-500 font-mono block">EVENT DESCRIPTION</span>
                  <div className="text-xs text-stone-300 leading-relaxed max-h-48 overflow-y-auto whitespace-pre-wrap">
                    {selectedEvent.description_text || selectedEvent.description}
                  </div>
                </div>
              </div>
            )}

            {/* Change History Audit Log */}
            <div className="border-t border-stone-800 pt-4 space-y-3">
              <h3 className="text-xs font-mono uppercase tracking-wider text-stone-400 flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-amber-400" />
                Change History & Diff Audit
              </h3>

              {eventHistory.length === 0 ? (
                <div className="text-xs text-stone-500 italic bg-stone-900/40 p-3 rounded-xl border border-stone-800/60">
                  No subsequent modifications detected. Data matches initial WUSA extraction perfectly.
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {eventHistory.map((h) => (
                    <div key={h.id} className="bg-stone-900/80 p-2.5 rounded-lg border border-stone-800 text-xs font-mono">
                      <div className="flex items-center justify-between text-[11px] text-stone-400 mb-1">
                        <span className="text-amber-400">Field: {h.field_name}</span>
                        <span>{new Date(h.changed_at).toLocaleString()}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div className="text-rose-400 truncate bg-stone-950 p-1.5 rounded">
                          - {h.old_value || 'null'}
                        </div>
                        <div className="text-emerald-400 truncate bg-stone-950 p-1.5 rounded">
                          + {h.new_value || 'null'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Timestamps */}
            <div className="text-[11px] font-mono text-stone-500 border-t border-stone-800 pt-3 flex flex-wrap justify-between gap-2">
              <span>First Imported: {new Date(selectedEvent.first_imported_at).toLocaleString()}</span>
              <span>Last Checked: {new Date(selectedEvent.last_checked_at).toLocaleString()}</span>
              <span>Last Changed: {new Date(selectedEvent.last_changed_at).toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
