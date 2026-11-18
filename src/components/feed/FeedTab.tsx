import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Search,
  SlidersHorizontal,
  X,
  Calendar,
  ChevronDown,
  List,
  MapPin,
  Database,
  ShieldCheck,
  User as UserIcon,
  ArrowRight,
  LogIn
} from 'lucide-react';
import { EventItem } from '../../types';
import { useApp } from '../../context/AppContext';
import { EventCard } from './EventCard';
import { EventDetailModal } from './EventDetailModal';
import { CampusEventMap } from './CampusEventMap';
import { EVENT_CATEGORIES, UW_FACULTIES } from '../../data/mockData';
import {
  DateRangePreset,
  getWaterlooTodayStr,
  resolveDateRange,
  eventOverlapsDateRange
} from '../../utils/dateRange';

interface FeedTabProps {
  onNavigateToMessages?: () => void;
  onOpenPreferences?: () => void;
  onOpenWusaCollector?: () => void;
  onOpenProfile?: () => void;
  onOpenAuth?: () => void;
}

type LocationBucket = 'all' | 'slc' | 'eng' | 'mc_dc' | 'pac_cif' | 'online' | 'off_campus';

const LOCATION_BUCKETS: { id: LocationBucket; label: string }[] = [
  { id: 'all', label: 'All Locations' },
  { id: 'slc', label: 'Student Life Centre (SLC)' },
  { id: 'eng', label: 'Engineering (E5 / E7)' },
  { id: 'mc_dc', label: 'Math & Davis Centre (MC / DC)' },
  { id: 'pac_cif', label: 'Athletics (PAC / CIF)' },
  { id: 'online', label: 'Online / Virtual' },
  { id: 'off_campus', label: 'Off-Campus & Uptown' }
];

function matchesLocationBucket(ev: EventItem, bucket: LocationBucket): boolean {
  if (bucket === 'all') return true;
  const loc = (ev.location + ' ' + (ev.venueName || '')).toLowerCase();
  if (bucket === 'online') return ev.isOnline || loc.includes('online') || loc.includes('virtual') || loc.includes('zoom');
  if (bucket === 'slc') return loc.includes('slc') || loc.includes('student life') || loc.includes('great hall') || loc.includes('black and gold') || loc.includes('multi-purpose');
  if (bucket === 'eng') return loc.includes('e7') || loc.includes('e5') || loc.includes('e2') || loc.includes('engineering') || loc.includes('cph');
  if (bucket === 'mc_dc') return loc.includes('mc ') || loc.includes('mc,') || loc.includes('math') || loc.includes('davis') || loc.includes('dc ');
  if (bucket === 'pac_cif') return loc.includes('pac') || loc.includes('cif') || loc.includes('icefield') || loc.includes('physical activities') || loc.includes('gym');
  if (bucket === 'off_campus') {
    return (
      !ev.isOnline &&
      !matchesLocationBucket(ev, 'slc') &&
      !matchesLocationBucket(ev, 'eng') &&
      !matchesLocationBucket(ev, 'mc_dc') &&
      !matchesLocationBucket(ev, 'pac_cif')
    );
  }
  return true;
}

