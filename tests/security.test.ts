import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeHttpUrl,
  stripHtmlToText,
  extractRegistrationLinks,
  parseEventHtmlPage
} from '../server/htmlParser.js';
import { safeHttpUrl, safeMediaUrl } from '../src/utils/urlSafety.js';

test('sanitizeHttpUrl rejects javascript:, data:, vbscript:, and non-URLs', () => {
  assert.equal(sanitizeHttpUrl('javascript:alert(1)'), null);
  assert.equal(sanitizeHttpUrl('data:text/html,<script>alert(1)</script>'), null);
  assert.equal(sanitizeHttpUrl('vbscript:msgbox(1)'), null);
  assert.equal(sanitizeHttpUrl('/relative/path'), null);
  assert.equal(sanitizeHttpUrl('https://wusa.ca/events/'), 'https://wusa.ca/events/');
  assert.equal(sanitizeHttpUrl('http://example.com/test'), 'http://example.com/test');
});

test('safeHttpUrl and safeMediaUrl validate client URLs safely', () => {
  assert.equal(safeHttpUrl('javascript:void(0)'), null);
  assert.equal(safeHttpUrl('https://forms.gle/abc123'), 'https://forms.gle/abc123');
  assert.equal(safeMediaUrl('//evil.com/x.png'), null);
  assert.equal(safeMediaUrl('/src/assets/images/test.jpg'), '/src/assets/images/test.jpg');
  assert.equal(safeMediaUrl('https://wusa.ca/wp-content/img.png'), 'https://wusa.ca/wp-content/img.png');
});

test('stripHtmlToText removes scripts, iframes, and HTML tags cleanly', () => {
  const dirty = '<p>Hello <b>Waterloo</b>!</p><script>alert(1)</script><iframe src="https://evil.test"></iframe><p>Join &amp; enjoy.</p>';
  const clean = stripHtmlToText(dirty);
  assert.equal(clean, 'Hello Waterloo!\n\nJoin & enjoy.');
  assert.equal(clean.includes('<'), false);
  assert.equal(clean.includes('alert'), false);
});

test('extractRegistrationLinks and parseEventHtmlPage reject non-http links', () => {
  const html = '<a href="javascript:alert(1)">Register</a><a href="https://forms.gle/wusa123">Sign up</a>';
  assert.equal(extractRegistrationLinks(html), 'https://forms.gle/wusa123');

  const badPage = parseEventHtmlPage('<link rel="canonical" href="javascript:alert(1)">');
  assert.equal(badPage.canonicalUrl, null);
});
