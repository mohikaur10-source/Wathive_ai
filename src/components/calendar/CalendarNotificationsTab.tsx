import React, { useMemo, useState } from 'react';
import { Download, Check } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { EventItem } from '../../types';
import { downloadAllEventsIcs } from '../../utils/calendar';
import { EventDetailModal } from '../feed/EventDetailModal';
import { MyEventsList } from '../common/MyEventsList';
import { Goose } from '../common/Goose';

interface CalendarNotificationsTabProps {
  onNavigateToMessages?: (subTab?: 'conversations' | 'requests') => void;
  onNavigateToFeed?: () => void;
}

export const CalendarNotificationsTab: React.FC<CalendarNotificationsTabProps> = ({
  onNavigateToMessages,
  onNavigateToFeed
}) => {
  const { events, attendingEventIds, savedEventIds } = useApp();

  const [selectedEventForDetail, setSelectedEventForDetail] = useState<EventItem | null>(null);
  const [toast, setToast] = useState('');

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
        <MyEventsList
          events={myEvents}
          onSelectEvent={(ev) => setSelectedEventForDetail(ev)}
          onNavigateToMessages={onNavigateToMessages}
          onExportToast={showToast}
          badgeMode="auto"
        />
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
