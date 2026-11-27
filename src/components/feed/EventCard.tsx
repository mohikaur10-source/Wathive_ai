import React, { useState } from 'react';
import { motion, useReducedMotion, AnimatePresence } from 'motion/react';
import { Bookmark, MapPin, Video, Check } from 'lucide-react';
import { EventItem } from '../../types';
import { useApp } from '../../context/AppContext';
import { safeMediaUrl } from '../../utils/urlSafety';
import { formatSeekerCountText } from '../../utils/buddySeeding';
import { Bee } from '../common/Bee';

interface EventCardProps {
  event: EventItem;
  onSelect: (event: EventItem) => void;
}

export const EventCard: React.FC<EventCardProps> = ({ event, onSelect }) => {
  const {
    savedEventIds,
    toggleSaveEvent,
    attendingEventIds,
    conversations,
    getEventAttendees
  } = useApp();
  const [imgError, setImgError] = useState(false);
  const [buzzTrigger, setBuzzTrigger] = useState(0);
  const prefersReduced = useReducedMotion();

  const isSaved = savedEventIds.includes(event.id);
  const isGoing = attendingEventIds.includes(event.id);
  const isCancelled = event.status === 'cancelled';

  const attendees = getEventAttendees(event.id);
  const buddyCount = attendees.length;
  const isMatchedForEvent = conversations.some((c) => c.eventId === event.id);

  // Parse month and day for the overlaid calendar tile
  const parseCalendarTile = (dateStr: string) => {
    try {
      const [year, month, day] = dateStr.split('-').map(Number);
      const d = new Date(year, month - 1, day);
      return {
        month: d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
        day: String(day)
      };
    } catch {
      return { month: 'TBA', day: '--' };
    }
  };

  const calTile = parseCalendarTile(event.date);

  const handleSaveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isSaved && !prefersReduced) {
      setBuzzTrigger((n) => n + 1);
    }
    toggleSaveEvent(event.id);
  };

  return (
    <article
      onClick={() => onSelect(event)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(event);
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={`${event.title} at ${event.location}`}
      className="group bg-surface rounded-3xl border border-line shadow-soft hover:shadow-lift hover:-translate-y-0.5 transition-all duration-200 overflow-hidden cursor-pointer flex flex-col relative text-left"
    >
      {/* Cover Image */}
      <div className="relative aspect-[16/10] w-full bg-surface-soft overflow-hidden">
        {!imgError && safeMediaUrl(event.coverImage) ? (
          <img
            src={safeMediaUrl(event.coverImage) as string}
            alt={event.title}
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03] ${
              isCancelled ? 'grayscale opacity-60' : ''
            }`}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-surface-soft text-muted p-4 text-center">
            <span className="font-display text-sm font-semibold text-ink line-clamp-1">
              {event.category}
            </span>
          </div>
        )}

        {/* Overlaid Calendar-Tile Date Badge (Top-Left) */}
        <div className="absolute top-3.5 left-3.5 flex items-start gap-2 pointer-events-none">
          <div className="w-11 rounded-2xl overflow-hidden bg-surface shadow-soft border border-line text-center leading-none">
            <div className="bg-accent text-accent-ink text-[10px] font-bold tracking-wider py-1">
              {calTile.month}
            </div>
            <div className="font-display font-bold text-base text-ink py-1 tabular-nums">
              {calTile.day}
            </div>
          </div>

          {isCancelled && (
            <span className="mt-0.5 bg-danger text-white text-[11px] font-semibold px-2.5 py-1 rounded-full shadow-soft">
              Cancelled
            </span>
          )}
          {!isCancelled && isGoing && (
            <span className="mt-0.5 inline-flex items-center gap-1 bg-surface/95 text-ink text-[11px] font-semibold px-2.5 py-1 rounded-full shadow-soft">
              <Check className="w-3 h-3 text-accent-text stroke-[2.8]" />
              <span>Going</span>
            </span>
          )}
        </div>

        {/* Bookmark Button + Tiny Bee Buzz Micro-interaction (Top-Right) */}
        <div className="absolute top-3.5 right-3.5">
          <AnimatePresence>
            {buzzTrigger > 0 && (
              <motion.div
                key={buzzTrigger}
                aria-hidden="true"
                initial={{ opacity: 1, y: 0, x: 0, scale: 0.7, rotate: -10 }}
                animate={{ opacity: 0, y: -28, x: 8, scale: 1.05, rotate: 14 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
                className="pointer-events-none absolute -top-2 right-1.5 z-20"
              >
                <Bee size={22} flying />
              </motion.div>
            )}
          </AnimatePresence>

          <button
            type="button"
            onClick={handleSaveClick}
            aria-label={isSaved ? 'Remove from saved' : 'Save event'}
            className={`w-9 h-9 rounded-2xl flex items-center justify-center transition-all cursor-pointer shadow-soft ${
              isSaved
                ? 'bg-accent text-accent-ink'
                : 'bg-surface/95 text-ink hover:bg-accent hover:text-accent-ink'
            }`}
          >
            <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
          </button>
        </div>
      </div>

      {/* Quiet Card Body: Title, One Location Line, and Calm Buddy Count */}
      <div className="p-5 flex-1 flex flex-col justify-between gap-4">
        <div className="space-y-2">
          <h3 className="font-display font-semibold text-[17px] text-ink leading-snug group-hover:text-accent-text transition-colors line-clamp-2">
            {event.title}
          </h3>

          <div className="flex items-center gap-1.5 text-xs text-muted">
            {event.isOnline ? (
              <Video className="w-3.5 h-3.5 text-accent-text shrink-0" />
            ) : (
              <MapPin className="w-3.5 h-3.5 text-muted shrink-0" />
            )}
            <span className="truncate">{event.location}</span>
          </div>
        </div>

        {/* Calm Buddy Count Line (no photos grid, no names) */}
        <div className="pt-1">
          {event.isResearchStudy ? (
            <span className="text-xs text-muted">
              Research study · Individual participation
            </span>
          ) : isMatchedForEvent ? (
            <span className="text-xs font-semibold text-accent-text">
              You&apos;re matched
            </span>
          ) : buddyCount > 0 ? (
            <span className="text-xs font-medium text-muted tabular-nums">
              {formatSeekerCountText(buddyCount)}
            </span>
          ) : (
            <span className="text-xs text-muted">
              Looking for a buddy?
            </span>
          )}
        </div>
      </div>
    </article>
  );
};
