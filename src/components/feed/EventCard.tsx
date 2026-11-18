import React, { useState } from 'react';
import { Bookmark, Calendar, MapPin, Video, Check } from 'lucide-react';
import { EventItem } from '../../types';
import { useApp } from '../../context/AppContext';

interface EventCardProps {
  event: EventItem;
  onSelect: (event: EventItem) => void;
}

export const EventCard: React.FC<EventCardProps> = ({ event, onSelect }) => {
  const { savedEventIds, toggleSaveEvent, attendingEventIds } = useApp();
  const [imgError, setImgError] = useState(false);

  const isSaved = savedEventIds.includes(event.id);
  const isGoing = attendingEventIds.includes(event.id);
  const isCancelled = event.status === 'cancelled';

  // Format date readable: e.g. "Oct 24"
  const formatShortDate = (dateStr: string) => {
    try {
      const [year, month, day] = dateStr.split('-').map(Number);
      const d = new Date(year, month - 1, day);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  // Format 24h time to compact 12h: e.g. "17:00" -> "5:00 PM"
  const formatCompactTime = (timeStr: string) => {
    try {
      const [hStr, mStr] = timeStr.split(':');
      const h = parseInt(hStr, 10);
      const m = mStr || '00';
      const period = h >= 12 ? 'PM' : 'AM';
      const hour12 = h % 12 || 12;
      return `${hour12}:${m} ${period}`;
    } catch {
      return timeStr;
    }
  };

  const handleSaveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleSaveEvent(event.id);
  };

  return (
    <article
      onClick={() => onSelect(event)}
      className="group bg-white rounded-2xl border border-stone-200/80 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden cursor-pointer flex flex-col relative"
    >
      {/* Top Cover Image */}
      <div className="relative aspect-[16/10] w-full bg-stone-100 overflow-hidden">
        {!imgError && event.coverImage ? (
          <img
            src={event.coverImage}
            alt={event.title}
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03] ${
              isCancelled ? 'grayscale opacity-60' : ''
            }`}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-stone-100 to-amber-50 text-stone-700 p-4 text-center">
            <Calendar className="w-6 h-6 text-amber-600 mb-1.5" />
            <span className="text-xs font-semibold text-stone-700 line-clamp-1">{event.category}</span>
          </div>
        )}

        {/* Top Floating Tag (Single Tag Max) & Bookmark */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 pointer-events-auto">
          <div>
            {isCancelled ? (
              <span className="inline-flex items-center bg-red-600 text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow-xs">
                Cancelled
              </span>
            ) : event.status === 'draft' ? (
              <span className="inline-flex items-center bg-stone-900 text-amber-300 text-[11px] font-bold px-2.5 py-1 rounded-full shadow-xs">
                Draft
              </span>
            ) : isGoing ? (
              <span className="inline-flex items-center gap-1 bg-amber-400 text-stone-950 text-[11px] font-bold px-2.5 py-1 rounded-full shadow-xs">
                <Check className="w-3 h-3 stroke-[3]" />
                <span>Going</span>
              </span>
            ) : event.sourceVerification === 'wusa_official' ? (
              <span className="inline-flex items-center bg-amber-300 text-stone-950 text-[11px] font-bold px-2.5 py-1 rounded-full shadow-xs">
                Featured
              </span>
            ) : null}
          </div>

          <button
            type="button"
            onClick={handleSaveClick}
            aria-label={isSaved ? 'Remove from saved' : 'Save event'}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-xs ${
              isSaved
                ? 'bg-amber-400 text-stone-950'
                : 'bg-white/95 text-stone-700 hover:bg-stone-950 hover:text-amber-400'
            }`}
          >
            <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-stone-950 text-stone-950' : ''}`} />
          </button>
        </div>
      </div>

      {/* Card Body */}
      <div className="p-4 flex-1 flex flex-col justify-between gap-3">
        <div className="space-y-1.5">
          {/* Line 1: Category (unboxed quiet metadata) */}
          <p className="text-xs font-medium text-stone-500 truncate">
            {event.category}
          </p>

          {/* Line 2: Event Title */}
          <h3 className="font-bold text-base text-stone-950 leading-snug group-hover:text-amber-700 transition-colors line-clamp-1">
            {event.title}
          </h3>

          {/* Line 3: Date/Time (Left) & Price (Right) */}
          <div className="flex items-center justify-between gap-2 text-xs pt-0.5">
            <div className="flex items-center gap-1.5 text-stone-700 font-medium tabular-nums truncate">
              <Calendar className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>
                {event.endDate && event.endDate > event.date
                  ? `${formatShortDate(event.date)} – ${formatShortDate(event.endDate)}`
                  : formatShortDate(event.date)}{' '}
                · {formatCompactTime(event.startTime)}
              </span>
            </div>
            <span className="text-stone-600 font-medium shrink-0 max-w-[100px] truncate">
              {event.isFree ? 'Free' : event.price}
            </span>
          </div>

          {/* Line 4: Location */}
          <div className="flex items-center gap-1.5 text-xs text-stone-500">
            {event.isOnline ? (
              <Video className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            ) : (
              <MapPin className="w-3.5 h-3.5 text-stone-400 shrink-0" />
            )}
            <span className="truncate">{event.location}</span>
          </div>
        </div>

        {/* Footer Highlight Row */}
        <div className="pt-2.5 border-t border-stone-100 flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium text-stone-600 bg-stone-100 px-2.5 py-1 rounded-lg truncate">
            {event.isResearchStudy ? 'Research study' : 'Find event buddies'}
          </span>

          <span className="text-xs font-semibold text-stone-900 group-hover:text-amber-700 transition-colors shrink-0 whitespace-nowrap">
            Details &rarr;
          </span>
        </div>
      </div>
    </article>
  );
};
