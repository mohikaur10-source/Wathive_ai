import React, { useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  MapPin,
  Video,
  Download,
  Check,
  Bookmark,
  Users,
  MessageCircle
} from 'lucide-react';
import { EventItem } from '../../types';
import { useApp } from '../../context/AppContext';
import { downloadEventIcs } from '../../utils/calendar';
import { getTorontoNow, formatWaterlooTimeRange } from '../../utils/timeZone';
import { addDaysToIsoDate, formatIsoDatePretty, getCalendarWeekBounds } from '../../utils/dateRange';

interface MyEventsListProps {
  events: EventItem[];
  onSelectEvent: (event: EventItem) => void;
  onNavigateToMessages?: () => void;
  onExportToast?: (msg: string) => void;
  /** Optional override for badge mode ('going' | 'saved' | 'auto') */
  badgeMode?: 'auto' | 'going' | 'saved';
}

export const MyEventsList: React.FC<MyEventsListProps> = ({
  events,
  onSelectEvent,
  onNavigateToMessages,
  onExportToast,
  badgeMode = 'auto'
}) => {
  const { attendingEventIds, conversations, getEventAttendees } = useApp();

  const todayStr = getTorontoNow().dateStr;
  const tomorrowStr = addDaysToIsoDate(todayStr, 1);
  const { sunday: weekSunday } = getCalendarWeekBounds(todayStr);

  const groupedEvents = useMemo(() => {
    const sorted = [...events].sort((a, b) =>
      a.date !== b.date ? a.date.localeCompare(b.date) : a.startTime.localeCompare(b.startTime)
    );

    const groups: { id: string; title: string; items: EventItem[] }[] = [
      { id: 'today', title: 'Today', items: [] },
      { id: 'tomorrow', title: 'Tomorrow', items: [] },
      { id: 'thisWeek', title: 'This week', items: [] },
      { id: 'later', title: 'Later', items: [] }
    ];

    for (const ev of sorted) {
      const evEnd = ev.endDate && ev.endDate >= ev.date ? ev.endDate : ev.date;
      if (ev.date === todayStr || (ev.date <= todayStr && evEnd >= todayStr)) {
        groups[0].items.push(ev);
      } else if (ev.date === tomorrowStr) {
        groups[1].items.push(ev);
      } else if (ev.date <= weekSunday) {
        groups[2].items.push(ev);
      } else {
        groups[3].items.push(ev);
      }
    }

    return groups.filter((g) => g.items.length > 0);
  }, [events, todayStr, tomorrowStr, weekSunday]);

  return (
    <div className="space-y-6">
      {groupedEvents.map((group) => (
        <section key={group.id} className="space-y-3">
          <h3 className="font-display text-base font-bold text-ink px-1">
            {group.title}
          </h3>

          <div className="space-y-2.5">
            {group.items.map((ev) => {
              const isGoing =
                badgeMode === 'going'
                  ? true
                  : badgeMode === 'saved'
                  ? false
                  : attendingEventIds.includes(ev.id);
              const buddyCount = ev.isResearchStudy ? 0 : getEventAttendees(ev.id).length;
              const conv = conversations.find((c) => c.eventId === ev.id);

              return (
                <div
                  key={ev.id}
                  className="p-4 sm:p-5 bg-surface rounded-2xl border border-line hover:border-accent/60 shadow-soft transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <button
                    type="button"
                    onClick={() => onSelectEvent(ev)}
                    className="text-left min-w-0 flex-1 space-y-1.5 cursor-pointer group"
                  >
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                      <span className="inline-flex items-center gap-1.5 font-medium text-ink">
                        <CalendarIcon className="w-3.5 h-3.5 text-accent-text shrink-0" />
                        <span>
                          {formatIsoDatePretty(ev.date, false)} ·{' '}
                          {formatWaterlooTimeRange(ev.date, ev.startTime, ev.endTime)}
                        </span>
                      </span>
                    </div>

                    <h4 className="font-display font-semibold text-base text-ink group-hover:text-accent-text transition-colors truncate">
                      {ev.title}
                    </h4>

                    <div className="flex items-center gap-1.5 text-xs text-muted">
                      {ev.isOnline ? (
                        <Video className="w-3.5 h-3.5 text-accent-text shrink-0" />
                      ) : (
                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                      )}
                      <span className="truncate">{ev.venueName || ev.location}</span>
                    </div>
                  </button>

                  {/* Right metadata & unobtrusive .ics export */}
                  <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                    {isGoing ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-accent text-accent-ink text-xs font-bold">
                        <Check className="w-3 h-3 stroke-[2.8]" />
                        <span>Going</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-surface-soft text-muted text-xs font-semibold">
                        <Bookmark className="w-3 h-3" />
                        <span>Saved</span>
                      </span>
                    )}

                    {conv && onNavigateToMessages ? (
                      <button
                        type="button"
                        onClick={onNavigateToMessages}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-accent-soft text-accent-text text-xs font-semibold hover:bg-accent/25 transition-colors cursor-pointer"
                        title="Open buddy chat in Buddy Buzz"
                      >
                        <MessageCircle className="w-3 h-3" />
                        <span>{conv.partner.name}</span>
                      </button>
                    ) : !ev.isResearchStudy ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-canvas border border-line text-xs text-muted tabular-nums">
                        <Users className="w-3 h-3" />
                        <span>{buddyCount}</span>
                      </span>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => {
                        downloadEventIcs(ev);
                        onExportToast?.(`Downloaded .ics for "${ev.title}"`);
                      }}
                      className="px-2.5 py-1.5 rounded-xl border border-line bg-canvas hover:bg-surface-soft text-muted hover:text-ink text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                      title="Export to calendar (.ics)"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>.ics</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
};
