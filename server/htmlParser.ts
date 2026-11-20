/**
 * Deterministic HTML Parser & Sanitizer for WUSA Events
 */

export interface ParsedEventPageDetails {
  canonicalUrl: string | null;
  jsonLd: any | null;
  registrationUrl: string | null;
  registrationDeadline: string | null;
  cancellationStatus: 'scheduled' | 'cancelled' | 'postponed';
  offers: Array<{ price: string | number; availability?: string; url?: string }>;
  pageAvailable: boolean;
  httpStatus?: number;
}

export function capString(value: string | null | undefined, maxLength: number): string {
  if (!value) return '';
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

export function sanitizeHttpUrl(
  rawUrl: string | null | undefined,
  maxLength = 2048
): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.length > maxLength) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    const normalized = parsed.toString();
    return normalized.length <= maxLength ? normalized : null;
  } catch {
    return null;
  }
}

export function decodeHtmlEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&#038;/g, '&')
    .replace(/&#38;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—')
    .replace(/&#036;/g, '$')
    .replace(/&#36;/g, '$')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#160;/g, ' ')
    .replace(/&#(\d+);/g, (_, dec) => {
      try {
        const code = parseInt(dec, 10);
        return Number.isFinite(code) && code > 0 && code <= 0x10ffff
          ? String.fromCodePoint(code)
          : '';
      } catch {
        return '';
      }
    });
}

export function sanitizeHtml(html: string): string {
  if (!html) return '';

  // Strip dangerous tags: <script>, <style>, <iframe>, <object>, <embed>
  let clean = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '');

  // Strip harmful attributes: on* event handlers, javascript: pseudo-protocols
  clean = clean
    .replace(/\s+on\w+="[^"]*"/gi, '')
    .replace(/\s+on\w+='[^']*'/gi, '')
    .replace(/\s+on\w+=\w+/gi, '')
    .replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"');

  return clean.trim();
}

export function stripHtmlToText(html: string): string {
  if (!html) return '';
  const cleaned = sanitizeHtml(html);
  const withBreaks = cleaned
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '');
  return decodeHtmlEntities(withBreaks)
    .replace(/\u00a0/g, ' ')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim();
}

/**
 * Extracts links that represent external registration, RSVPs, or ticket purchases
 */
export function extractRegistrationLinks(htmlOrText: string): string | null {
  if (!htmlOrText) return null;

  // Patterns for external forms and ticketing portals
  const regPatterns = [
    /href="([^"]*(?:forms\.gle|docs\.google\.com\/forms|eventbrite\.ca|eventbrite\.com|moneris|wusa\.ca\/waiver|ticketfi)[^"]*)"/i,
    /(https?:\/\/(?:forms\.gle|docs\.google\.com\/forms\/d\/e\/[a-zA-Z0-9_-]+|[\w-]+\.eventbrite\.ca\/[^\s"'>]+|[\w-]+\.eventbrite\.com\/[^\s"'>]+|wusa\.ca\/waiver\/[a-zA-Z0-9_-]+))/i
  ];

  for (const pat of regPatterns) {
    const match = htmlOrText.match(pat);
    if (match && match[1]) {
      const candidate = decodeHtmlEntities(match[1]);
      const safe = sanitizeHttpUrl(candidate);
      if (safe && !safe.includes('/wp-json/')) {
        return safe;
      }
    }
  }

  // Check for general RSVP links with registration keyword
  const generalMatch = htmlOrText.match(/href="([^"]+)"[^>]*>(?:RSVP|Register|Sign up|Buy Tickets|Get Tickets|Book Now|Waiver Form)/i);
  if (generalMatch && generalMatch[1] && !generalMatch[1].startsWith('#')) {
    const safe = sanitizeHttpUrl(decodeHtmlEntities(generalMatch[1]));
    if (safe && !safe.includes('/wp-json/')) {
      return safe;
    }
  }

  return null;
}

/**
 * Parse structured information from an individual WUSA event page
 */
export function parseEventHtmlPage(html: string, httpStatus = 200): ParsedEventPageDetails {
  if (httpStatus >= 400 || !html) {
    return {
      canonicalUrl: null,
      jsonLd: null,
      registrationUrl: null,
      registrationDeadline: null,
      cancellationStatus: 'scheduled',
      offers: [],
      pageAvailable: false,
      httpStatus
    };
  }

  // Canonical URL
  const canonicalMatch = html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i);
  const canonicalUrl = canonicalMatch ? sanitizeHttpUrl(canonicalMatch[1]) : null;

  // JSON-LD extraction
  let jsonLd: any = null;
  const jsonLdMatches = html.match(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
  if (jsonLdMatches) {
    for (const tag of jsonLdMatches) {
      try {
        const jsonContent = tag.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '').trim();
        const parsed = JSON.parse(jsonContent);
        const eventItem = Array.isArray(parsed)
          ? parsed.find((item: any) => item['@type'] === 'Event')
          : (parsed['@type'] === 'Event' ? parsed : null);

        if (eventItem) {
          jsonLd = eventItem;
          break;
        }
      } catch {
        // Continue looking for valid event JSON-LD
      }
    }
  }

  // Cancellation status from JSON-LD or page text
  let cancellationStatus: 'scheduled' | 'cancelled' | 'postponed' = 'scheduled';
  if (jsonLd && jsonLd.eventStatus) {
    if (String(jsonLd.eventStatus).includes('EventCancelled')) {
      cancellationStatus = 'cancelled';
    } else if (String(jsonLd.eventStatus).includes('EventPostponed')) {
      cancellationStatus = 'postponed';
    }
  } else {
    // Check page text for explicit markers
    if (/\[\s*cancell?ed\s*\]|\b(this event has been cancelled|event is cancelled)\b/i.test(html)) {
      cancellationStatus = 'cancelled';
    } else if (/\[\s*postponed\s*\]|\b(this event has been postponed)\b/i.test(html)) {
      cancellationStatus = 'postponed';
    }
  }

  // Offers & Tickets
  const offers: Array<{ price: string | number; availability?: string; url?: string }> = [];
  if (jsonLd && jsonLd.offers) {
    const rawOffers = Array.isArray(jsonLd.offers) ? jsonLd.offers : [jsonLd.offers];
    for (const o of rawOffers) {
      offers.push({
        price: o.price !== undefined ? o.price : (o.lowPrice ? `${o.lowPrice} - ${o.highPrice}` : 'Unknown'),
        availability: o.availability ? String(o.availability).replace('https://schema.org/', '') : undefined,
        url: sanitizeHttpUrl(o.url) || undefined
      });
    }
  }

  // Registration URL
  let registrationUrl = extractRegistrationLinks(html);
  if (!registrationUrl && offers.length > 0 && offers[0].url && !offers[0].url.includes('wusa.ca/event/')) {
    registrationUrl = offers[0].url;
  }

  // Registration deadline check
  let registrationDeadline: string | null = null;
  const deadlineMatch = html.match(/(?:registration|rsvp|ticket)\s+(?:deadline|closes|ends|cut-off)(?:\s+is)?[:\s]+([^<\n.]{5,50})/i);
  if (deadlineMatch) {
    registrationDeadline = capString(stripHtmlToText(deadlineMatch[1]), 200) || null;
  }

  return {
    canonicalUrl,
    jsonLd,
    registrationUrl,
    registrationDeadline,
    cancellationStatus,
    offers,
    pageAvailable: true,
    httpStatus
  };
}
