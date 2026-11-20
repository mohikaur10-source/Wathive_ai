import React, { useMemo, useState } from 'react';
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
import { useApp } from '../../context/AppContext';
import { EventItem } from '../../types';
import { downloadEventIcs, downloadAllEventsIcs } from '../../utils/calendar';
import { getTorontoNow, formatWaterlooTimeRange } from '../../utils/timeZone';
import { addDaysToIsoDate, formatIsoDatePretty, getCalendarWeekBounds } from '../../utils/dateRange';
import { EventDetailModal } from '../feed/EventDetailModal';
import { Goose } from '../common/Goose';

interface CalendarNotificationsTabProps {
  onNavigateToMessages?: () => void;
  onNavigateToFeed?: () => void;
}

export const CalendarNotificationsTab: React.FC<CalendarNotificationsTabProps> = ({
  onNavigateToMessages,
  onNavigateToFeed
}) => {
  const {
    events,
    attendingEventIds,
    savedEventIds,
    conversations,
    getEventAttendees
  } = useApp();

  const [selectedEventForDetail, setSelectedEventForDetail] = useState<EventItem | null>(null);
  const [toast, setToast] = useState('');

  const todayStr = getTorontoNow().dateStr;
  const tomorrowStr = addDaysToIsoDate(todayStr, 1);
  const { sunday: weekSunday } = getCalendarWeekBounds(todayStr);

  // Combined list of non-archived Going & Saved events sorted chronologically
  const myEvents = useMemo(() => {
    const seen = new Set<string>();
    const list: EventItem[] = [];
    for (const ev of events) {
      if (attendingEventIds.includes(ev.id) || savedEventIds.includes(ev.id)) {
        if (!seen.has(ev.id)) {
          seen.add(ev.id);
          list.push(ev);
        }
      }
    }
    return list.sort((a, b) =>
      a.date !== b.date ? a.date.localeCompare(b.date) : a.startTime.localeCompare(b.startTime)
    );
  }, [events, attendingEventIds, savedEventIds]);

  const groupedEvents = useMemo(() => {
    const groups: { id: string; title: string; items: EventItem[] }[] = [
      { id: 'today', title: 'Today', items: [] },
      { id: 'tomorrow', title: 'Tomorrow', items: [] },
      { id: 'thisWeek', title: 'This week', items: [] },
      { id: 'later', title: 'Later', items: [] }
    ];

    for (const ev of myEvents) {
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
  }, [myEvents, todayStr, tomorrowStr, weekSunday]);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(''), 3000);
  };

  return (
    <div className="max-w-4xl mx-auto w-full space-y-6">
      {/* Minimal Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink tracking-tight">
            My Events
          </h1>
          <p className="text-sm text-muted mt-1">
            Upcoming campus events you&apos;re going to or saved for later.
          </p>
        </div>

        {myEvents.length > 0 && (
          <button
            type="button"
            onClick={() => {
              downloadAllEventsIcs(myEvents);
              showToast('Exported your WatHive events (.ics)');
            }}
            className="self-start sm:self-auto px-3.5 py-2 rounded-2xl border border-line bg-surface hover:bg-surface-soft text-ink text-xs font-semibold flex items-center gap-1.5 shadow-soft transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-accent-text" />
            <span>Export all (.ics)</span>
          </button>
        )}
      </div>

      {toast && (
        <div className="p-3 bg-surface border border-accent rounded-2xl shadow-soft text-xs font-semibold text-ink flex items-center gap-2">
          <Check className="w-4 h-4 text-accent-text stroke-[2.8]" />
          <span>{toast}</span>
        </div>
      )}

      {myEvents.length === 0 ? (
        <div className="p-10 sm:p-14 bg-surface rounded-3xl border border-line shadow-soft text-center space-y-4">
          <div className="flex justify-center">
            <Goose size={96} state="looking" />
          </div>
          <div className="space-y-1.5">
            <h2 className="font-display text-xl font-bold text-ink">
              Nothing on your calendar yet
            </h2>
            <p className="text-sm text-muted max-w-sm mx-auto">
              Save events or tap &ldquo;I&apos;m Going&rdquo; in Explore to build your Waterloo schedule.
            </p>
          </div>
          {onNavigateToFeed && (
            <button
              type="button"
              onClick={onNavigateToFeed}
              className="px-5 py-2.5 rounded-2xl bg-accent hover:bg-accent-hover text-accent-ink text-xs font-bold shadow-soft transition-colors cursor-pointer"
            >
              Explore events
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-7">
          {groupedEvents.map((group) => (
            <section key={group.id} className="space-y-3">
              <h2 className="font-display text-base font-bold text-ink px-1">
                {group.title}
              </h2>

              <div className="space-y-2.5">
                {group.items.map((ev) => {
                  const isGoing = attendingEventIds.includes(ev.id);
                  const buddyCount = ev.isResearchStudy ? 0 : getEventAttendees(ev.id).length;
                  const conv = conversations.find((c) => c.eventId === ev.id);

                  return (
                    <div
                      key={ev.id}
                      className="p-4 sm:p-5 bg-surface rounded-2xl border border-line hover:border-accent/60 shadow-soft transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedEventForDetail(ev)}
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

                        <h3 className="font-display font-semibold text-base text-ink group-hover:text-accent-text transition-colors truncate">
                          {ev.title}
                        </h3>

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
                            showToast(`Downloaded .ics for "${ev.title}"`);
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
      )}

      {selectedEventForDetail && (
        <EventDetailModal
          isOpen={Boolean(selectedEventForDetail)}
          event={selectedEventForDetail}
          onClose={() => setSelectedEventForDetail(null)}
          onNavigateToMessages={onNavigateToMessages}
        />
      )}
    </div>
  );
};
