import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import {
  buildCommunityEventId,
  parseCommunitySheetCsv,
  parseIcsEvents,
  CommunitySourceCollector
} from '../server/communitySources.js';
import { CollectorDatabase } from '../server/db.js';
import { mapToWatHiveEventItem } from '../server/previewMapper.js';

const FIXED_NOW = new Date('2026-11-19T15:00:00.000Z'); // 10:00 AM EST in Toronto

test('parseCommunitySheetCsv parses valid approved rows and enforces publish=yes', () => {
  const csv = [
    'publish,title,date,start_time,end_time,end_date,location,address,description,link,cover_image_url,organizer,category,is_free,price',
    'yes,JAM Network Coffee Chat,2026-11-25,18:00,20:00,,SLC Multi-Purpose Room,200 University Ave W,"Drop by for warm tea, snacks, and board games!",https://jamnetwork.ca/rsvp,https://jamnetwork.ca/cover.jpg,JAM Network,Social events,yes,',
    'no,Draft Club Night,2026-11-26,19:00,21:00,,MC 2034,,Not ready yet,,,JAM Network,Social events,yes,',
    'YES,Intro to TypeScript Workshop,2026-11-28,14:00,16:30,,E7 3343,,"Hands-on workshop, bring a laptop.",https://csclub.uwaterloo.ca/ts,,UW CS Club,Unknown Category,no,$5'
  ].join('\n');

  const { events, skipped } = parseCommunitySheetCsv(csv, {
    sourceUrl: 'https://docs.google.com/spreadsheets/d/e/test/pub?output=csv',
    now: FIXED_NOW
  });

  assert.equal(events.length, 2);
  assert.equal(skipped.some((s) => s.reason === 'not_published'), true);

  const first = events[0];
  assert.equal(first.id.startsWith('comm_sheet_'), true);
  assert.equal(first.source, 'community_sheet');
  assert.equal(first.approval_status, 'approved');
  assert.equal(first.title, 'JAM Network Coffee Chat');
  assert.equal(first.organizer?.name, 'JAM Network');
  assert.equal(first.category, 'Social events');
  assert.equal(first.cost, 'Free');
  assert.equal(first.registration_url, 'https://jamnetwork.ca/rsvp');
  assert.equal(first.source_image_url, 'https://jamnetwork.ca/cover.jpg');
  assert.equal(first.start_utc, '2026-11-25T23:00:00.000Z'); // 18:00 EST -> 23:00Z
  assert.equal(first.end_utc, '2026-11-26T01:00:00.000Z'); // 20:00 EST -> 01:00Z next day

  const second = events[1];
  assert.equal(second.category, 'Social events'); // unknown category falls back cleanly
  assert.equal(second.cost, '$5');
});

test('parseCommunitySheetCsv rejects bad dates, missing fields, oversized text, and strips HTML/javascript URLs', () => {
  const longTitle = 'A'.repeat(121);
  const longDesc = 'B'.repeat(2001);

  const csv = [
    'publish,title,date,start_time,end_time,end_date,location,address,description,link,cover_image_url,organizer,category,is_free,price',
    'yes,Bad Feb Date,2026-02-30,10:00,12:00,,SLC,,Valid desc,,,Club,Social events,yes,',
    'yes,Bad Time Range,2026-11-25,18:00,17:00,,SLC,,End before start,,,Club,Social events,yes,',
    'yes,,2026-11-25,18:00,19:00,,SLC,,Missing title,,,Club,Social events,yes,',
    'yes,Missing Loc,2026-11-25,18:00,19:00,,,,Missing location,,,Club,Social events,yes,',
    `yes,${longTitle},2026-11-25,18:00,19:00,,SLC,,Valid desc,,,Club,Social events,yes,`,
    `yes,Too Long Desc,2026-11-25,18:00,19:00,,SLC,,${longDesc},,,Club,Social events,yes,`,
    'yes,Past Event,2026-11-18,18:00,20:00,,SLC,,Already ended,,,Club,Social events,yes,',
    'yes,"<b>XSS</b> Event",2026-11-27,18:00,19:30,,SLC,,"<p>Join <b>us</b>!</p><script>alert(1)</script>",javascript:alert(1),"data:text/html;base64,SGk=",JAM Network,Arts and culture,yes,'
  ].join('\n');

  const { events, skipped } = parseCommunitySheetCsv(csv, { now: FIXED_NOW });

  assert.equal(events.length, 1);
  assert.equal(events[0].title, 'XSS Event');
  assert.equal(events[0].description_text.includes('<'), false);
  assert.equal(events[0].description_text.includes('alert'), false);
  assert.equal(events[0].description_text, 'Join us!');
  assert.equal(events[0].registration_url, null);
  assert.equal(events[0].source_image_url, null);
  assert.equal(events[0].category, 'Arts and culture');

  const reasons = new Set(skipped.map((s) => s.reason));
  assert.equal(reasons.has('invalid_date'), true);
  assert.equal(reasons.has('end_not_after_start'), true);
  assert.equal(reasons.has('missing_title'), true);
  assert.equal(reasons.has('missing_location'), true);
  assert.equal(reasons.has('title_too_long'), true);
  assert.equal(reasons.has('description_too_long'), true);
  assert.equal(reasons.has('past_event'), true);
});

