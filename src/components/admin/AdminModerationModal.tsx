import React, { useState } from 'react';
import {
  X,
  Shield,
  Activity,
  Layers,
  Copy,
  Tag,
  Server,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Clock,
  Eye,
  Check,
  ChevronRight,
  Database,
  Lock,
  Globe,
  Sliders,
  Send,
  Building2,
  Trash2,
  Calendar,
  ExternalLink,
  Info
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  formatWaterlooTime,
  formatWaterlooDateWithDst,
  getWaterlooTzAbbreviation,
  getWaterlooUtcOffsetString
} from '../../utils/timeZone';
import { AggregationSource, DuplicateDetectionResult, EventItem, StudentDiscount } from '../../types';

interface AdminModerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenWusaCollector?: () => void;
}

export const AdminModerationModal: React.FC<AdminModerationModalProps> = ({
  isOpen,
  onClose,
  onOpenWusaCollector
}) => {
  const {
    events,
    reportsList,
    resolveReport,
    moderateEvent,
    aggregationSources,
    syncReports,
    runScheduledRefresh,
    duplicateResults,
    resolveDuplicate,
    studentDiscounts,
    addCustomDiscount,
    auditLogs
  } = useApp();

  const [activeTab, setActiveTab] = useState<'moderation' | 'aggregation' | 'duplicates' | 'discounts' | 'architecture'>('moderation');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState('');
  const [newDiscountOpen, setNewDiscountOpen] = useState(false);

  // New Discount Form State
  const [discountForm, setDiscountForm] = useState({
    businessName: '',
    title: '',
    description: '',
    discountValue: '',
    category: 'Food & Dining' as StudentDiscount['category'],
    location: '',
    verificationProof: 'watcard_physical' as StudentDiscount['verificationProof'],
    terms: '',
    validUntil: 'Dec 31, 2026',
    sourceUrl: ''
  });

  if (!isOpen) return null;

  const pendingReports = reportsList.filter((r) => r.status === 'pending');
  const pendingDuplicates = duplicateResults.filter((d) => d.status === 'pending_review');

  const now = new Date();
  const tzAbbr = getWaterlooTzAbbreviation(now);
  const tzOffset = getWaterlooUtcOffsetString(now);

  const handleRefreshClick = () => {
    setIsRefreshing(true);
    setRefreshMessage('');

    setTimeout(() => {
      const res = runScheduledRefresh();
      setIsRefreshing(false);
      setRefreshMessage(res.message);
      setTimeout(() => setRefreshMessage(''), 4500);
    }, 600);
  };

  const handleCreateDiscount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!discountForm.businessName || !discountForm.discountValue) return;

    addCustomDiscount({
      ...discountForm,
      isConfirmedPartner: true
    });

    setDiscountForm({
      businessName: '',
      title: '',
      description: '',
      discountValue: '',
      category: 'Food & Dining',
      location: '',
      verificationProof: 'watcard_physical',
      terms: '',
      validUntil: 'Dec 31, 2026',
      sourceUrl: ''
    });
    setNewDiscountOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-stone-950/80 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-5xl w-full shadow-2xl border border-stone-200 overflow-hidden relative max-h-[94vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
        
        {/* Top Header Bar */}
        <div className="p-5 sm:p-6 bg-stone-950 text-white border-b border-stone-800 flex items-center justify-between flex-wrap gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-400 text-stone-950 flex items-center gap-1 shadow-xs">
                <Shield className="w-3.5 h-3.5" />
                WatHive Ops Console
              </span>
              <span className="text-xs font-mono text-amber-300 bg-stone-900 border border-stone-800 px-2 py-0.5 rounded-md">
                Waterloo Core · {tzAbbr} ({tzOffset})
              </span>
              <span className="text-xs text-stone-400">
                Institutional Administration & Health
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              Technical & Operational Management
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full bg-stone-800 hover:bg-stone-700 text-white transition-colors"
              aria-label="Close admin console"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Operational Telemetry Banner */}
        <div className="px-5 py-3 bg-stone-900 text-stone-300 text-xs border-b border-stone-800 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <span className="text-[10px] text-stone-400 block font-bold uppercase tracking-wider">Scheduled 2h Refresh</span>
            <span className="text-white font-mono font-bold flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              {syncReports[0]?.nextScheduledRefresh || 'Every 2 Hours'}
            </span>
          </div>

          <div>
            <span className="text-[10px] text-stone-400 block font-bold uppercase tracking-wider">Active Campus Sources</span>
            <span className="text-emerald-400 font-mono font-bold flex items-center gap-1">
              <Server className="w-3.5 h-3.5" />
              {aggregationSources.filter((s) => s.status === 'healthy').length} / {aggregationSources.length} Healthy
            </span>
          </div>

          <div>
            <span className="text-[10px] text-stone-400 block font-bold uppercase tracking-wider">Duplicate Candidates</span>
            <span className="text-amber-400 font-mono font-bold flex items-center gap-1">
              <Copy className="w-3.5 h-3.5" />
              {pendingDuplicates.length} In Review
            </span>
          </div>

          <div>
            <span className="text-[10px] text-stone-400 block font-bold uppercase tracking-wider">Pending Reports</span>
            <span className={`font-mono font-bold flex items-center gap-1 ${pendingReports.length > 0 ? 'text-red-400' : 'text-stone-300'}`}>
              <AlertTriangle className="w-3.5 h-3.5" />
              {pendingReports.length} Open Flags
            </span>
          </div>
        </div>

        {/* WUSA Collector Standalone Banner */}
        <div className="px-5 py-2.5 bg-amber-500/10 border-b border-amber-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-stone-900 font-medium">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span><strong>WUSA Standalone Event Collector:</strong> Live backend imports from wusa.ca with persistent SQLite storage and scheduler.</span>
          </div>
          {onOpenWusaCollector && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenWusaCollector();
              }}
              className="px-3 py-1 bg-stone-950 text-amber-400 font-bold rounded-lg hover:bg-stone-800 transition-colors shrink-0 text-xs flex items-center gap-1 shadow-sm"
            >
              Open Collector Dashboard →
            </button>
          )}
        </div>

        {/* Tabs Bar */}
        <div className="px-5 border-b border-stone-200 bg-stone-50 flex items-center gap-1 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('moderation')}
            className={`py-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'moderation'
                ? 'border-amber-500 text-stone-950 font-black'
                : 'border-transparent text-stone-600 hover:text-stone-900'
            }`}
          >
            <Shield className="w-4 h-4 text-amber-600" />
            <span>Moderation & Safety</span>
            {pendingReports.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-red-600 text-white ml-1">
                {pendingReports.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('aggregation')}
            className={`py-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'aggregation'
                ? 'border-amber-500 text-stone-950 font-black'
                : 'border-transparent text-stone-600 hover:text-stone-900'
            }`}
          >
            <Activity className="w-4 h-4 text-amber-600" />
            <span>Aggregation & 2-Hour Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('duplicates')}
            className={`py-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'duplicates'
                ? 'border-amber-500 text-stone-950 font-black'
                : 'border-transparent text-stone-600 hover:text-stone-900'
            }`}
          >
            <Copy className="w-4 h-4 text-amber-600" />
            <span>Duplicate Detection</span>
            {pendingDuplicates.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-amber-400 text-stone-950 ml-1">
                {pendingDuplicates.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('discounts')}
            className={`py-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'discounts'
                ? 'border-amber-500 text-stone-950 font-black'
                : 'border-transparent text-stone-600 hover:text-stone-900'
            }`}
          >
            <Tag className="w-4 h-4 text-amber-600" />
            <span>Student Discounts</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('architecture')}
            className={`py-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'architecture'
                ? 'border-amber-500 text-stone-950 font-black'
                : 'border-transparent text-stone-600 hover:text-stone-900'
            }`}
          >
            <Server className="w-4 h-4 text-amber-600" />
            <span>Architecture & Truth Safeguards</span>
          </button>
        </div>

        {/* Tab Content Container */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">

          {/* TAB 1: MODERATION & ABUSE PREVENTION */}
          {activeTab === 'moderation' && (
            <div className="space-y-6">
              {/* Reports Queue */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-black text-stone-950 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>Reported Items & Safety Flag Queue</span>
                  </h3>
                  <span className="text-xs text-stone-500">
                    {reportsList.length} Total Cases Logged
                  </span>
                </div>

                {reportsList.length === 0 ? (
                  <div className="p-6 text-center bg-stone-50 border border-stone-200 rounded-2xl text-xs text-stone-500">
                    No active user or event reports in queue. The campus feed is clear.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {reportsList.map((rep) => (
                      <div
                        key={rep.id}
                        className="p-4 bg-white border border-stone-200 rounded-2xl shadow-2xs space-y-3"
                      >
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                                rep.targetType === 'user'
                                  ? 'bg-purple-100 text-purple-900'
                                  : 'bg-amber-100 text-amber-900'
                              }`}>
                                {rep.targetType === 'user' ? 'Reported Attendee' : 'Reported Event'}
                              </span>
                              <span className="font-bold text-sm text-stone-900">
                                {rep.targetName}
                              </span>
                              <span className="text-[11px] text-stone-400 font-mono">
                                ID: {rep.targetId}
                              </span>
                            </div>
                            <p className="text-xs text-red-700 font-semibold">
                              Reason: {rep.reason}
                            </p>
                            {rep.description && (
                              <p className="text-xs text-stone-600 bg-stone-50 p-2.5 rounded-xl border border-stone-100">
                                &ldquo;{rep.description}&rdquo;
                              </p>
                            )}
                          </div>

                          <div className="text-right">
                            <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              rep.status === 'pending'
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : rep.status === 'resolved_removed'
                                ? 'bg-red-100 text-red-900'
                                : 'bg-stone-100 text-stone-600'
                            }`}>
                              {rep.status}
                            </span>
                          </div>
                        </div>

                        {/* Moderator Actions */}
                        {rep.status === 'pending' && (
                          <div className="pt-2 border-t border-stone-100 flex items-center justify-end gap-2 flex-wrap">
                            <button
                              type="button"
                              onClick={() => resolveReport(rep.id, 'dismissed', 'Reviewed and found compliant.')}
                              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-stone-100 hover:bg-stone-200 text-stone-700"
                            >
                              Dismiss (Compliant)
                            </button>
                            <button
                              type="button"
                              onClick={() => resolveReport(rep.id, 'resolved_warning', 'Formal community warning issued to user.')}
                              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-400 hover:bg-amber-500 text-stone-950"
                            >
                              Issue Warning
                            </button>
                            <button
                              type="button"
                              onClick={() => resolveReport(rep.id, 'resolved_removed', 'Content removed for violation of safety policy.')}
                              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white"
                            >
                              Remove & Ban
                            </button>
                          </div>
                        )}

                        {rep.moderatorNotes && (
                          <div className="text-[11px] text-stone-500 italic">
                            Resolution Note: {rep.moderatorNotes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Event Content Moderation */}
              <div className="space-y-3 pt-4 border-t border-stone-200">
                <h3 className="text-base font-black text-stone-950 flex items-center gap-2">
                  <Eye className="w-4 h-4 text-amber-600" />
                  <span>Community Event Verification Queue</span>
                </h3>

                <div className="space-y-2">
                  {events.slice(0, 6).map((ev) => (
                    <div
                      key={ev.id}
                      className="p-3 sm:p-4 bg-white border border-stone-200 rounded-2xl flex items-center justify-between gap-3 flex-wrap"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-stone-900 truncate max-w-sm">
                            {ev.title}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-stone-100 text-stone-700">
                            {ev.organizer}
                          </span>
                        </div>
                        <div className="text-xs text-stone-500 flex items-center gap-2">
                          <span>{ev.date} · {ev.startTime}</span>
                          <span>·</span>
                          <span className="truncate">{ev.location}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg ${
                          ev.moderationStatus === 'approved'
                            ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                            : ev.moderationStatus === 'rejected'
                            ? 'bg-red-100 text-red-900 border border-red-300'
                            : 'bg-amber-100 text-amber-900 border border-amber-300'
                        }`}>
                          {ev.moderationStatus || 'approved'}
                        </span>

                        <button
                          type="button"
                          onClick={() => moderateEvent(ev.id, 'approved')}
                          className="px-2.5 py-1 rounded-lg text-xs font-bold bg-stone-950 text-amber-300 hover:bg-stone-800"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => moderateEvent(ev.id, 'rejected')}
                          className="px-2.5 py-1 rounded-lg text-xs font-bold bg-stone-100 hover:bg-red-50 text-stone-700 hover:text-red-700"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: AGGREGATION & 2-HOUR REFRESH */}
          {activeTab === 'aggregation' && (
            <div className="space-y-6">
              {/* Trigger & Telemetry */}
              <div className="p-5 bg-stone-950 text-white rounded-3xl space-y-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="space-y-1">
                    <span className="text-[11px] font-black text-amber-400 uppercase tracking-wider">
                      Automated Campus Ingestion Engine
                    </span>
                    <h3 className="text-xl font-black text-white">
                      Scheduled Two-Hour Data Refresh
                    </h3>
                    <p className="text-xs text-stone-300 max-w-xl">
                      WatHive continuously polls and syncs campus event feeds every 120 minutes. Handles source outages, API rate limits, and network jitter gracefully.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleRefreshClick}
                    disabled={isRefreshing}
                    className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-stone-950 font-black text-xs sm:text-sm flex items-center gap-2 shadow-md transition-all active:scale-95 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                    <span>{isRefreshing ? 'Running Refresh Cycle...' : 'Run Refresh Cycle Now'}</span>
                  </button>
                </div>

                {refreshMessage && (
                  <div className="p-3 bg-amber-500/20 border border-amber-400/50 rounded-xl text-xs font-bold text-amber-300 flex items-center gap-2 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>{refreshMessage}</span>
                  </div>
                )}
              </div>

              {/* Campus Sources List */}
              <div className="space-y-3">
                <h3 className="text-base font-black text-stone-950 flex items-center gap-2">
                  <Server className="w-4 h-4 text-amber-600" />
                  <span>Configured Institutional & Community Feeds</span>
                </h3>

                <div className="overflow-x-auto border border-stone-200 rounded-2xl">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 uppercase tracking-wider text-[10px] font-bold">
                      <tr>
                        <th className="p-3">Source Name</th>
                        <th className="p-3">Organization</th>
                        <th className="p-3">Type</th>
                        <th className="p-3">Health Status</th>
                        <th className="p-3">Latency</th>
                        <th className="p-3">Ingested</th>
                        <th className="p-3">Last Sync</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {aggregationSources.map((source) => (
                        <tr key={source.id} className="hover:bg-stone-50/80">
                          <td className="p-3 font-bold text-stone-900">
                            <div className="flex items-center gap-1.5">
                              {source.name}
                              {source.isUniversityOfficial && (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-amber-100 text-amber-900">
                                  Official
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-stone-400 font-mono truncate max-w-xs">
                              {source.endpointUrl}
                            </div>
                          </td>
                          <td className="p-3 text-stone-600">{source.organization}</td>
                          <td className="p-3">
                            <span className="font-mono uppercase font-bold text-[10px] text-stone-500">
                              {source.type}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold text-[10px] bg-emerald-100 text-emerald-900">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                              {source.httpStatus} OK
                            </span>
                          </td>
                          <td className="p-3 font-mono text-stone-600">{source.latencyMs} ms</td>
                          <td className="p-3 font-bold text-stone-900">{source.eventsIngested}</td>
                          <td className="p-3 text-stone-500">{source.lastSyncTime}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Sync Execution History */}
              <div className="space-y-3 pt-4 border-t border-stone-200">
                <h3 className="text-base font-black text-stone-950 flex items-center gap-2">
                  <Database className="w-4 h-4 text-amber-600" />
                  <span>Recent Synchronization Logs</span>
                </h3>

                <div className="space-y-2">
                  {syncReports.map((report) => (
                    <div
                      key={report.id}
                      className="p-3.5 bg-stone-50 border border-stone-200 rounded-xl text-xs flex items-center justify-between gap-3 flex-wrap"
                    >
                      <div className="space-y-0.5">
                        <span className="font-mono font-bold text-stone-900">
                          Cycle {report.id}
                        </span>
                        <div className="text-[11px] text-stone-500">
                          Queried {report.sourcesQueried} endpoints in {report.durationMs}ms · {report.eventsIngested} listings updated · {report.duplicatesFlagged} duplicates flagged
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[11px] font-bold text-stone-700 block">
                          Completed at {report.cycleCompletedAt}
                        </span>
                        <span className="text-[10px] font-mono text-stone-500">
                          Next scheduled: {report.nextScheduledRefresh}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: DUPLICATE DETECTION */}
          {activeTab === 'duplicates' && (
            <div className="space-y-6">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-950 space-y-1">
                <h4 className="font-bold flex items-center gap-1.5 text-stone-950">
                  <Copy className="w-4 h-4 text-amber-600" />
                  <span>Deduplication Algorithm & Confidence Scoring</span>
                </h4>
                <p className="text-stone-700 leading-relaxed">
                  When different clubs, societies, and external webhooks post about the same campus gathering, WatHive compares title tokenization (Jaccard similarity), campus venue nodes (e.g. SLC, E7, MC), and start-time overlap to flag potential duplicates before they clutter the feed.
                </p>
              </div>

              <div className="space-y-4">
                <h3 className="text-base font-black text-stone-950">
                  Detected Duplicate Candidate Matches
                </h3>

                {duplicateResults.map((dup) => (
                  <div
                    key={dup.id}
                    className="p-5 bg-white border border-stone-200 rounded-2xl shadow-2xs space-y-4"
                  >
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black px-2.5 py-1 rounded-xl bg-amber-400 text-stone-950">
                          {Math.round(dup.similarityScore * 100)}% Similarity Match
                        </span>
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                          dup.status === 'pending_review'
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : dup.status === 'merged'
                            ? 'bg-emerald-100 text-emerald-900'
                            : 'bg-stone-100 text-stone-600'
                        }`}>
                          {dup.status === 'pending_review' ? 'Action Required' : dup.status}
                        </span>
                      </div>

                      <span className="text-[11px] text-stone-400 font-mono">
                        Rule Match: {dup.id}
                      </span>
                    </div>

                    {/* Side by side comparison */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Primary Listing */}
                      <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-2">
                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 block">
                          Primary Verified Listing
                        </span>
                        <h4 className="font-bold text-sm text-stone-950">
                          {dup.primaryEvent.title}
                        </h4>
                        <div className="text-xs text-stone-600 space-y-1">
                          <div><strong>Organizer:</strong> {dup.primaryEvent.organizer}</div>
                          <div><strong>Location:</strong> {dup.primaryEvent.location}</div>
                          <div><strong>Time:</strong> {dup.primaryEvent.date} @ {dup.primaryEvent.startTime}</div>
                        </div>
                      </div>

                      {/* Duplicate Candidate */}
                      <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-300 space-y-2">
                        <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 block">
                          Incoming Feed Duplicate Candidate
                        </span>
                        <h4 className="font-bold text-sm text-stone-950">
                          {dup.duplicateCandidate.title}
                        </h4>
                        <div className="text-xs text-stone-600 space-y-1">
                          <div><strong>Feed Source:</strong> {dup.duplicateCandidate.source}</div>
                          <div><strong>Location:</strong> {dup.duplicateCandidate.location}</div>
                          <div><strong>Time:</strong> {dup.duplicateCandidate.date} @ {dup.duplicateCandidate.startTime}</div>
                        </div>
                      </div>
                    </div>

                    {/* Diagnostic Reasons */}
                    <div className="p-3 bg-stone-50 rounded-xl space-y-1 text-xs">
                      <span className="text-[10px] font-bold uppercase text-stone-500 block">
                        Match Reasons:
                      </span>
                      <ul className="list-disc list-inside space-y-0.5 text-stone-700">
                        {dup.matchReasons.map((reason, idx) => (
                          <li key={idx}>{reason}</li>
                        ))}
                      </ul>
                    </div>

                    {/* Resolution Actions */}
                    {dup.status === 'pending_review' && (
                      <div className="pt-2 border-t border-stone-100 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => resolveDuplicate(dup.id, 'dismiss')}
                          className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-stone-100 hover:bg-stone-200 text-stone-700"
                        >
                          Keep Both (False Positive)
                        </button>
                        <button
                          type="button"
                          onClick={() => resolveDuplicate(dup.id, 'merge')}
                          className="px-4 py-1.5 rounded-xl text-xs font-bold bg-stone-950 hover:bg-black text-amber-300 shadow-xs"
                        >
                          Merge Candidate with Primary Listing
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: STUDENT DISCOUNTS */}
          {activeTab === 'discounts' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="space-y-1">
                  <h3 className="text-base font-black text-stone-950">
                    Active Verified Campus Discounts ({studentDiscounts.length})
                  </h3>
                  <p className="text-xs text-stone-500">
                    Strict truth-in-data enforcement: No estimated or unverifiable discounts are published.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setNewDiscountOpen(!newDiscountOpen)}
                  className="px-3.5 py-2 rounded-xl bg-stone-950 text-amber-300 font-bold text-xs hover:bg-stone-800"
                >
                  {newDiscountOpen ? 'Cancel' : '+ Add Verified Student Deal'}
                </button>
              </div>

              {/* Add Discount Form */}
              {newDiscountOpen && (
                <form
                  onSubmit={handleCreateDiscount}
                  className="p-5 bg-stone-50 border border-stone-200 rounded-2xl space-y-4 animate-in fade-in"
                >
                  <h4 className="text-sm font-black text-stone-900">
                    Register Confirmed Student Perk
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="font-bold text-stone-700 block mb-1">Business Name</label>
                      <input
                        type="text"
                        required
                        value={discountForm.businessName}
                        onChange={(e) => setDiscountForm({ ...discountForm, businessName: e.target.value })}
                        placeholder="e.g. SLC Tim Hortons / Black Goose"
                        className="w-full p-2 bg-white border border-stone-200 rounded-xl"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-stone-700 block mb-1">Offer Value</label>
                      <input
                        type="text"
                        required
                        value={discountForm.discountValue}
                        onChange={(e) => setDiscountForm({ ...discountForm, discountValue: e.target.value })}
                        placeholder="e.g. 15% Off Total Order"
                        className="w-full p-2 bg-white border border-stone-200 rounded-xl"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="font-bold text-stone-700 block mb-1">Promotion Title</label>
                      <input
                        type="text"
                        required
                        value={discountForm.title}
                        onChange={(e) => setDiscountForm({ ...discountForm, title: e.target.value })}
                        placeholder="e.g. Daily Student Coffee & Bakery Deal"
                        className="w-full p-2 bg-white border border-stone-200 rounded-xl"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-stone-700 block mb-1">Category</label>
                      <select
                        value={discountForm.category}
                        onChange={(e) => setDiscountForm({ ...discountForm, category: e.target.value as any })}
                        className="w-full p-2 bg-white border border-stone-200 rounded-xl"
                      >
                        <option value="Food & Dining">Food & Dining</option>
                        <option value="Transit & Travel">Transit & Travel</option>
                        <option value="Tech & Supplies">Tech & Supplies</option>
                        <option value="Fitness & Leisure">Fitness & Leisure</option>
                      </select>
                    </div>

                    <div>
                      <label className="font-bold text-stone-700 block mb-1">Verification Proof</label>
                      <select
                        value={discountForm.verificationProof}
                        onChange={(e) => setDiscountForm({ ...discountForm, verificationProof: e.target.value as any })}
                        className="w-full p-2 bg-white border border-stone-200 rounded-xl"
                      >
                        <option value="watcard_physical">Physical WatCard Tap / Scan Required</option>
                        <option value="wusa_perk_portal">WUSA Official Perks Portal Code</option>
                        <option value="student_email_code">@uwaterloo.ca Institutional Email</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="font-bold text-stone-700 block mb-1">Terms & Conditions</label>
                      <input
                        type="text"
                        required
                        value={discountForm.terms}
                        onChange={(e) => setDiscountForm({ ...discountForm, terms: e.target.value })}
                        placeholder="e.g. Must present physical WatCard before payment. Non-transferable."
                        className="w-full p-2 bg-white border border-stone-200 rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setNewDiscountOpen(false)}
                      className="px-3 py-1.5 text-xs text-stone-600"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-stone-950 text-amber-300 text-xs font-bold rounded-xl"
                    >
                      Publish Verified Deal
                    </button>
                  </div>
                </form>
              )}

              {/* Discounts Table */}
              <div className="space-y-3">
                {studentDiscounts.map((disc) => (
                  <div
                    key={disc.id}
                    className="p-4 bg-white border border-stone-200 rounded-2xl flex items-start justify-between gap-3 flex-wrap"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-stone-900">{disc.businessName}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-stone-950 text-amber-300">
                          {disc.discountValue}
                        </span>
                      </div>
                      <p className="text-xs text-stone-600">{disc.title}</p>
                      <div className="text-[11px] text-stone-500 flex items-center gap-2 flex-wrap">
                        <span>Proof: {disc.verificationProof}</span>
                        <span>·</span>
                        <span>{disc.location}</span>
                        <span>·</span>
                        <span className="text-emerald-700 font-semibold">{disc.verifiedAt}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: ARCHITECTURE & TRUTH SAFEGUARDS */}
          {activeTab === 'architecture' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Multi-Tenant Scalability */}
                <div className="p-5 bg-stone-50 border border-stone-200 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2 text-stone-900 font-black text-sm">
                    <Building2 className="w-4 h-4 text-amber-600" />
                    <span>Multi-Tenant University Architecture</span>
                  </div>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    WatHive initiates with the University of Waterloo as the active community tenant while maintaining a strict modular tenant isolation layer (<code className="font-mono text-stone-800">schoolId: &apos;uwaterloo&apos;</code>). All domain policies, venue node graphs, and building aliases are decoupled from the core application engine to allow seamless expansion to other campuses.
                  </p>
                </div>

                {/* 2. Consistent UTC Timestamp Storage & Waterloo DST */}
                <div className="p-5 bg-stone-50 border border-stone-200 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2 text-stone-900 font-black text-sm">
                    <Clock className="w-4 h-4 text-amber-600" />
                    <span>UTC Storage & Eastern DST Transition</span>
                  </div>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    All event dates and start/end times are converted into normalized UTC ISO-8601 timestamps on ingestion (<code className="font-mono text-stone-800">utcIsoString</code>). Output displays dynamically calculate Eastern Daylight Time (EDT · UTC-4) vs Eastern Standard Time (EST · UTC-5) based on standard Canadian DST rules.
                  </p>
                </div>

                {/* 3. Attendee Privacy & Zero-Knowledge Matching */}
                <div className="p-5 bg-stone-50 border border-stone-200 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2 text-stone-900 font-black text-sm">
                    <Lock className="w-4 h-4 text-amber-600" />
                    <span>Zero-Knowledge Attendee Privacy</span>
                  </div>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    Students retain full sovereignty over their private data. Attending an event does not reveal their name. Only first name and last initial are rendered. Date of birth, private student email, live GPS coordinates, and personal schedule calendars are strictly protected and never leaked to peers.
                  </p>
                </div>

                {/* 4. Truth in Data Safeguards */}
                <div className="p-5 bg-stone-50 border border-stone-200 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2 text-stone-900 font-black text-sm">
                    <CheckCircle2 className="w-4 h-4 text-amber-600" />
                    <span>Truth in Data Safeguards</span>
                  </div>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    WatHive explicitly prohibits displaying estimated or crowd-guessed student discounts as confirmed data. In-app RSVPs are clearly distinguished from organizer registrations. No fake or mock third-party API integrations requiring paid tokens are used.
                  </p>
                </div>
              </div>

              {/* Audit Trail */}
              <div className="space-y-3 pt-2">
                <h3 className="text-base font-black text-stone-950 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-amber-600" />
                  <span>Administrative Audit Trail</span>
                </h3>

                <div className="space-y-2">
                  {auditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3 bg-white border border-stone-200 rounded-xl text-xs flex items-start justify-between gap-3"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-stone-900">{log.action}</span>
                          <span className="text-[10px] text-stone-500 font-mono">[{log.target}]</span>
                        </div>
                        <p className="text-[11px] text-stone-600">{log.details}</p>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-[10px] font-bold text-stone-400 block">{log.performedBy}</span>
                        <span className="text-[10px] text-stone-400">{log.timestamp}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Console Footer */}
        <div className="p-4 bg-stone-100 border-t border-stone-200 flex items-center justify-between text-xs text-stone-600 flex-wrap gap-2">
          <div className="flex items-center gap-2 text-[11px] text-stone-500">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>WatHive Engine v2.4 · All Systems Nominal · UWaterloo Node</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-stone-950 text-amber-300 font-bold text-xs hover:bg-stone-800"
          >
            Close Ops Console
          </button>
        </div>

      </div>
    </div>
  );
};
