import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Search,
  SlidersHorizontal,
  X,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  RotateCcw
} from 'lucide-react';
import { useReducedMotion } from 'motion/react';
import { EventItem } from '../../types';
import { useApp } from '../../context/AppContext';
import { EventCard } from './EventCard';
import { EventDetailModal } from './EventDetailModal';
import { Goose } from '../common/Goose';
import { EVENT_CATEGORIES, UW_FACULTIES } from '../../data/mockData';
import { getTorontoNow } from '../../utils/timeZone';
import {
  DateRangePreset,
  resolveDateRange,
  eventOverlapsDateRange
} from '../../utils/dateRange';

interface FeedTabProps {
  onNavigateToMessages?: () => void;
  onOpenPreferences?: () => void;
  onOpenProfile?: () => void;
  onOpenAuth?: () => void;
}

type LocationBucket = 'all' | 'slc' | 'eng' | 'mc_dc' | 'pac_cif' | 'online' | 'off_campus';
type SectionKey = 'category' | 'faculty' | 'location' | 'price';

const SIDEBAR_MIN_WIDTH = 220;
const SIDEBAR_MAX_WIDTH = 420;
const SIDEBAR_DEFAULT_WIDTH = 280;
const COLLAPSED_RAIL_WIDTH = 48;

const STORAGE_OPEN_KEY = 'wathive_filters_open';
const STORAGE_WIDTH_KEY = 'wathive_filters_width';
const STORAGE_ACCORDION_KEY = 'wathive_filters_collapsed';

const LOCATION_BUCKETS: { id: LocationBucket; label: string }[] = [
  { id: 'all', label: 'All Locations' },
  { id: 'slc', label: 'Student Life Centre (SLC)' },
  { id: 'eng', label: 'Engineering (E5 / E7)' },
  { id: 'mc_dc', label: 'Math & Davis (MC / DC)' },
  { id: 'pac_cif', label: 'Athletics (PAC / CIF)' },
  { id: 'online', label: 'Online / Virtual' },
  { id: 'off_campus', label: 'Off-Campus & Uptown' }
];

function matchesLocationBucket(ev: EventItem, bucket: LocationBucket): boolean {
  if (bucket === 'all') return true;
  const loc = (ev.location + ' ' + (ev.venueName || '')).toLowerCase();
  if (bucket === 'online') {
    return ev.isOnline || loc.includes('online') || loc.includes('virtual') || loc.includes('zoom');
  }
  if (bucket === 'slc') {
    return (
      loc.includes('slc') ||
      loc.includes('student life') ||
      loc.includes('great hall') ||
      loc.includes('black and gold') ||
      loc.includes('multi-purpose')
    );
  }
  if (bucket === 'eng') {
    return loc.includes('e7') || loc.includes('e5') || loc.includes('e2') || loc.includes('engineering') || loc.includes('cph');
  }
  if (bucket === 'mc_dc') {
    return loc.includes('mc ') || loc.includes('mc,') || loc.includes('math') || loc.includes('davis') || loc.includes('dc ');
  }
  if (bucket === 'pac_cif') {
    return loc.includes('pac') || loc.includes('cif') || loc.includes('icefield') || loc.includes('physical activities') || loc.includes('gym');
  }
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

function readStoredBool(key: string, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(key);
    if (raw === '0' || raw === 'false') return false;
    if (raw === '1' || raw === 'true') return true;
  } catch {
    // ignore storage errors
  }
  return fallback;
}

function readStoredWidth(): number {
  try {
    const raw = localStorage.getItem(STORAGE_WIDTH_KEY);
    if (raw !== null) {
      const parsed = parseInt(raw, 10);
      if (Number.isFinite(parsed)) {
        return Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, parsed));
      }
    }
  } catch {
    // ignore storage errors
  }
  return SIDEBAR_DEFAULT_WIDTH;
}

function readStoredCollapsedSections(): Partial<Record<SectionKey, boolean>> {
  try {
    const raw = localStorage.getItem(STORAGE_ACCORDION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    }
  } catch {
    // ignore storage errors
  }
  return {};
}