test('parseIcsEvents handles all-day VALUE=DATE, HTML stripping, unsafe URLs, and hides raw emails', () => {
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'X-WR-CALNAME:JAM Network',
    'BEGIN:VEVENT',
    'SUMMARY:JAM Cultural Festival',
    'DTSTART;VALUE=DATE:20261125',
    'DTEND;VALUE=DATE:20261127',
    'LOCATION:SLC Great Hall',
    'ORGANIZER:mailto:private-exec@gmail.com',
    'CATEGORIES:Arts and culture',
    'DESCRIPTION:<b>Two days</b> of music\\, art\\, and food.<script>evil()</script>',
    'URL:javascript:alert(document.cookie)',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');

  const { events } = parseIcsEvents(ics, {
    sourceUrl: 'https://calendar.example.org/jam.ics',
    now: FIXED_NOW
  });

  assert.equal(events.length, 1);
  const ev = events[0];
  assert.equal(ev.all_day, true);
  assert.equal(ev.is_multi_day, true);
  assert.equal(ev.start_date, '2026-11-25 00:00:00');
  assert.equal(ev.end_date, '2026-11-26 23:59:59'); // exclusive DTEND 20261127 -> inclusive Nov 26
  assert.equal(ev.organizer?.name, 'JAM Network'); // must not expose private-exec@gmail.com
  assert.equal(ev.registration_url, null);
  assert.equal(ev.description_text, 'Two days of music, art, and food.');
  assert.equal(ev.category, 'Arts and culture');
});

test('parseIcsEvents handles UTC and TZID conversions across Ontario DST boundaries accurately', () => {
  // Use a date before March 8, 2026 Spring Forward to test both Spring Forward & Fall Back conversions
  const springNow = new Date('2026-03-01T12:00:00.000Z');
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'X-WR-CALNAME:Robotics Club',
    'BEGIN:VEVENT',
    'SUMMARY:Post-Spring-Forward Build Session',
    'DTSTART:20260308T180000Z', // 14:00 EDT (UTC-4) on Mar 8, 2026
    'DTEND:20260308T200000Z',   // 16:00 EDT
    'LOCATION:E7 Ideas Clinic',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'SUMMARY:Pre-Spring-Forward Meetup',
    'DTSTART;TZID=America/Toronto:20260307T190000', // 19:00 EST (UTC-5) -> 2026-03-08T00:00:00Z
    'DTEND;TZID=America/Toronto:20260307T210000',
    'LOCATION:MC 2066',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');

  const { events } = parseIcsEvents(ics, { now: springNow });
  assert.equal(events.length, 2);

  const springUtcEv = events.find((e) => e.title === 'Post-Spring-Forward Build Session')!;
  assert.equal(springUtcEv.start_date, '2026-03-08 14:00:00');
  assert.equal(springUtcEv.end_date, '2026-03-08 16:00:00');
  assert.equal(springUtcEv.start_iso, '2026-03-08T14:00:00-04:00');

  const preSpringEv = events.find((e) => e.title === 'Pre-Spring-Forward Meetup')!;
  assert.equal(preSpringEv.start_iso, '2026-03-07T19:00:00-05:00');
  assert.equal(preSpringEv.start_utc, '2026-03-08T00:00:00.000Z');
});

test('parseIcsEvents caps RRULE expansion at 60 days ahead and respects EXDATE', () => {
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'X-WR-CALNAME:Chess Club',
    'BEGIN:VEVENT',
    'SUMMARY:Weekly Chess Meetup',
    'DTSTART;TZID=America/Toronto:20261120T180000',
    'DURATION:PT2H',
    'RRULE:FREQ=WEEKLY;COUNT=25',
    'EXDATE;TZID=America/Toronto:20261127T180000',
    'LOCATION:SLC Basement',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');

  const { events } = parseIcsEvents(ics, { now: FIXED_NOW });
  const sixtyDaysMs = FIXED_NOW.getTime() + 60 * 24 * 60 * 60 * 1000;

  assert.equal(events.length > 0 && events.length < 25, true);
  assert.equal(events.some((e) => e.start_date.startsWith('2026-11-27')), false); // EXDATE skipped
  for (const ev of events) {
    assert.equal(Date.parse(ev.start_utc!) <= sixtyDaysMs, true);
  }
});

