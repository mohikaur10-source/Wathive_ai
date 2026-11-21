import { GoogleGenAI, ThinkingLevel } from '@google/genai';

const PRIMARY_CHAT_MODEL = 'gemini-3.1-flash-lite';
const FALLBACK_CHAT_MODEL = 'gemini-4-hydrogen';
const REQUEST_TIMEOUT_MS = 12_000;
const MAX_HISTORY_ITEMS = 16;
const MAX_MESSAGE_CHARS = 1000;
const MAX_META_CHARS = 240;

export class ChatReplyError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = 'ChatReplyError';
    this.statusCode = statusCode;
  }
}

export interface ChatHistoryTurn {
  role: 'user' | 'partner';
  text: string;
}

export interface ValidatedChatReplyInput {
  latestMessage: string;
  history: ChatHistoryTurn[];
  partner: {
    name: string;
    faculty?: string;
    program?: string;
    year?: string;
    bio?: string;
    socialBattery?: string;
  };
  user: {
    name: string;
    faculty?: string;
    program?: string;
    year?: string;
  };
  event: {
    title: string;
    location?: string;
    date?: string;
    isEnded: boolean;
  };
}

function cleanText(value: unknown, maxLen: number): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLen);
}

export function validateChatReplyPayload(body: unknown): ValidatedChatReplyInput {
  if (!body || typeof body !== 'object') {
    throw new ChatReplyError(400, 'Invalid request payload.');
  }

  const raw = body as Record<string, unknown>;
  const latestMessage = cleanText(raw.latestMessage, MAX_MESSAGE_CHARS);
  if (!latestMessage) {
    throw new ChatReplyError(400, 'Message cannot be empty.');
  }

  const rawPartner = (raw.partner && typeof raw.partner === 'object'
    ? raw.partner
    : {}) as Record<string, unknown>;
  const partnerName = cleanText(rawPartner.name, 80) || 'Your Waterloo buddy';

  const rawUser = (raw.user && typeof raw.user === 'object'
    ? raw.user
    : {}) as Record<string, unknown>;
  const userName = cleanText(rawUser.name, 80) || 'there';

  const rawEvent = (raw.event && typeof raw.event === 'object'
    ? raw.event
    : {}) as Record<string, unknown>;
  const eventTitle = cleanText(rawEvent.title, 160) || 'a campus event';

  const history: ChatHistoryTurn[] = [];
  if (Array.isArray(raw.history)) {
    for (const item of raw.history.slice(-MAX_HISTORY_ITEMS)) {
      if (!item || typeof item !== 'object') continue;
      const entry = item as Record<string, unknown>;
      const role = entry.role === 'user' ? 'user' : entry.role === 'partner' ? 'partner' : null;
      const text = cleanText(entry.text, MAX_MESSAGE_CHARS);
      if (role && text) {
        history.push({ role, text });
      }
    }
  }

  return {
    latestMessage,
    history,
    partner: {
      name: partnerName,
      faculty: cleanText(rawPartner.faculty, 80) || undefined,
      program: cleanText(rawPartner.program, 100) || undefined,
      year: cleanText(rawPartner.year, 40) || undefined,
      bio: cleanText(rawPartner.bio, MAX_META_CHARS) || undefined,
      socialBattery: cleanText(rawPartner.socialBattery, 80) || undefined
    },
    user: {
      name: userName,
      faculty: cleanText(rawUser.faculty, 80) || undefined,
      program: cleanText(rawUser.program, 100) || undefined,
      year: cleanText(rawUser.year, 40) || undefined
    },
    event: {
      title: eventTitle,
      location: cleanText(rawEvent.location, 140) || undefined,
      date: cleanText(rawEvent.date, 40) || undefined,
      isEnded: Boolean(rawEvent.isEnded)
    }
  };
}

function buildSystemInstruction(input: ValidatedChatReplyInput): string {
  const partnerDetails = [
    input.partner.program || input.partner.faculty,
    input.partner.year,
    input.partner.socialBattery ? `Event vibe: ${input.partner.socialBattery}` : ''
  ]
    .filter(Boolean)
    .join(' · ');

  const userDetails = [input.user.program || input.user.faculty, input.user.year]
    .filter(Boolean)
    .join(' · ');

  const eventTimingNote = input.event.isEnded
    ? `The event "${input.event.title}" already happened recently (${input.event.date || 'recently'}), and you two are still chatting afterward.`
    : `You matched to attend "${input.event.title}" together${input.event.location ? ` at ${input.event.location}` : ''}${input.event.date ? ` (${input.event.date})` : ''}.`;

  return [
    `You are ${input.partner.name}, a friendly University of Waterloo student texting your campus buddy ${input.user.name} on WatHive.`,
    partnerDetails ? `Your profile: ${partnerDetails}.` : '',
    input.partner.bio ? `Your bio: ${input.partner.bio}` : '',
    userDetails ? `${input.user.name}'s profile: ${userDetails}.` : '',
    eventTimingNote,
    'Reply directly to what the user just sent, staying natural and consistent with the conversation transcript.',
    'Write like a real UWaterloo student texting: casual, warm, concise (1 to 2 short sentences, roughly 10 to 35 words).',
    'Output only the message text itself—no speaker label, no markdown, no bullet lists, no surrounding quotes, and never break character.'
  ]
    .filter(Boolean)
    .join('\n');
}

