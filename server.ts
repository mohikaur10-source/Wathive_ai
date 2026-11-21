import 'dotenv/config';
import crypto from 'node:crypto';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './server/db.js';
import { collector } from './server/wusaCollector.js';
import { scheduler } from './server/scheduler.js';
import { mapToWatHiveEventItem } from './server/previewMapper.js';
import { ChatReplyError, generateBuddyChatReply } from './server/geminiChat.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

const resolvedPort = (() => {
  const defaultPort = parseInt(process.env.DEFAULT_APP_PORT || '3000', 10);
  if (process.env.NODE_ENV !== 'production') {
    return defaultPort;
  }
  if (process.env.PORT && process.env.PORT !== process.env.NGINX_PORT) {
    return parseInt(process.env.PORT, 10);
  }
  return defaultPort;
})();
const PORT = Number.isFinite(resolvedPort) ? resolvedPort : 3000;
const ADMIN_SECRET = process.env.WUSA_ADMIN_SECRET?.trim() || '';
const MIN_ADMIN_SECRET_LENGTH = 16;

// Security headers & Content Security Policy (same-origin + allowlisted fonts/images, iframe-safe in AI Studio preview)
app.use(
  helmet({
    frameguard: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        objectSrc: ["'none'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: [
          "'self'",
          'data:',
          'blob:',
          'https:'
        ],
        connectSrc: ["'self'", 'ws:', 'wss:'],
        frameAncestors: [
          "'self'",
          'https://*.google.com',
          'https://*.googleusercontent.com',
          'https://*.usercontent.goog'
        ],
        formAction: ["'self'"]
      }
    }
  })
);

app.use(express.json({ limit: '100kb' }));

// General API rate limit (~120 req/min/IP)
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests. Please try again shortly.' }
});
app.use('/api', apiLimiter);

// Strict rate limit for manual admin sync (~5 req/hr/IP)
const adminSyncLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Admin sync rate limit exceeded.' }
});

// Rate limit for real-time buddy chat replies (~30 req/min/IP)
const chatReplyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Slow down a bit — too many messages sent.' }
});

function isTimingSafeSecretMatch(provided: string, expected: string): boolean {
  const providedDigest = crypto.createHash('sha256').update(provided, 'utf8').digest();
  const expectedDigest = crypto.createHash('sha256').update(expected, 'utf8').digest();
  return crypto.timingSafeEqual(providedDigest, expectedDigest);
}

const requireAdminSecret: express.RequestHandler = (req, res, next) => {
  // When unconfigured or below minimum length, behave as disabled (404)
  if (!ADMIN_SECRET || ADMIN_SECRET.length < MIN_ADMIN_SECRET_LENGTH) {
    return res.status(404).json({ success: false, error: 'Not found' });
  }

  const authHeader = req.headers.authorization;
  const bearerToken =
    typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length).trim()
      : '';

  if (!bearerToken || !isTimingSafeSecretMatch(bearerToken, ADMIN_SECRET)) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  return next();
};

// --- PUBLIC & ADMIN API ROUTES ---

// 1. Server America/Toronto current time
app.get('/api/now', (_req, res) => {
  const now = new Date();
  const toronto = db.getTorontoDateTimeNow(now);
  res.json({
    success: true,
    timezone: 'America/Toronto',
    iso: now.toISOString(),
    ...toronto
  });
});

// 2. WatHive upcoming events feed
app.get('/api/collector/preview', (_req, res) => {
  try {
    const events = db.getAllEventsRaw();
    const previewList = events.slice(0, 200).map(mapToWatHiveEventItem);
    res.json({
      success: true,
      totalAvailable: events.length,
      sampleSize: previewList.length,
      previewEvents: previewList
    });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to load events' });
  }
});

