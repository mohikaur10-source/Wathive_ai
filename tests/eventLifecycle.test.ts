import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getEventEndUtcMs,
  isEventPast,
  torontoWallClockToUtcMs
} from '../src/utils/eventLifecycle.js';

describe('Part B: Event Lifecycle (America/Toronto)', () => {
  it('treats an event as active 1s before endTime and past 1s after endTime', () => {
    const ev = {
      date: '2026-11-20',
      startTime: '17:00',
      endTime: '19:00',
      status: 'published'
    };
    const endMs = torontoWallClockToUtcMs('2026-11-20', '19:00:00');
    assert.equal(isEventPast(ev, new Date(endMs - 1000)), false);
    assert.equal(isEventPast(ev, new Date(endMs)), true);
    assert.equal(isEventPast(ev, new Date(endMs + 1000)), true);
  });

  it('falls back to 23:59:59.999 Toronto time when endTime is missing and rolls over at Toronto midnight', () => {
    const ev = {
      date: '2026-11-19',
      startTime: '10:00',
      status: 'published'
    };
    // 23:59:58 EST (UTC-5) => 2026-11-20T04:59:58Z -> active
    assert.equal(isEventPast(ev, new Date('2026-11-20T04:59:58.000Z')), false);
    // 00:00:01 EST on Nov 20 => 2026-11-20T05:00:01Z -> past
    assert.equal(isEventPast(ev, new Date('2026-11-20T05:00:01.000Z')), true);
  });

  it('respects multi-day endDate through endTime on the final day', () => {
    const ev = {
      date: '2026-11-18',
      endDate: '2026-11-22',
      startTime: '09:00',
      endTime: '16:30',
      status: 'published'
    };
    assert.equal(isEventPast(ev, new Date('2026-11-21T15:00:00.000Z')), false);
    assert.equal(isEventPast(ev, new Date('2026-11-22T21:29:59.000Z')), false); // 16:29:59 EST
    assert.equal(isEventPast(ev, new Date('2026-11-22T21:30:01.000Z')), true);  // 16:30:01 EST
  });

  it('uses the latest occurrence in recurringDates', () => {
    const ev = {
      date: '2026-11-05',
      recurringDates: ['2026-11-05', '2026-11-12', '2026-11-26'],
      startTime: '12:00',
      endTime: '14:00',
      status: 'published'
    };
    assert.equal(isEventPast(ev, new Date('2026-11-19T17:00:00.000Z')), false);
    assert.equal(isEventPast(ev, new Date('2026-11-26T18:59:59.000Z')), false); // 13:59:59 EST
    assert.equal(isEventPast(ev, new Date('2026-11-26T19:00:01.000Z')), true);  // 14:00:01 EST
  });

  it('keeps cancelled events until their scheduled end time passes, while ended status is always past', () => {
    const cancelledUpcoming = {
      date: '2026-11-25',
      startTime: '14:00',
      endTime: '15:00',
      status: 'cancelled'
    };
    assert.equal(isEventPast(cancelledUpcoming, new Date('2026-11-19T17:00:00.000Z')), false);
    assert.equal(isEventPast(cancelledUpcoming, new Date('2026-11-25T20:00:01.000Z')), true);

    assert.equal(
      isEventPast({ date: '2026-12-10', endTime: '20:00', status: 'ended' }, new Date('2026-11-19T17:00:00.000Z')),
      true
    );
  });

  it('handles Ontario DST Spring Forward (2026-03-08) and Fall Back (2026-11-01) accurately', () => {
    // Spring Forward: March 8, 2026 03:30 EDT = 07:30:00Z
    const springEv = {
      date: '2026-03-08',
      startTime: '01:00',
      endTime: '03:30',
      status: 'published'
    };
    assert.equal(getEventEndUtcMs(springEv), Date.parse('2026-03-08T07:30:00.000Z'));
    assert.equal(isEventPast(springEv, new Date('2026-03-08T07:29:59.000Z')), false);
    assert.equal(isEventPast(springEv, new Date('2026-03-08T07:30:01.000Z')), true);

    // Fall Back: November 1, 2026 01:30 prefers EST (06:30:00Z) so active events do not vanish early
    const fallAmbiguousEv = {
      date: '2026-11-01',
      startTime: '00:30',
      endTime: '01:30',
      status: 'published'
    };
    assert.equal(getEventEndUtcMs(fallAmbiguousEv), Date.parse('2026-11-01T06:30:00.000Z'));
    assert.equal(isEventPast(fallAmbiguousEv, new Date('2026-11-01T06:29:59.000Z')), false);
    assert.equal(isEventPast(fallAmbiguousEv, new Date('2026-11-01T06:30:01.000Z')), true);
  });

  it('handles Stock the Bank (Nov 1 - Nov 30) vs single-day Nov 1 events accurately', () => {
    const stockTheBank = {
      date: '2026-11-01',
      endDate: '2026-11-30',
      startTime: '00:00',
      endTime: '23:59',
      status: 'published'
    };
    // Active on Nov 19, 2026
    assert.equal(isEventPast(stockTheBank, new Date('2026-11-19T17:00:00.000Z')), false);
    // Active on Nov 30 at 23:58 EST (2026-12-01T04:58:00Z)
    assert.equal(isEventPast(stockTheBank, new Date('2026-12-01T04:58:00.000Z')), false);
    // Past on Dec 1 at 00:00:01 EST (2026-12-01T05:00:01Z)
    assert.equal(isEventPast(stockTheBank, new Date('2026-12-01T05:00:01.000Z')), true);

    // Single-day Nov 1 event is past on Nov 19
    const singleDayNov1 = {
      date: '2026-11-01',
      startTime: '10:00',
      status: 'published'
    };
    assert.equal(isEventPast(singleDayNov1, new Date('2026-11-19T17:00:00.000Z')), true);
  });
});