test('Community IDs are stable, SQLite updates in-place and archives removed rows, and previewMapper sets community defaults', () => {
  const id1 = buildCommunityEventId('community_sheet', 'JAM Mixer', '2026-11-25', '18:00');
  const id2 = buildCommunityEventId('community_sheet', '  jam mixer ', '2026-11-25', '18:00');
  assert.equal(id1, id2);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wathive-comm-test-'));
  const dbPath = path.join(tmpDir, 'test.db');
  const testDb = new CollectorDatabase(dbPath);

  try {
    const sheetUrl = 'https://docs.google.com/spreadsheets/d/e/demo/pub?output=csv';
    const csvV1 = [
      'publish,title,date,start_time,end_time,end_date,location,address,description,link,cover_image_url,organizer,category,is_free,price',
      'yes,JAM Mixer,2026-11-25,18:00,20:00,,SLC Great Hall,,Initial description,,,JAM Network,Social events,yes,',
      'yes,JAM Study Night,2026-11-29,17:00,19:00,,DC 1350,,Study together,,,JAM Network,Academic workshops,yes,'
    ].join('\n');

    const res1 = parseCommunitySheetCsv(csvV1, { sourceUrl: sheetUrl, now: FIXED_NOW });
    for (const ev of res1.events) {
      assert.equal(testDb.upsertEvent(ev, 'sync_1').status, 'new');
    }

    // Update description of JAM Mixer & remove JAM Study Night from the sheet
    const csvV2 = [
      'publish,title,date,start_time,end_time,end_date,location,address,description,link,cover_image_url,organizer,category,is_free,price',
      'yes,JAM Mixer,2026-11-25,18:00,20:30,,SLC Multi-Purpose Room,,Updated room & description,https://jamnetwork.ca/mixer,,JAM Network,Arts and culture,no,$5'
    ].join('\n');

    const res2 = parseCommunitySheetCsv(csvV2, { sourceUrl: sheetUrl, now: FIXED_NOW });
    assert.equal(res2.events.length, 1);
    assert.equal(res2.events[0].id, id1);
    assert.equal(testDb.upsertEvent(res2.events[0], 'sync_2').status, 'updated');

    const archivedCount = testDb.archiveMissingEventsForSource(
      'community_sheet',
      sheetUrl,
      res2.events.map((e) => e.id)
    );
    assert.equal(archivedCount, 1);

    // Calling getAllEventsRaw() triggers archivePastEvents(); missing event must remain archived!
    const active = testDb.getAllEventsRaw();
    assert.equal(active.length, 1);
    assert.equal(active[0].id, id1);
    assert.equal(active[0].description_text, 'Updated room & description');

    const mapped = mapToWatHiveEventItem(active[0]);
    assert.equal(mapped.id, id1);
    assert.equal(mapped.sourceVerification, 'community_partner');
    assert.equal(mapped.moderationStatus, 'approved');
    assert.equal(mapped.organizer, 'JAM Network');
    assert.equal(mapped.organizerType, 'Clubs');
    assert.equal(mapped.category, 'Arts and culture');
    assert.equal(mapped.isFree, false);
    assert.equal(mapped.price, '$5');
    assert.equal(mapped.registrationUrl, 'https://jamnetwork.ca/mixer');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('CommunitySourceCollector blocks cross-host redirects cleanly', async () => {
  const originalFetch = globalThis.fetch;
  const prevEnv = process.env.COMMUNITY_SHEET_CSV_URLS;

  process.env.COMMUNITY_SHEET_CSV_URLS = 'https://docs.google.com/spreadsheets/d/e/demo/pub?output=csv';
  globalThis.fetch = (async () =>
    new Response('', {
      status: 302,
      headers: { location: 'https://evil.example.org/payload.csv' }
    })) as typeof fetch;

  try {
    const collector = new CommunitySourceCollector();
    const logs: string[] = [];
    const summary = await collector.syncAll((m) => logs.push(m));
    assert.equal(summary.sourcesQueried, 1);
    assert.equal(summary.errors, 1);
    assert.equal(logs.some((l) => l.includes('Blocked cross-host redirect')), true);
  } finally {
    globalThis.fetch = originalFetch;
    if (prevEnv === undefined) delete process.env.COMMUNITY_SHEET_CSV_URLS;
    else process.env.COMMUNITY_SHEET_CSV_URLS = prevEnv;
  }
});
