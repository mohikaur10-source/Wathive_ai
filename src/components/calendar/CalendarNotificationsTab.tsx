import React, { useMemo, useState } from 'react';
import {
  Download,
  Check,
  ChevronDown,
  Calendar as CalendarIcon,
  MapPin,
  Video
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { EventItem } from '../../types';
import { downloadAllEventsIcs } from '../../utils/calendar';
import { isEventPast } from '../../utils/eventLifecycle';
import { isEventEligibleForSurveyOffer } from '../../utils/surveyLogic';
import { formatWaterlooTimeRange } from '../../utils/timeZone';
import { formatIsoDatePretty } from '../../utils/dateRange';
import { EventDetailModal } from '../feed/EventDetailModal';
import { MyEventsList } from '../common/MyEventsList';
import { Goose } from '../common/Goose';
import { PostEventSurveyModal } from './PostEventSurveyModal';

interface CalendarNotificationsTabProps {
  onNavigateToMessages?: (subTab?: 'conversations' | 'requests', conversationId?: string) => void;
  onNavigateToFeed?: () => void;
}

export const CalendarNotificationsTab: React.FC<CalendarNotificationsTabProps> = ({
  onNavigateToMessages,
  onNavigateToFeed
}) => {
  const {
    events,
    attendedEventSnapshots,
    attendingEventIds,
    savedEventIds,
    buddyOptInHistory,
    pairingEventHistory,
    conversations,
    eventSurveys,
    surveyDismissedEventIds,
    effectiveNowMs,
    submitPostEventSurvey,
    dismissSurveyOffer
  } = useApp();

  const [selectedEventForDetail, setSelectedEventForDetail] = useState<EventItem | null>(null);
  const [surveyModalEvent, setSurveyModalEvent] = useState<EventItem | null>(null);
  const [pastOpen, setPastOpen] = useState(false);
  const [toast, setToast] = useState('');

  // Combined list of active + snapshotted Going & Saved events
  const { upcomingMyEvents, pastMyEvents, surveyOfferEvent } = useMemo(() => {
    const nowDate = new Date(effectiveNowMs);
    const byId = new Map<string, EventItem>();
    for (const ev of events) {
      byId.set(ev.id, ev);
    }
    for (const [id, snap] of Object.entries(attendedEventSnapshots)) {
      if (!byId.has(id)) {
        byId.set(id, snap);
      }
    }

    const trackedIds = new Set([...attendingEventIds, ...savedEventIds]);
    const upcoming: EventItem[] = [];
    const past: EventItem[] = [];

    for (const id of trackedIds) {
      const ev = byId.get(id);
      if (!ev) continue;
      if (isEventPast(ev, nowDate)) {
        past.push(ev);
      } else {
        upcoming.push(ev);
      }
    }

    upcoming.sort((a, b) =>
      a.date !== b.date ? a.date.localeCompare(b.date) : a.startTime.localeCompare(b.startTime)
    );
    past.sort((a, b) =>
      b.date !== a.date ? b.date.localeCompare(a.date) : b.startTime.localeCompare(a.startTime)
    );

    const eligibleOffer =
      past.find((ev) =>
        isEventEligibleForSurveyOffer({
          event: ev,
          nowMs: effectiveNowMs,
          optedInForEvent: Boolean(buddyOptInHistory[ev.id]?.active),
          dismissedEventIds: surveyDismissedEventIds,
          surveysByEventId: eventSurveys
        })
      ) || null;

    return {
      upcomingMyEvents: upcoming,
      pastMyEvents: past,
      surveyOfferEvent: eligibleOffer
    };
  }, [
    events,
    attendedEventSnapshots,
    attendingEventIds,
    savedEventIds,
    effectiveNowMs,
    buddyOptInHistory,
    surveyDismissedEventIds,
    eventSurveys
  ]);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(''), 3000);
  };

  const hasAnyEvents = upcomingMyEvents.length > 0 || pastMyEvents.length > 0;
  const surveyModalHasBuddy = Boolean(
    surveyModalEvent &&
      (pairingEventHistory[surveyModalEvent.id] ||
        conversations.some((c) => c.eventId === surveyModalEvent.id))
  );

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

        {upcomingMyEvents.length > 0 && (
          <button
            type="button"
            onClick={() => {
              downloadAllEventsIcs(upcomingMyEvents);
              showToast('Exported your WatHive events (.ics)');
            }}
            className="self-start sm:self-auto px-4 py-2 rounded-full border border-line bg-surface hover:bg-surface-soft text-ink text-xs font-semibold flex items-center gap-1.5 shadow-soft transition-colors cursor-pointer"
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

      {/* Slim Post-Event Survey Offer Card */}
      {surveyOfferEvent && (
        <div className="px-4 py-3.5 bg-surface rounded-2xl border border-accent/50 shadow-soft flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold text-ink">
              How was your WatHive experience?
            </p>
            <p className="text-xs text-muted truncate mt-0.5">
              {surveyOfferEvent.title}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => dismissSurveyOffer(surveyOfferEvent.id)}
              className="px-3.5 py-1.5 rounded-full text-xs font-semibold text-muted hover:text-ink transition-colors cursor-pointer"
            >
              Not now
            </button>
            <button
              type="button"
              onClick={() => setSurveyModalEvent(surveyOfferEvent)}
              className="px-4 py-1.5 rounded-full bg-accent hover:bg-accent-hover text-accent-ink text-xs font-bold shadow-soft transition-colors cursor-pointer"
            >
              Share feedback
            </button>
          </div>
        </div>
      )}

      {!hasAnyEvents ? (
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
              className="px-5 py-2.5 rounded-full bg-accent hover:bg-accent-hover text-accent-ink text-xs font-bold shadow-soft transition-colors cursor-pointer"
            >
              Explore events
            </button>
          )}
        </div>
      ) : (
        <>
          {upcomingMyEvents.length > 0 && (
            <MyEventsList
              events={upcomingMyEvents}
              onSelectEvent={(ev) => setSelectedEventForDetail(ev)}
              onNavigateToMessages={onNavigateToMessages}
              onExportToast={showToast}
              badgeMode="auto"
            />
          )}

          {pastMyEvents.length > 0 && (
            <section className="bg-surface rounded-3xl border border-line shadow-soft overflow-hidden">
              <button
                type="button"
                aria-expanded={pastOpen}
                onClick={() => setPastOpen((prev) => !prev)}
                className="w-full px-5 py-4 flex items-center justify-between gap-3 text-left hover:bg-surface-soft/40 transition-colors cursor-pointer"
              >
                <span className="font-display text-base font-bold text-ink">
                  Past events ({pastMyEvents.length})
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-muted transition-transform duration-150 ${
                    pastOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {pastOpen && (
                <div className="px-5 pb-4 pt-2 border-t border-line divide-y divide-line">
                  {pastMyEvents.map((ev) => {
                    const submittedSurvey = Boolean(eventSurveys[ev.id]);
                    const canOfferFeedback = isEventEligibleForSurveyOffer({
                      event: ev,
                      nowMs: effectiveNowMs,
                      optedInForEvent: Boolean(buddyOptInHistory[ev.id]?.active),
                      dismissedEventIds: surveyDismissedEventIds,
                      surveysByEventId: eventSurveys
                    });

                    return (
                      <div
                        key={ev.id}
                        className="py-3.5 first:pt-2 last:pb-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedEventForDetail(ev)}
                          className="text-left min-w-0 flex-1 space-y-1 cursor-pointer group"
                        >
                          <div className="flex items-center gap-1.5 text-xs text-muted">
                            <CalendarIcon className="w-3.5 h-3.5 text-accent-text shrink-0" />
                            <span>
                              {formatIsoDatePretty(ev.date, false)} ·{' '}
                              {formatWaterlooTimeRange(ev.date, ev.startTime, ev.endTime)}
                            </span>
                          </div>
                          <h4 className="font-display font-semibold text-sm text-ink group-hover:text-accent-text transition-colors truncate">
                            {ev.title}
                          </h4>
                          <div className="flex items-center gap-1.5 text-xs text-muted">
                            {ev.isOnline ? (
                              <Video className="w-3.5 h-3.5 shrink-0" />
                            ) : (
                              <MapPin className="w-3.5 h-3.5 shrink-0" />
                            )}
                            <span className="truncate">{ev.venueName || ev.location}</span>
                          </div>
                        </button>

                        <div className="flex items-center gap-2 shrink-0">
                          {submittedSurvey ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-surface-soft text-muted text-xs font-semibold">
                              <Check className="w-3 h-3 text-accent-text" />
                              <span>Feedback sent</span>
                            </span>
                          ) : canOfferFeedback ? (
                            <button
                              type="button"
                              onClick={() => setSurveyModalEvent(ev)}
                              className="px-3.5 py-1.5 rounded-full bg-accent hover:bg-accent-hover text-accent-ink text-xs font-semibold shadow-soft transition-colors cursor-pointer"
                            >
                              Share feedback
                            </button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}
        </>
      )}

      {selectedEventForDetail && (
        <EventDetailModal
          isOpen={Boolean(selectedEventForDetail)}
          event={selectedEventForDetail}
          onClose={() => setSelectedEventForDetail(null)}
          onNavigateToMessages={onNavigateToMessages}
        />
      )}

      <PostEventSurveyModal
        isOpen={Boolean(surveyModalEvent)}
        event={surveyModalEvent}
        hadBuddyPairing={surveyModalHasBuddy}
        onClose={() => setSurveyModalEvent(null)}
        onDismissNotNow={(eventId) => dismissSurveyOffer(eventId)}
        onSubmit={(submission) => {
          submitPostEventSurvey(submission);
          showToast('Thank you for your feedback.');
        }}
      />
    </div>
  );
};