export const FeedTab: React.FC<FeedTabProps> = ({
  onNavigateToMessages,
  onOpenPreferences,
  onOpenWusaCollector,
  onOpenProfile,
  onOpenAuth
}) => {
  const { events, rankForYouEvents, user, attendingEventIds, savedEventIds } = useApp();

  const [feedMode, setFeedMode] = useState<'forYou' | 'all'>('forYou');
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedLocation, setSelectedLocation] = useState<LocationBucket>('all');
  const [selectedDateFilter, setSelectedDateFilter] = useState<DateRangePreset>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [selectedFaculty, setSelectedFaculty] = useState<string>('all');
  const [priceFilter, setPriceFilter] = useState<'all' | 'free' | 'paid'>('all');

  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [dateDropdownOpen, setDateDropdownOpen] = useState(false);
  const [selectedEventForDetail, setSelectedEventForDetail] = useState<EventItem | null>(null);
  const [avatarError, setAvatarError] = useState(false);

  const dateDropdownRef = useRef<HTMLDivElement | null>(null);
  const todayStr = useMemo(() => getWaterlooTodayStr(), []);

  useEffect(() => {
    if (!dateDropdownOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (dateDropdownRef.current && !dateDropdownRef.current.contains(event.target as Node)) {
        setDateDropdownOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDateDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [dateDropdownOpen]);

  // Published WUSA events
  const publishedEvents = useMemo(
    () => events.filter((e) => e.status !== 'draft' && (e.id.startsWith('wusa_') || e.sourceVerification === 'wusa_official')),
    [events]
  );

  // Resolve active Date Range bounds & exact display string
  const activeDateRange = useMemo(
    () => resolveDateRange(selectedDateFilter, customStartDate, customEndDate, todayStr),
    [selectedDateFilter, customStartDate, customEndDate, todayStr]
  );

  // Events filtered by non-date filters (used for accurate live date preset counts)
  const baseFilteredEvents = useMemo(() => {
    let filtered = [...publishedEvents];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.organizer.toLowerCase().includes(q) ||
          e.description.toLowerCase().includes(q) ||
          e.location.toLowerCase().includes(q) ||
          e.category.toLowerCase().includes(q)
      );
    }

    if (selectedCategory !== 'all') {
      filtered = filtered.filter((e) => e.category === selectedCategory);
    }

    if (selectedLocation !== 'all') {
      filtered = filtered.filter((e) => matchesLocationBucket(e, selectedLocation));
    }

    if (selectedFaculty !== 'all') {
      filtered = filtered.filter(
        (e) =>
          !e.facultyAffiliation ||
          e.facultyAffiliation === 'All Faculties' ||
          e.facultyAffiliation === selectedFaculty
      );
    }

    if (priceFilter === 'free') {
      filtered = filtered.filter((e) => e.isFree);
    } else if (priceFilter === 'paid') {
      filtered = filtered.filter((e) => !e.isFree);
    }

    return filtered;
  }, [
    publishedEvents,
    searchQuery,
    selectedCategory,
    selectedLocation,
    selectedFaculty,
    priceFilter
  ]);

  // Counts for left filter panel (react to selected date range so list/map stay consistent)
  const dateFilteredEvents = useMemo(
    () => publishedEvents.filter((e) => eventOverlapsDateRange(e, activeDateRange)),
    [publishedEvents, activeDateRange]
  );

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: dateFilteredEvents.length };
    for (const cat of EVENT_CATEGORIES) {
      counts[cat] = dateFilteredEvents.filter((e) => e.category === cat).length;
    }
    return counts;
  }, [dateFilteredEvents]);

  const locationCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const loc of LOCATION_BUCKETS) {
      counts[loc.id] = dateFilteredEvents.filter((e) => matchesLocationBucket(e, loc.id)).length;
    }
    return counts;
  }, [dateFilteredEvents]);

  const priceCounts = useMemo(() => ({
    all: dateFilteredEvents.length,
    free: dateFilteredEvents.filter((e) => e.isFree).length,
    paid: dateFilteredEvents.filter((e) => !e.isFree).length
  }), [dateFilteredEvents]);

  // Date preset ranges & live overlap counts
  const datePresetSummaries = useMemo(() => {
    const presets: { id: Exclude<DateRangePreset, 'custom'>; label: string; hint?: string }[] = [
      { id: 'all', label: 'All dates' },
      { id: 'today', label: 'Today' },
      { id: 'thisWeek', label: 'This week', hint: 'Mon–Sun' },
      { id: 'thisWeekend', label: 'This weekend', hint: 'Sat–Sun' },
      { id: 'nextWeek', label: 'Next week', hint: 'Mon–Sun' }
    ];

    return presets.map((p) => {
      const resolved = resolveDateRange(p.id, '', '', todayStr);
      const count = baseFilteredEvents.filter((e) => eventOverlapsDateRange(e, resolved)).length;
      return {
        ...p,
        resolved,
        count
      };
    });
  }, [baseFilteredEvents, todayStr]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedCategory !== 'all') count++;
    if (selectedLocation !== 'all') count++;
    if (selectedDateFilter !== 'all') count++;
    if (selectedFaculty !== 'all') count++;
    if (priceFilter !== 'all') count++;
    return count;
  }, [selectedCategory, selectedLocation, selectedDateFilter, selectedFaculty, priceFilter]);

  const hasAnyFilterOrSearch = activeFiltersCount > 0 || Boolean(searchQuery.trim());

  const resetAllFilters = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    setSelectedLocation('all');
    setSelectedDateFilter('all');
    setCustomStartDate('');
    setCustomEndDate('');
    setSelectedFaculty('all');
    setPriceFilter('all');
  };

  const resetDateFilterOnly = () => {
    setSelectedDateFilter('all');
    setCustomStartDate('');
    setCustomEndDate('');
  };

  // Filtered and ranked events (shared across List and Map views)
  const displayedEvents = useMemo(() => {
    const filtered = baseFilteredEvents.filter((e) => eventOverlapsDateRange(e, activeDateRange));

    if (feedMode === 'forYou') {
      return rankForYouEvents(filtered);
    } else {
      return [...filtered].sort((a, b) => (a.date > b.date ? 1 : -1));
    }
  }, [baseFilteredEvents, activeDateRange, feedMode, rankForYouEvents]);

  const renderFilterSections = () => (
    <div className="space-y-6">
      {/* Categories */}
      <div className="space-y-2.5">
        <h3 className="text-xs font-semibold text-stone-400 tracking-wide">
          Categories
        </h3>
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className="w-full flex items-center justify-between py-1.5 text-left group cursor-pointer"
          >
            <span className="flex items-center gap-2.5 min-w-0">
              <span
                className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                  selectedCategory === 'all'
                    ? 'border-stone-950 bg-amber-400'
                    : 'border-stone-300 bg-white group-hover:border-stone-400'
                }`}
              >
                {selectedCategory === 'all' && <span className="w-1.5 h-1.5 rounded-full bg-stone-950" />}
              </span>
              <span
                className={`text-xs truncate ${
                  selectedCategory === 'all' ? 'font-bold text-stone-950' : 'text-stone-700 group-hover:text-stone-950'
                }`}
              >
                All Categories
              </span>
            </span>
            <span className="text-xs text-stone-400 tabular-nums shrink-0 pl-2">
              {categoryCounts.all}
            </span>
          </button>

          {EVENT_CATEGORIES.map((cat) => {
            const active = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className="w-full flex items-center justify-between py-1.5 text-left group cursor-pointer"
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                      active
                        ? 'border-stone-950 bg-amber-400'
                        : 'border-stone-300 bg-white group-hover:border-stone-400'
                    }`}
                  >
                    {active && <span className="w-1.5 h-1.5 rounded-full bg-stone-950" />}
                  </span>
                  <span
                    className={`text-xs truncate ${
                      active ? 'font-bold text-stone-950' : 'text-stone-700 group-hover:text-stone-950'
                    }`}
                  >
                    {cat}
                  </span>
                </span>
                <span className="text-xs text-stone-400 tabular-nums shrink-0 pl-2">
                  {categoryCounts[cat] ?? 0}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="border-t border-stone-100" />

      {/* Campus Location */}
      <div className="space-y-2.5">
        <h3 className="text-xs font-semibold text-stone-400 tracking-wide">
          Location
        </h3>
        <div className="space-y-1">
          {LOCATION_BUCKETS.map((loc) => {
            const active = selectedLocation === loc.id;
            return (
              <button
                key={loc.id}
                type="button"
                onClick={() => setSelectedLocation(loc.id)}
                className="w-full flex items-center justify-between py-1.5 text-left group cursor-pointer"
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                      active
                        ? 'border-stone-950 bg-amber-400'
                        : 'border-stone-300 bg-white group-hover:border-stone-400'
                    }`}
                  >
                    {active && <span className="w-1.5 h-1.5 rounded-full bg-stone-950" />}
                  </span>
                  <span
                    className={`text-xs truncate ${
                      active ? 'font-bold text-stone-950' : 'text-stone-700 group-hover:text-stone-950'
                    }`}
                  >
                    {loc.label}
                  </span>
                </span>
                <span className="text-xs text-stone-400 tabular-nums shrink-0 pl-2">
                  {locationCounts[loc.id] ?? 0}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="border-t border-stone-100" />

      {/* Price Level */}
      <div className="space-y-2.5">
        <h3 className="text-xs font-semibold text-stone-400 tracking-wide">
          Price Level
        </h3>
        <div className="space-y-1">
          {[
            { id: 'all' as const, label: 'All Events', count: priceCounts.all },
            { id: 'free' as const, label: 'Free ($0)', count: priceCounts.free },
            { id: 'paid' as const, label: 'Ticketed ($)', count: priceCounts.paid }
          ].map((opt) => {
            const active = priceFilter === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setPriceFilter(opt.id)}
                className="w-full flex items-center justify-between py-1.5 text-left group cursor-pointer"
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                      active
                        ? 'border-stone-950 bg-amber-400'
                        : 'border-stone-300 bg-white group-hover:border-stone-400'
                    }`}
                  >
                    {active && <span className="w-1.5 h-1.5 rounded-full bg-stone-950" />}
                  </span>
                  <span
                    className={`text-xs truncate ${
                      active ? 'font-bold text-stone-950' : 'text-stone-700 group-hover:text-stone-950'
                    }`}
                  >
                    {opt.label}
                  </span>
                </span>
                <span className="text-xs text-stone-400 tabular-nums shrink-0 pl-2">
                  {opt.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="border-t border-stone-100" />

      {/* Faculty */}
      <div className="space-y-2">
        <label htmlFor="faculty-filter" className="block text-xs font-semibold text-stone-400 tracking-wide">
          Faculty Affiliation
        </label>
        <select
          id="faculty-filter"
          value={selectedFaculty}
          onChange={(e) => setSelectedFaculty(e.target.value)}
          className="w-full px-3 py-2 rounded-xl border border-stone-200 bg-stone-50/70 text-xs font-medium text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer"
        >
          <option value="all">All Faculties</option>
          {UW_FACULTIES.map((fac) => (
            <option key={fac} value={fac}>
              {fac}
            </option>
          ))}
        </select>
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[276px_minmax(0,1fr)] gap-6 lg:gap-7 items-start">
      {/* LEFT COLUMN: Top-Left Student Profile Card + Left Filters Sidebar */}
      <aside className="space-y-4 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:flex lg:flex-col">
        {/* TOP-LEFT STUDENT PROFILE CARD (Waterloo Goose Avatar) */}
        <section
          aria-label="Student Profile"
          className="bg-white rounded-2xl border border-stone-200/80 p-4 shadow-xs shrink-0"
        >
          {user ? (
            <div className="space-y-3.5">
              <div className="flex items-center gap-3.5">
                <button
                  type="button"
                  onClick={onOpenProfile}
                  className="relative shrink-0 cursor-pointer group focus:outline-none"
                  title="Open Student Profile"
                >
                  {!avatarError && user.avatar ? (
                    <img
                      src={user.avatar}
                      alt={`${user.name} Waterloo goose avatar`}
                      referrerPolicy="no-referrer"
                      onError={() => setAvatarError(true)}
                      className="w-14 h-14 rounded-full object-cover border-2 border-amber-400 shadow-2xs group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-amber-100 border-2 border-amber-400 flex items-center justify-center text-stone-900">
                      <UserIcon className="w-6 h-6" />
                    </div>
                  )}
                </button>

                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={onOpenProfile}
                    className="text-left group cursor-pointer focus:outline-none w-full"
                  >
                    <h2 className="text-sm font-bold text-stone-950 truncate group-hover:text-amber-700 transition-colors">
                      {user.name}
                    </h2>
                    <p className="text-xs text-stone-500 truncate mt-0.5">
                      {user.program} · {user.year}
                    </p>
                  </button>

                  <div className="flex items-center gap-1.5 mt-1 text-[11px] font-medium">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span className="text-stone-700 truncate">
                      {user.isVerifiedUWStudent ? 'UW Verified' : 'Unverified UW'} · {user.faculty}
                    </span>
                  </div>
                </div>
              </div>

              {/* Compact Going / Saved stats + Profile link */}
              <div className="pt-3 border-t border-stone-100 flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 text-stone-600 tabular-nums">
                  <span>
                    <strong className="text-stone-950 font-bold">{attendingEventIds.length}</strong> Going
                  </span>
                  <span aria-hidden="true" className="text-stone-300">·</span>
                  <span>
                    <strong className="text-stone-950 font-bold">{savedEventIds.length}</strong> Saved
                  </span>
                </div>

                {onOpenProfile && (
                  <button
                    type="button"
                    onClick={onOpenProfile}
                    className="text-xs font-semibold text-stone-900 hover:text-amber-700 flex items-center gap-1 cursor-pointer whitespace-nowrap"
                  >
                    <span>Profile</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-amber-100 border-2 border-amber-400 flex items-center justify-center text-stone-900 shrink-0">
                  <UserIcon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-bold text-stone-950">Waterloo Guest</h2>
                  <p className="text-xs text-stone-500">Sign in for buddy matching</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onOpenAuth}
                className="w-full py-2 px-3 rounded-xl bg-stone-950 hover:bg-stone-800 text-amber-400 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In / Demo Login</span>
              </button>
            </div>
          )}
        </section>

        {/* LEFT FILTERS PANEL (Desktop) */}
        <section
          aria-label="Event Filters"
          className="hidden lg:flex lg:flex-col bg-white rounded-2xl border border-stone-200/80 shadow-xs min-h-0 flex-1 overflow-hidden"
        >
          <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-stone-100 shrink-0">
            <h2 className="text-lg font-bold text-stone-950 tracking-tight">Filters</h2>
            <button
              type="button"
              onClick={resetAllFilters}
              className={`text-xs font-semibold transition-colors cursor-pointer ${
                activeFiltersCount > 0 || searchQuery
                  ? 'text-amber-700 hover:text-amber-900'
                  : 'text-stone-400 hover:text-stone-600'
              }`}
            >
              Reset
            </button>
          </div>

          <div className="p-5 pt-4 overflow-y-auto flex-1 min-h-0 filters-scroll">
            {renderFilterSections()}
          </div>
        </section>
      </aside>

      {/* RIGHT COLUMN: Top Header + Compact Top-Right Expandable Date Range + Search + Listings */}
      <div className="min-w-0 space-y-4">
        {/* Top Row: Title/Summary on Left + Controls & Compact Expandable Date Range on Top Right */}
        <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-stone-950 tracking-tight">
              Waterloo Campus Events
            </h1>
            <p className="text-xs sm:text-sm text-stone-500 mt-0.5 tabular-nums">
              Showing <strong className="text-stone-900 font-semibold">{displayedEvents.length}</strong> of {publishedEvents.length} official WUSA events across campus.
            </p>
          </div>

          {/* Top-Right Controls: Feed Mode + View Mode + Compact Expandable Date Range */}
          <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <div className="flex items-center p-1 bg-white rounded-xl border border-stone-200/80 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setFeedMode('forYou')}
                  className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                    feedMode === 'forYou'
                      ? 'bg-stone-950 text-amber-300'
                      : 'text-stone-600 hover:text-stone-950'
                  }`}
                >
                  For You
                </button>
                <button
                  type="button"
                  onClick={() => setFeedMode('all')}
                  className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                    feedMode === 'all'
                      ? 'bg-stone-950 text-amber-300'
                      : 'text-stone-600 hover:text-stone-950'
                  }`}
                >
                  All Events
                </button>
              </div>

              <div className="flex items-center p-1 bg-white rounded-xl border border-stone-200/80 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                    viewMode === 'list'
                      ? 'bg-amber-400 text-stone-950 font-bold'
                      : 'text-stone-600 hover:text-stone-950'
                  }`}
                >
                  <List className="w-3.5 h-3.5" />
                  <span>Grid</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('map')}
                  className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                    viewMode === 'map'
                      ? 'bg-amber-400 text-stone-950 font-bold'
                      : 'text-stone-600 hover:text-stone-950'
                  }`}
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Map</span>
                </button>
              </div>
            </div>

            {/* Compact Expandable Date Range Trigger (Top Right) */}
            <div ref={dateDropdownRef} className="relative ml-auto sm:ml-0">
              <button
                type="button"
                onClick={() => setDateDropdownOpen((prev) => !prev)}
                aria-expanded={dateDropdownOpen}
                aria-haspopup="dialog"
                className={`h-[38px] px-3 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shadow-2xs ${
                  selectedDateFilter !== 'all' || dateDropdownOpen
                    ? 'bg-amber-50 border-amber-300 text-stone-950'
                    : 'bg-white border-stone-200/80 text-stone-700 hover:border-stone-300 hover:text-stone-950'
                }`}
              >
                <Calendar
                  className={`w-3.5 h-3.5 shrink-0 ${
                    selectedDateFilter !== 'all' ? 'text-amber-700' : 'text-stone-500'
                  }`}
                />
                <span className="max-w-[165px] truncate tabular-nums">
                  {selectedDateFilter === 'all' ? 'Date range' : activeDateRange.exactLabel}
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 shrink-0 text-stone-400 transition-transform duration-150 ${
                    dateDropdownOpen ? 'rotate-180 text-stone-700' : ''
                  }`}
                />
              </button>

              {/* Expandable Vertical Date Range Options */}
              {dateDropdownOpen && (
                <div
                  role="dialog"
                  aria-label="Date Range Filter"
                  className="absolute right-0 top-full mt-2 z-[1100] w-[min(17.5rem,calc(100vw-2rem))] bg-white rounded-2xl border border-stone-200/90 shadow-xl p-3.5 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-stone-950">Date Range</span>
                    {selectedDateFilter !== 'all' ? (
                      <button
                        type="button"
                        onClick={() => {
                          resetDateFilterOnly();
                          setDateDropdownOpen(false);
                        }}
                        className="text-[11px] font-semibold text-amber-700 hover:text-amber-900 cursor-pointer"
                      >
                        Reset
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDateDropdownOpen(false)}
                        className="p-0.5 text-stone-400 hover:text-stone-700 rounded cursor-pointer"
                        aria-label="Close date range"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Vertical Preset List */}
                  <div className="space-y-0.5">
                    {datePresetSummaries.map((opt) => {
                      const active = selectedDateFilter === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            setSelectedDateFilter(opt.id);
                            setDateDropdownOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                            active ? 'bg-amber-50/90' : 'hover:bg-stone-50'
                          }`}
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            <span
                              className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                                active
                                  ? 'border-stone-950 bg-amber-400'
                                  : 'border-stone-300 bg-white'
                              }`}
                            >
                              {active && <span className="w-1.5 h-1.5 rounded-full bg-stone-950" />}
                            </span>
                            <span
                              className={`text-xs truncate ${
                                active ? 'font-bold text-stone-950' : 'text-stone-700'
                              }`}
                            >
                              {opt.label}
                            </span>
                            {opt.hint && (
                              <span className="text-[10px] text-stone-400 shrink-0">
                                {opt.hint}
                              </span>
                            )}
                          </span>
                          <span className="text-[11px] text-stone-400 tabular-nums shrink-0 pl-2">
                            {opt.count}
                          </span>
                        </button>
                      );
                    })}

                    {/* Custom date range option */}
                    <button
                      type="button"
                      onClick={() => setSelectedDateFilter('custom')}
                      className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                        selectedDateFilter === 'custom' ? 'bg-amber-50/90' : 'hover:bg-stone-50'
                      }`}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <span
                          className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                            selectedDateFilter === 'custom'
                              ? 'border-stone-950 bg-amber-400'
                              : 'border-stone-300 bg-white'
                          }`}
                        >
                          {selectedDateFilter === 'custom' && (
                            <span className="w-1.5 h-1.5 rounded-full bg-stone-950" />
                          )}
                        </span>
                        <span
                          className={`text-xs truncate ${
                            selectedDateFilter === 'custom'
                              ? 'font-bold text-stone-950'
                              : 'text-stone-700'
                          }`}
                        >
                          Custom date range
                        </span>
                      </span>
                    </button>
                  </div>

                  {/* Vertical Custom Start / End Date Inputs */}
                  {selectedDateFilter === 'custom' && (
                    <div className="pt-2 border-t border-stone-100 space-y-2">
                      <div className="space-y-1">
                        <label htmlFor="custom-date-start" className="block text-[11px] font-medium text-stone-500">
                          Start date
                        </label>
                        <input
                          id="custom-date-start"
                          type="date"
                          value={customStartDate}
                          onChange={(e) => setCustomStartDate(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-stone-200 bg-stone-50/70 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-400 tabular-nums"
                        />
                      </div>
                      <div className="space-y-1">
                        <label htmlFor="custom-date-end" className="block text-[11px] font-medium text-stone-500">
                          End date
                        </label>
                        <input
                          id="custom-date-end"
                          type="date"
                          value={customEndDate}
                          onChange={(e) => setCustomEndDate(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-stone-200 bg-stone-50/70 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-400 tabular-nums"
                        />
                      </div>
                      {customStartDate && customEndDate && customStartDate > customEndDate && (
                        <p className="text-[11px] text-amber-700 font-medium">
                          Dates automatically ordered from earlier to later.
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={() => setDateDropdownOpen(false)}
                        className="w-full py-1.5 rounded-lg bg-stone-950 hover:bg-stone-800 text-amber-300 text-xs font-bold transition-colors cursor-pointer"
                      >
                        Apply range
                      </button>
                    </div>
                  )}

                  {/* Exact Selected Dates Footer */}
                  <div className="pt-2 border-t border-stone-100 text-[11px] text-stone-500 flex items-center justify-between gap-2">
                    <span>Selected:</span>
                    <span className="font-semibold text-stone-900 tabular-nums text-right truncate">
                      {activeDateRange.exactLabel}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Search Bar & Mobile Filter Trigger */}
        <div className="flex items-center gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by event title, club, campus building, topic..."
              className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-stone-200/90 bg-white text-xs sm:text-sm text-stone-950 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400 shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-700 rounded-full cursor-pointer"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}
            className={`lg:hidden px-3.5 py-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition-colors shrink-0 cursor-pointer ${
              activeFiltersCount > 0 || mobileFiltersOpen
                ? 'bg-amber-400 border-amber-400 text-stone-950'
                : 'bg-white border-stone-200 text-stone-700 hover:border-stone-300'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Filters</span>
            {activeFiltersCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-md bg-stone-950 text-amber-300 text-[10px] font-bold tabular-nums">
                {activeFiltersCount}
              </span>
            )}
          </button>

          {onOpenWusaCollector && (
            <button
              type="button"
              onClick={onOpenWusaCollector}
              className="hidden sm:flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 text-xs font-semibold shrink-0 transition-colors cursor-pointer"
              title="Open WUSA Collector Database & Sync"
            >
              <Database className="w-3.5 h-3.5 text-amber-600" />
              <span>WUSA Sync</span>
            </button>
          )}
        </div>

        {/* Mobile Collapsible Filters Panel */}
        {mobileFiltersOpen && (
          <div className="lg:hidden bg-white rounded-2xl border border-stone-200/80 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-stone-100">
              <h3 className="text-base font-bold text-stone-950">Filters</h3>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={resetAllFilters}
                  className="text-xs font-semibold text-amber-700 hover:text-amber-900"
                >
                  Clear filters
                </button>
                <button
                  type="button"
                  onClick={() => setMobileFiltersOpen(false)}
                  className="p-1 text-stone-400 hover:text-stone-700"
                  aria-label="Close filters"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            {renderFilterSections()}
          </div>
        )}

        {/* Active Filters, Exact Selected Dates & Personalization Strip */}
        {(hasAnyFilterOrSearch || (feedMode === 'forYou' && user && onOpenPreferences)) && (
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-stone-500">
            <div className="flex flex-wrap items-center gap-2">
              {selectedDateFilter !== 'all' && (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-900 bg-amber-100/90 border border-amber-300/80 px-2.5 py-1 rounded-lg tabular-nums">
                  <Calendar className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                  <span>{activeDateRange.exactLabel}</span>
                </span>
              )}
              {hasAnyFilterOrSearch && (
                <>
                  <span className="font-medium text-stone-700">
                    {activeFiltersCount} filter{activeFiltersCount === 1 ? '' : 's'}
                    {searchQuery.trim() ? ' + search' : ''} active
                  </span>
                  <button
                    type="button"
                    onClick={resetAllFilters}
                    className="text-amber-800 hover:text-amber-950 font-semibold underline underline-offset-2 cursor-pointer"
                  >
                    Clear filters
                  </button>
                </>
              )}
            </div>

            {feedMode === 'forYou' && user && onOpenPreferences && (
              <div className="flex items-center gap-1.5 ml-auto">
                <span>Personalized for {user.faculty}</span>
                <span aria-hidden="true">·</span>
                <button
                  type="button"
                  onClick={onOpenPreferences}
                  className="text-stone-800 hover:text-amber-700 font-semibold underline underline-offset-2 cursor-pointer"
                >
                  Edit interests
                </button>
              </div>
            )}
          </div>
        )}

        {/* Feed Content: 3-Column Grid or Campus Map */}
        {viewMode === 'map' ? (
          <CampusEventMap
            events={displayedEvents}
            onSelectEvent={(ev) => setSelectedEventForDetail(ev)}
            onClearFilters={resetAllFilters}
            onSwitchToList={() => setViewMode('list')}
            activeDateLabel={selectedDateFilter !== 'all' ? activeDateRange.exactLabel : undefined}
          />
        ) : displayedEvents.length === 0 ? (
          <div className="p-10 sm:p-12 bg-white rounded-2xl border border-stone-200/80 text-center space-y-4 shadow-xs">
            <Calendar className="w-10 h-10 text-stone-300 mx-auto" />
            <div className="space-y-1.5">
              <h3 className="font-bold text-stone-950 text-base">
                No events found{selectedDateFilter !== 'all' ? ` for ${activeDateRange.exactLabel}` : ''}
              </h3>
              <p className="text-xs text-stone-500 max-w-md mx-auto leading-relaxed">
                {selectedDateFilter !== 'all'
                  ? `No Waterloo events overlap ${activeDateRange.exactLabel} with your current filters. Try another date window or clear your filters to browse all events.`
                  : 'Try adjusting your search query or clearing your active filters to explore more Waterloo campus events.'}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={resetAllFilters}
                className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-stone-950 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Clear filters
              </button>
              {datePresetSummaries
                .filter((p) => p.id !== 'all' && p.id !== selectedDateFilter && p.count > 0)
                .slice(0, 2)
                .map((suggestion) => (
                  <button
                    key={suggestion.id}
                    type="button"
                    onClick={() => setSelectedDateFilter(suggestion.id)}
                    className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold rounded-xl transition-colors cursor-pointer tabular-nums"
                  >
                    {suggestion.label} ({suggestion.count})
                  </button>
                ))}
              <button
                type="button"
                onClick={() => setViewMode('map')}
                className="px-4 py-2 bg-stone-950 hover:bg-stone-800 text-amber-300 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                View on Campus Map
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {displayedEvents.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                onSelect={(ev) => setSelectedEventForDetail(ev)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Event Detail Modal */}
      {selectedEventForDetail && (
        <EventDetailModal
          event={selectedEventForDetail}
          isOpen={Boolean(selectedEventForDetail)}
          onClose={() => setSelectedEventForDetail(null)}
          onNavigateToMessages={onNavigateToMessages}
        />
      )}
    </div>
  );
};