function buildTranscriptPrompt(input: ValidatedChatReplyInput): string {
  const turns = [...input.history];
  const lastTurn = turns[turns.length - 1];
  if (!lastTurn || lastTurn.role !== 'user' || lastTurn.text !== input.latestMessage) {
    turns.push({ role: 'user', text: input.latestMessage });
  }

  const lines = turns.map((turn) => {
    const speaker = turn.role === 'user' ? input.user.name : input.partner.name;
    return `${speaker}: ${turn.text}`;
  });

  return [
    'Recent chat messages:',
    ...lines,
    '',
    `Write ${input.partner.name}'s next reply to ${input.user.name}'s latest message.`
  ].join('\n');
}

function getErrorStatus(err: unknown): number {
  if (typeof (err as { status?: unknown })?.status === 'number') {
    return (err as { status: number }).status;
  }
  if (typeof (err as { code?: unknown })?.code === 'number') {
    return (err as { code: number }).code;
  }
  return 0;
}

function mapGeminiError(err: unknown): ChatReplyError {
  if (err instanceof ChatReplyError) return err;

  const status = getErrorStatus(err);
  const rawMsg = err instanceof Error ? err.message : String(err ?? '');
  const upper = rawMsg.toUpperCase();

  if (
    status === 403 ||
    upper.includes('PERMISSION_DENIED') ||
    upper.includes('API_KEY_INVALID') ||
    upper.includes('API KEY NOT VALID')
  ) {
    return new ChatReplyError(
      502,
      'Could not get a reply right now. Check your GEMINI_API_KEY in Settings > Secrets.'
    );
  }

  if (status === 429 || upper.includes('RESOURCE_EXHAUSTED')) {
    return new ChatReplyError(
      429,
      'Chat replies are temporarily rate-limited. Please wait a moment and try again.'
    );
  }

  if (status === 404 || upper.includes('NOT_FOUND')) {
    return new ChatReplyError(
      502,
      'Chat reply model is currently unavailable. Please try again shortly.'
    );
  }

  return new ChatReplyError(502, 'Could not reach your buddy right now. Please try again.');
}

async function callWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => {
          reject(new ChatReplyError(504, 'Reply timed out. Please try sending again.'));
        }, timeoutMs);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function generateBuddyChatReply(body: unknown): Promise<string> {
  const input = validateChatReplyPayload(body);

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new ChatReplyError(
      503,
      'Real-time chat replies need GEMINI_API_KEY configured in Settings > Secrets.'
    );
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });

  const systemInstruction = buildSystemInstruction(input);
  const prompt = buildTranscriptPrompt(input);

  const invokeModel = async (model: string, thinkingLevel: ThinkingLevel): Promise<string> => {
    const response = await callWithTimeout(
      ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel }
        }
      }),
      REQUEST_TIMEOUT_MS
    );

    const raw = (response.text ?? '').trim();
    const cleaned = raw
      .replace(new RegExp(`^${input.partner.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:\\s*`, 'i'), '')
      .replace(/^["']|["']$/g, '')
      .trim();

    if (!cleaned) {
      throw new ChatReplyError(502, 'Received an empty reply. Please try sending again.');
    }
    return cleaned;
  };

  try {
    return await invokeModel(PRIMARY_CHAT_MODEL, ThinkingLevel.MINIMAL);
  } catch (primaryErr) {
    const status = getErrorStatus(primaryErr);
    console.error('[ChatReply] Primary model error:', status, primaryErr instanceof Error ? primaryErr.message.slice(0, 200) : 'unknown');

    // Do not retry on auth/permission errors
    if (status === 403 || status === 401) {
      throw mapGeminiError(primaryErr);
    }

    try {
      return await invokeModel(FALLBACK_CHAT_MODEL, ThinkingLevel.LOW);
    } catch (fallbackErr) {
      const fbStatus = getErrorStatus(fallbackErr);
      console.error('[ChatReply] Fallback model error:', fbStatus, fallbackErr instanceof Error ? fallbackErr.message.slice(0, 200) : 'unknown');
      throw mapGeminiError(fallbackErr);
    }
  }
}