export const FeedTab: React.FC<FeedTabProps> = ({ onNavigateToMessages }) => {
  const { events, getEventAttendees } = useApp();
  const prefersReduced = Boolean(useReducedMotion());

  const [sortMode, setSortMode] = useState<'soonest' | 'buddies'>('soonest');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedLocation, setSelectedLocation] = useState<LocationBucket>('all');
  const [selectedDateFilter, setSelectedDateFilter] = useState<DateRangePreset>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [selectedFaculty, setSelectedFaculty] = useState<string>('all');
  const [priceFilter, setPriceFilter] = useState<'all' | 'free' | 'paid'>('all');

  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() =>
    readStoredBool(STORAGE_OPEN_KEY, true)
  );
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => readStoredWidth());
  const [isResizing, setIsResizing] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Partial<Record<SectionKey, boolean>>>(() =>
    readStoredCollapsedSections()
  );
  const [expandedLists, setExpandedLists] = useState<Partial<Record<SectionKey, boolean>>>({});

  const [customRangeOpen, setCustomRangeOpen] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [selectedEventForDetail, setSelectedEventForDetail] = useState<EventItem | null>(null);

  const customRangeRef = useRef<HTMLDivElement | null>(null);
  const todayStr = getTorontoNow().dateStr;

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_OPEN_KEY, sidebarOpen ? '1' : '0');
    } catch {
      // ignore storage errors
    }
  }, [sidebarOpen]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_WIDTH_KEY, String(sidebarWidth));
    } catch {
      // ignore storage errors
    }
  }, [sidebarWidth]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_ACCORDION_KEY, JSON.stringify(collapsedSections));
    } catch {
      // ignore storage errors
    }
  }, [collapsedSections]);

  useEffect(() => {
    if (!customRangeOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (customRangeRef.current && !customRangeRef.current.contains(e.target as Node)) {
        setCustomRangeOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCustomRangeOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [customRangeOpen]);

  const startResize = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!sidebarOpen) return;
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidebarWidth;
    setIsResizing(true);

    const prevUserSelect = document.body.style.userSelect;
    const prevCursor = document.body.style.cursor;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    const onPointerMove = (moveEvent: PointerEvent) => {
      const delta = moveEvent.clientX - startX;
      const next = Math.max(
        SIDEBAR_MIN_WIDTH,
        Math.min(SIDEBAR_MAX_WIDTH, Math.round(startWidth + delta))
      );
      setSidebarWidth(next);
    };

    const stopResize = () => {
      setIsResizing(false);
      document.body.style.userSelect = prevUserSelect;
      document.body.style.cursor = prevCursor;
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', stopResize);
      window.removeEventListener('pointercancel', stopResize);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', stopResize);
    window.addEventListener('pointercancel', stopResize);
  };

  const handleResizeKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!sidebarOpen) return;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setSidebarWidth((w) => Math.max(SIDEBAR_MIN_WIDTH, w - 16));
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setSidebarWidth((w) => Math.min(SIDEBAR_MAX_WIDTH, w + 16));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setSidebarWidth(SIDEBAR_DEFAULT_WIDTH);
    }
  };

  // Published WUSA and approved community events (non-archived, non-past from AppContext)
  const publishedEvents = useMemo(
    () =>
      events.filter(
        (e) =>
          e.status !== 'draft' &&
          e.status !== 'ended' &&
          e.moderationStatus !== 'rejected' &&
          e.moderationStatus !== 'pending_review' &&
          (e.id.startsWith('wusa_') ||
            e.sourceVerification === 'wusa_official' ||
            (e.sourceVerification === 'community_partner' && e.moderationStatus === 'approved'))
      ),
    [events]
  );

  const activeDateRange = useMemo(
    () => resolveDateRange(selectedDateFilter, customStartDate, customEndDate, todayStr),
    [selectedDateFilter, customStartDate, customEndDate, todayStr]
  );

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
  }, [publishedEvents, searchQuery, selectedCategory, selectedLocation, selectedFaculty, priceFilter]);

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

  const facultyCounts = useMemo(() => {
    const counts: Record<string, number> = { all: dateFilteredEvents.length };
    for (const fac of UW_FACULTIES) {
      counts[fac] = dateFilteredEvents.filter(
        (e) =>
          !e.facultyAffiliation ||
          e.facultyAffiliation === 'All Faculties' ||
          e.facultyAffiliation === fac
      ).length;
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

  const priceCounts = useMemo(
    () => ({
      all: dateFilteredEvents.length,
      free: dateFilteredEvents.filter((e) => e.isFree).length,
      paid: dateFilteredEvents.filter((e) => !e.isFree).length
    }),
    [dateFilteredEvents]
  );

  const datePresetSummaries = useMemo(() => {
    const presets: { id: Exclude<DateRangePreset, 'all' | 'custom'>; label: string }[] = [
      { id: 'today', label: 'Today' },
      { id: 'thisWeek', label: 'This week' },
      { id: 'thisWeekend', label: 'This weekend' },
      { id: 'nextWeek', label: 'Next week' }
    ];

    return presets.map((p) => {
      const resolved = resolveDateRange(p.id, '', '', todayStr);
      const count = baseFilteredEvents.filter((e) => eventOverlapsDateRange(e, resolved)).length;
      return { ...p, resolved, count };
    });
  }, [baseFilteredEvents, todayStr]);

  const sidebarFiltersCount =
    (selectedCategory !== 'all' ? 1 : 0) +
    (selectedFaculty !== 'all' ? 1 : 0) +
    (selectedLocation !== 'all' ? 1 : 0) +
    (priceFilter !== 'all' ? 1 : 0);

  const activeChips = useMemo(() => {
    const chips: { key: string; label: string; onClear: () => void }[] = [];
    if (searchQuery.trim()) {
      chips.push({
        key: 'search',
        label: `"${searchQuery.trim()}"`,
        onClear: () => setSearchQuery('')
      });
    }
    if (selectedDateFilter !== 'all' && activeDateRange.isFiltered) {
      chips.push({
        key: 'date',
        label: activeDateRange.exactLabel,
        onClear: () => {
          setSelectedDateFilter('all');
          setCustomStartDate('');
          setCustomEndDate('');
        }
      });
    }
    if (selectedCategory !== 'all') {
      chips.push({
        key: 'category',
        label: selectedCategory,
        onClear: () => setSelectedCategory('all')
      });
    }
    if (selectedFaculty !== 'all') {
      chips.push({
        key: 'faculty',
        label: selectedFaculty,
        onClear: () => setSelectedFaculty('all')
      });
    }
    if (selectedLocation !== 'all') {
      const locLabel =
        LOCATION_BUCKETS.find((l) => l.id === selectedLocation)?.label || selectedLocation;
      chips.push({
        key: 'location',
        label: locLabel,
        onClear: () => setSelectedLocation('all')
      });
    }
    if (priceFilter !== 'all') {
      chips.push({
        key: 'price',
        label: priceFilter === 'free' ? 'Free only' : 'Paid only',
        onClear: () => setPriceFilter('all')
      });
    }
    return chips;
  }, [
    searchQuery,
    selectedDateFilter,
    activeDateRange,
    selectedCategory,
    selectedFaculty,
    selectedLocation,
    priceFilter
  ]);

  const hasAnyFilterOrSearch = activeChips.length > 0;

  const resetSidebarFilters = () => {
    setSelectedCategory('all');
    setSelectedFaculty('all');
    setSelectedLocation('all');
    setPriceFilter('all');
  };

  const resetAllFilters = () => {
    setSearchQuery('');
    resetSidebarFilters();
    setSelectedDateFilter('all');
    setCustomStartDate('');
    setCustomEndDate('');
  };

  const displayedEvents = useMemo(() => {
    const filtered = baseFilteredEvents.filter((e) => eventOverlapsDateRange(e, activeDateRange));
    const compareSoonest = (a: EventItem, b: EventItem) =>
      a.date !== b.date
        ? a.date.localeCompare(b.date)
        : a.startTime.localeCompare(b.startTime);

    if (sortMode === 'buddies') {
      return [...filtered].sort((a, b) => {
        const countDiff = getEventAttendees(b.id).length - getEventAttendees(a.id).length;
        return countDiff !== 0 ? countDiff : compareSoonest(a, b);
      });
    }

    return [...filtered].sort(compareSoonest);
  }, [baseFilteredEvents, activeDateRange, sortMode, getEventAttendees]);

  const toggleAccordion = (key: SectionKey) => {
    setCollapsedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleShowMore = (key: SectionKey) => {
    setExpandedLists((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const FilterSectionOption: React.FC<{
    active: boolean;
    label: string;
    count: number;
    onClick: () => void;
  }> = ({ active, label, count, onClick }) => (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl text-xs transition-colors cursor-pointer text-left ${
        active
          ? 'bg-accent-soft text-ink font-semibold'
          : 'text-muted hover:text-ink hover:bg-surface-soft/50'
      }`}
    >
      <span className="flex items-center gap-2 min-w-0">
        <span
          className={`w-2 h-2 rounded-full shrink-0 transition-colors ${
            active ? 'bg-accent ring-2 ring-accent/30' : 'bg-line'
          }`}
        />
        <span className="truncate">{label}</span>
      </span>
      <span className="text-[11px] tabular-nums shrink-0 opacity-80">{count}</span>
    </button>
  );

  const renderAccordionSection = (
    key: SectionKey,
    title: string,
    options: { id: string; label: string; count: number; active: boolean; onClick: () => void }[],
    withTopDivider: boolean
  ) => {
    const isCollapsed = Boolean(collapsedSections[key]);
    const isExpanded = Boolean(expandedLists[key]);
    const hasOverflow = options.length > 6;
    const visibleOptions = hasOverflow && !isExpanded ? options.slice(0, 6) : options;

    return (
      <div className={withTopDivider ? 'pt-3.5 border-t border-line' : ''}>
        <button
          type="button"
          onClick={() => toggleAccordion(key)}
          aria-expanded={!isCollapsed}
          className="w-full flex items-center justify-between px-2.5 py-1 text-left cursor-pointer group"
        >
          <span className="text-xs font-semibold text-ink">{title}</span>
          <ChevronDown
            className={`w-3.5 h-3.5 text-muted group-hover:text-ink ${
              prefersReduced ? '' : 'transition-transform duration-150'
            } ${isCollapsed ? '-rotate-90' : ''}`}
          />
        </button>

        {!isCollapsed && (
          <div className="mt-1.5 space-y-0.5">
            {visibleOptions.map((opt) => (
              <FilterSectionOption
                key={opt.id}
                active={opt.active}
                label={opt.label}
                count={opt.count}
                onClick={opt.onClick}
              />
            ))}
            {hasOverflow && (
              <button
                type="button"
                onClick={() => toggleShowMore(key)}
                className="px-2.5 py-1 text-xs font-semibold text-accent-text hover:underline cursor-pointer"
              >
                {isExpanded ? 'Show less' : `Show more (${options.length - 6})`}
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderFilterGroups = () => {
    const categoryOptions = [
      {
        id: 'all',
        label: 'All categories',
        count: categoryCounts.all,
        active: selectedCategory === 'all',
        onClick: () => setSelectedCategory('all')
      },
      ...EVENT_CATEGORIES.map((cat) => ({
        id: cat,
        label: cat,
        count: categoryCounts[cat] ?? 0,
        active: selectedCategory === cat,
        onClick: () => setSelectedCategory(cat)
      }))
    ];

    const facultyOptions = [
      {
        id: 'all',
        label: 'All Faculties',
        count: facultyCounts.all,
        active: selectedFaculty === 'all',
        onClick: () => setSelectedFaculty('all')
      },
      ...UW_FACULTIES.map((fac) => ({
        id: fac,
        label: fac,
        count: facultyCounts[fac] ?? 0,
        active: selectedFaculty === fac,
        onClick: () => setSelectedFaculty(fac)
      }))
    ];

    const locationOptions = LOCATION_BUCKETS.map((loc) => ({
      id: loc.id,
      label: loc.label,
      count: locationCounts[loc.id] ?? 0,
      active: selectedLocation === loc.id,
      onClick: () => setSelectedLocation(loc.id)
    }));

    const priceOptions = [
      {
        id: 'all',
        label: 'All prices',
        count: priceCounts.all,
        active: priceFilter === 'all',
        onClick: () => setPriceFilter('all')
      },
      {
        id: 'free',
        label: 'Free',
        count: priceCounts.free,
        active: priceFilter === 'free',
        onClick: () => setPriceFilter('free')
      },
      {
        id: 'paid',
        label: 'Paid',
        count: priceCounts.paid,
        active: priceFilter === 'paid',
        onClick: () => setPriceFilter('paid')
      }
    ];

    return (
      <div className="space-y-3.5">
        {renderAccordionSection('category', 'Categories', categoryOptions, false)}
        {renderAccordionSection('faculty', 'Faculty', facultyOptions, true)}
        {renderAccordionSection('location', 'Location', locationOptions, true)}
        {renderAccordionSection('price', 'Price', priceOptions, true)}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink tracking-tight">
            Campus Events
          </h1>
          <p className="text-sm text-muted mt-1 tabular-nums">
            Showing <strong className="text-ink font-semibold">{displayedEvents.length}</strong>{' '}
            {displayedEvents.length === 1 ? 'event' : 'events'}
          </p>
        </div>

        {/* Filters Toggle + Sort */}
        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          {/* Desktop Sidebar Toggle */}
          <button
            type="button"
            onClick={() => setSidebarOpen((prev) => !prev)}
            aria-expanded={sidebarOpen}
            className="hidden md:inline-flex h-10 px-3.5 rounded-2xl border border-line bg-surface hover:bg-surface-soft text-ink text-xs font-semibold items-center gap-2 shadow-soft cursor-pointer transition-colors"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-accent-text" />
            <span>Filters</span>
            {sidebarFiltersCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-accent text-accent-ink text-xs font-bold tabular-nums leading-none">
                {sidebarFiltersCount}
              </span>
            )}
          </button>

          {/* Mobile Drawer Trigger */}
          <button
            type="button"
            onClick={() => setMobileDrawerOpen(true)}
            className="md:hidden h-10 px-3.5 rounded-2xl border border-line bg-surface text-ink text-xs font-semibold flex items-center gap-2 shadow-soft cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-accent-text" />
            <span>Filters</span>
            {sidebarFiltersCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-accent text-accent-ink text-xs font-bold tabular-nums leading-none">
                {sidebarFiltersCount}
              </span>
            )}
          </button>

          <div className="relative">
            <label htmlFor="events-sort" className="sr-only">
              Sort by
            </label>
            <select
              id="events-sort"
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as 'soonest' | 'buddies')}
              className="h-10 pl-3.5 pr-9 rounded-2xl border border-line bg-surface text-ink text-xs font-semibold shadow-soft appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="soonest">Sort by: Soonest</option>
              <option value="buddies">Sort by: Most buddies</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-muted absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Responsive 2-Column Layout: Collapsible/Resizable Sidebar + Fluid Auto-Fill Grid */}
      <div className="flex flex-col md:flex-row gap-6 items-start">
        {/* Desktop Collapsible & Resizable Filter Sidebar (md and up) */}
        <aside
          aria-label="Event filters"
          style={{ width: sidebarOpen ? sidebarWidth : COLLAPSED_RAIL_WIDTH }}
          className={`hidden md:block shrink-0 sticky top-20 self-start relative ${
            isResizing || prefersReduced ? '' : 'transition-[width] duration-200 ease-out'
          }`}
        >
          {sidebarOpen ? (
            <div className="relative bg-surface rounded-3xl border border-line shadow-soft flex flex-col max-h-[calc(100vh-6.5rem)]">
              <div className="px-5 pt-5 pb-3 border-b border-line flex items-center justify-between gap-2 shrink-0">
                <h2 className="font-display text-base font-bold text-ink">Filters</h2>
                <div className="flex items-center gap-2">
                  {sidebarFiltersCount > 0 && (
                    <button
                      type="button"
                      onClick={resetSidebarFilters}
                      className="text-xs font-semibold text-accent-text hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setSidebarOpen(false)}
                    aria-label="Collapse filters sidebar"
                    title="Collapse filters"
                    className="w-7 h-7 rounded-xl text-muted hover:text-ink hover:bg-surface-soft flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="p-5 overflow-y-auto filters-scroll flex-1">
                {renderFilterGroups()}
              </div>

              {/* Draggable & Keyboard-Accessible Right-Edge Resize Handle */}
              <div
                role="separator"
                tabIndex={0}
                aria-orientation="vertical"
                aria-label="Resize filters sidebar"
                aria-valuemin={SIDEBAR_MIN_WIDTH}
                aria-valuemax={SIDEBAR_MAX_WIDTH}
                aria-valuenow={sidebarWidth}
                onPointerDown={startResize}
                onDoubleClick={() => setSidebarWidth(SIDEBAR_DEFAULT_WIDTH)}
                onKeyDown={handleResizeKeyDown}
                title="Drag to resize or double-click to reset"
                className="group absolute top-4 bottom-4 -right-1.5 w-3 cursor-col-resize touch-none flex items-center justify-center rounded-full focus-visible:outline-2"
              >
                <span className="w-1 h-10 rounded-full bg-line group-hover:bg-accent group-focus-visible:bg-accent transition-colors" />
              </div>
            </div>
          ) : (
            /* Collapsed 48px Slim Rail */
            <div className="bg-surface rounded-2xl border border-line shadow-soft py-3 flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                aria-label="Expand filters sidebar"
                title="Expand filters"
                className="w-8 h-8 rounded-xl text-ink hover:bg-surface-soft flex items-center justify-center transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                aria-label={`Open filters (${sidebarFiltersCount} active)`}
                title="Filters"
                className="relative w-8 h-8 rounded-xl text-accent-text hover:bg-surface-soft flex items-center justify-center transition-colors cursor-pointer"
              >
                <SlidersHorizontal className="w-4 h-4" />
                {sidebarFiltersCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-accent text-accent-ink text-[11px] font-bold tabular-nums flex items-center justify-center leading-none">
                    {sidebarFiltersCount}
                  </span>
                )}
              </button>
            </div>
          )}
        </aside>

        {/* Right Main Column (expands automatically when sidebar shrinks/collapses) */}
        <div className="min-w-0 flex-1 w-full space-y-5">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-muted absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search events, clubs, buildings, or topics..."
              aria-label="Search campus events"
              className="w-full pl-11 pr-10 py-3 rounded-2xl border border-line bg-surface text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent shadow-soft"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted hover:text-ink rounded-full cursor-pointer"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Date Filter Bar */}
          <div className="flex flex-wrap items-center gap-2 relative" ref={customRangeRef}>
            {datePresetSummaries.map((opt) => {
              const active = selectedDateFilter === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setSelectedDateFilter((prev) => (prev === opt.id ? 'all' : opt.id));
                    setCustomRangeOpen(false);
                  }}
                  className={`px-3.5 py-2 rounded-2xl text-xs font-semibold transition-colors cursor-pointer tabular-nums ${
                    active
                      ? 'bg-accent text-accent-ink shadow-soft'
                      : 'bg-surface border border-line text-muted hover:text-ink'
                  }`}
                >
                  {opt.label} ({opt.count})
                </button>
              );
            })}

            <div className="relative">
              <button
                type="button"
                aria-pressed={selectedDateFilter === 'custom'}
                onClick={() => {
                  setSelectedDateFilter((prev) =>
                    prev === 'custom' && customRangeOpen ? 'all' : 'custom'
                  );
                  setCustomRangeOpen((prev) => !prev);
                }}
                aria-expanded={customRangeOpen}
                className={`px-3.5 py-2 rounded-2xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                  selectedDateFilter === 'custom'
                    ? 'bg-accent text-accent-ink shadow-soft'
                    : 'bg-surface border border-line text-muted hover:text-ink'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Custom range</span>
              </button>

              {customRangeOpen && (
                <div
                  role="dialog"
                  aria-label="Custom date range"
                  className="absolute left-0 sm:left-auto sm:right-0 top-full mt-2 z-30 w-72 bg-surface rounded-3xl border border-line shadow-lift p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-ink">Select date window</span>
                    <button
                      type="button"
                      onClick={() => setCustomRangeOpen(false)}
                      className="p-1 text-muted hover:text-ink rounded-full cursor-pointer"
                      aria-label="Close custom range"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label htmlFor="custom-date-start" className="block text-xs text-muted mb-1">
                        Start date
                      </label>
                      <input
                        id="custom-date-start"
                        type="date"
                        value={customStartDate}
                        onChange={(e) => {
                          setSelectedDateFilter('custom');
                          setCustomStartDate(e.target.value);
                        }}
                        className="w-full px-2.5 py-1.5 rounded-xl border border-line bg-canvas text-xs text-ink focus:outline-none focus:ring-2 focus:ring-accent tabular-nums"
                      />
                    </div>
                    <div>
                      <label htmlFor="custom-date-end" className="block text-xs text-muted mb-1">
                        End date
                      </label>
                      <input
                        id="custom-date-end"
                        type="date"
                        value={customEndDate}
                        onChange={(e) => {
                          setSelectedDateFilter('custom');
                          setCustomEndDate(e.target.value);
                        }}
                        className="w-full px-2.5 py-1.5 rounded-xl border border-line bg-canvas text-xs text-ink focus:outline-none focus:ring-2 focus:ring-accent tabular-nums"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setCustomStartDate('');
                        setCustomEndDate('');
                        setSelectedDateFilter('all');
                        setCustomRangeOpen(false);
                      }}
                      className="text-xs font-semibold text-muted hover:text-ink cursor-pointer"
                    >
                      Reset
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomRangeOpen(false)}
                      className="px-3.5 py-1.5 rounded-xl bg-accent hover:bg-accent-hover text-accent-ink text-xs font-bold cursor-pointer"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Active-Filter Chips + Clear All */}
          {hasAnyFilterOrSearch && (
            <div className="flex flex-wrap items-center gap-2">
              {activeChips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={chip.onClear}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent-soft border border-accent/40 text-xs font-semibold text-ink hover:bg-accent/25 transition-colors cursor-pointer"
                >
                  <span>{chip.label}</span>
                  <X className="w-3 h-3 text-accent-text" />
                </button>
              ))}
              <button
                type="button"
                onClick={resetAllFilters}
                className="text-xs font-semibold text-accent-text hover:underline px-2 py-1 cursor-pointer"
              >
                Clear all
              </button>
            </div>
          )}

          {/* Main Grid or Empty State */}
          {displayedEvents.length === 0 ? (
            <div className="p-10 sm:p-14 bg-surface rounded-3xl border border-line shadow-soft text-center space-y-5">
              <div className="flex justify-center">
                <Goose size={108} state="looking" />
              </div>
              <div className="space-y-2">
                <h2 className="font-display font-bold text-ink text-xl">
                  No events here. The goose looked everywhere.
                </h2>
                <p className="text-sm text-muted max-w-md mx-auto leading-relaxed">
                  {selectedDateFilter !== 'all'
                    ? 'Try another date window or clear your active filters to see upcoming Waterloo events.'
                    : 'Try clearing your search or filters to see what else is buzzing on campus.'}
                </p>
              </div>
              {hasAnyFilterOrSearch && (
                <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={resetAllFilters}
                    className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-accent-ink text-xs font-semibold rounded-2xl transition-colors cursor-pointer shadow-soft"
                  >
                    Clear filters
                  </button>
                </div>
              )}
            </div>
          ) : (
            <section aria-label="Upcoming campus events">
              <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-5">
                {displayedEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    onSelect={(ev) => setSelectedEventForDetail(ev)}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      {/* Mobile Filters Slide-Over Drawer (under 768px) */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-black/55 backdrop-blur-xs"
            onClick={() => setMobileDrawerOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Filters"
            className="relative ml-auto w-full max-w-xs h-full bg-surface border-l border-line shadow-lift flex flex-col z-10"
          >
            <div className="px-5 py-4 border-b border-line flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-ink">Filters</h2>
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(false)}
                className="p-1.5 text-muted hover:text-ink rounded-full cursor-pointer"
                aria-label="Close filters drawer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 filters-scroll">
              {renderFilterGroups()}
            </div>

            <div className="p-4 border-t border-line bg-surface flex items-center gap-2.5">
              <button
                type="button"
                onClick={resetSidebarFilters}
                disabled={sidebarFiltersCount === 0}
                className="px-4 py-3 rounded-2xl border border-line bg-canvas text-ink text-xs font-semibold cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(false)}
                className="flex-1 py-3 rounded-2xl bg-accent hover:bg-accent-hover text-accent-ink text-xs font-bold shadow-soft cursor-pointer"
              >
                Apply ({displayedEvents.length})
              </button>
            </div>
          </div>
        </div>
      )}

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