// 3. Single protected manual sync endpoint
app.post('/api/admin/sync', adminSyncLimiter, requireAdminSecret, async (_req, res) => {
  if (collector.isBusy()) {
    return res.status(409).json({
      success: false,
      error: 'A collection sync run is currently in progress. Please wait for it to complete.'
    });
  }

  try {
    const run = await collector.executeSync('manual');
    res.json({
      success: true,
      run: {
        id: run.id,
        status: run.status,
        events_found: run.events_found,
        events_new: run.events_new,
        events_updated: run.events_updated,
        events_unchanged: run.events_unchanged
      }
    });
  } catch {
    res.status(500).json({ success: false, error: 'Sync run failed' });
  }
});

// 4. Real-time contextual buddy chat reply
app.post('/api/chat/reply', chatReplyLimiter, async (req, res) => {
  try {
    const reply = await generateBuddyChatReply(req.body);
    res.json({ success: true, reply });
  } catch (err) {
    if (err instanceof ChatReplyError) {
      return res.status(err.statusCode).json({ success: false, error: err.message });
    }
    return res.status(500).json({
      success: false,
      error: 'Could not generate a reply right now. Please try again.'
    });
  }
});

// Return JSON 404 for unknown /api routes
app.all('/api/*', (_req, res) => {
  res.status(404).json({ success: false, error: 'Not found' });
});

// --- VITE MIDDLEWARE / STATIC ASSETS ---

async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';
  const http = await import('node:http');
  const httpServer = http.createServer(app);

  let viteServer: { close: () => Promise<void> } | null = null;

  if (isDev) {
    const disableHmr = process.env.DISABLE_HMR === 'true';
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      appType: 'spa',
      server: {
        middlewareMode: true,
        hmr: disableHmr ? false : true,
        ws: disableHmr ? false : { server: httpServer }
      }
    });
    viteServer = vite;

    // In Vite 8 middlewareMode, /@vite/client still attempts a WebSocket connection on port 24678
    // even when hmr/ws are false. Serve a clean zero-WebSocket shim when HMR is disabled.
    if (disableHmr) {
      const viteClientNoopShim = `
const sheetsMap = new Map();
export function updateStyle(id, content) {
  let style = sheetsMap.get(id);
  if (!style) {
    style = document.createElement('style');
    style.setAttribute('type', 'text/css');
    style.setAttribute('data-vite-dev-id', id);
    style.textContent = content;
    document.head.appendChild(style);
    sheetsMap.set(id, style);
  } else if (style.textContent !== content) {
    style.textContent = content;
  }
}
export function removeStyle(id) {
  const style = sheetsMap.get(id);
  if (style) {
    style.remove();
    sheetsMap.delete(id);
  }
}
export function createHotContext() {
  const noop = () => {};
  return {
    data: {},
    accept: noop,
    acceptExports: noop,
    dispose: noop,
    prune: noop,
    decline: noop,
    invalidate: noop,
    on: noop,
    off: noop,
    send: noop
  };
}
export function injectQuery(url, queryToInject) {
  if (!url || (url[0] !== '.' && url[0] !== '/')) return url;
  const pathname = url.replace(/[?#].*$/, '');
  const { search, hash } = new URL(url, 'http://vite.dev');
  return \`\${pathname}?\${queryToInject}\${search ? '&' + search.slice(1) : ''}\${hash || ''}\`;
}
export class ErrorOverlay {}
`;
      app.get('/@vite/client', (_req, res) => {
        res.type('application/javascript').send(viteClientNoopShim);
      });
    }

    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`=======================================================`);
    console.log(`WatHive Backend running on port ${PORT}`);
    console.log(`Hourly Auto-Sync + Startup Sync Enabled (America/Toronto)`);
    console.log(`=======================================================`);
    scheduler.runInitialSyncOnStart();
  });

  const shutdown = async (signal: string) => {
    console.log(`[Server] Received ${signal}, shutting down gracefully...`);
    httpServer.close(() => {
      process.exit(0);
    });
    if (viteServer) {
      await viteServer.close().catch(() => {});
    }
    setTimeout(() => process.exit(0), 3000).unref();
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
