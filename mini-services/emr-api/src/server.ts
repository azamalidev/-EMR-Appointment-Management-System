import { createServer, type IncomingMessage, type ServerResponse } from 'http';
import { Server } from 'socket.io';
import { connectDB, disconnectDB } from './config/database.js';
import { createApp } from './app.js';
import { setIO } from './utils/realtime.js';
import { runSeed } from './seed.js';
import { env } from './config/env.js';

const PORT = 4000;

/**
 * Detect whether an incoming HTTP request is a real Engine.IO request.
 *
 * IMPORTANT context: Socket.IO is configured with `path: '/'`. With that
 * path, Engine.IO attaches a 'request' listener that (because every URL
 * path starts with "/") tries to handle EVERY HTTP request, returning
 * `{"code":0,"message":"Transport unknown"}` for any non-Engine.IO URL.
 * That breaks Express entirely — /health, /api/v1/auth/login, etc. all
 * return that error.
 *
 * Fix: after `new Server(httpServer, …)`, capture Socket.IO's request
 * listener, remove it, and install a dispatcher that:
 *   - Hands Engine.IO polling requests (URLs containing EIO= / transport= /
 *     sid= query params) to Socket.IO's listener.
 *   - Hands everything else to Express's listener.
 * WebSocket upgrades go through the separate 'upgrade' event, untouched.
 */
function isEngineIoRequest(req: IncomingMessage): boolean {
  const u = req.url || '';
  return /[?&](EIO|transport|sid)=/.test(u);
}

async function main(): Promise<void> {
  console.log('[server] Booting EMR API (Express + MongoDB via mongodb-memory-server)...');

  // 1. Connect to in-memory MongoDB.
  await connectDB();

  // 2. Run idempotent seed.
  try {
    await runSeed();
  } catch (e) {
    console.error('[server] Seed failed:', e);
  }

  // 3. Create Express app.
  const app = createApp();

  // 4. Wrap in HTTP server (Express is the request listener).
  //    Save a reference to Express's request listener BEFORE Socket.IO
  //    wraps it — we'll need it in our dispatcher below.
  const expressListener = (req: IncomingMessage, res: ServerResponse) => app(req, res);
  const httpServer = createServer(expressListener);

  // 5. Attach Socket.IO with path "/". This internally calls
  //    `engine.attach(httpServer, …)` which REMOVES all existing 'request'
  //    listeners (including expressListener) and installs its own listener
  //    that — because path "/" matches every URL — would intercept EVERY
  //    request and return {"code":0,"message":"Transport unknown"} for any
  //    non-Engine.IO URL. That would completely break Express.
  const io = new Server(httpServer, {
    path: '/',
    cors: { origin: '*', methods: ['GET', 'POST'] },
    pingTimeout: 60000,
    pingInterval: 25000,
  });
  setIO(io);

  // 6. Reorder 'request' listeners so OUR dispatcher runs first.
  //    After `new Server(httpServer, …)` the only 'request' listener is
  //    the one Socket.IO just installed. Capture it, remove it, then install
  //    a single dispatcher that:
  //      - Hands Engine.IO polling requests (URLs with EIO=/transport=/sid=
  //        query params) to Socket.IO's listener.
  //      - Hands everything else to Express's listener.
  //    WebSocket upgrades go through the separate 'upgrade' event, untouched.
  const allListeners = httpServer.listeners('request').slice() as Array<
    (req: IncomingMessage, res: ServerResponse) => void
  >;
  httpServer.removeAllListeners('request');
  const socketIoListener = allListeners[0]; // the only one, installed by engine.io

  httpServer.on('request', (req: IncomingMessage, res: ServerResponse) => {
    if (socketIoListener && isEngineIoRequest(req)) {
      socketIoListener(req, res);
      return;
    }
    expressListener(req, res);
  });

  // 7. Socket.IO connection handling.
  io.on('connection', (socket) => {
    console.log('[socket] connected', socket.id);
    socket.on('subscribe', (room: string) => {
      if (typeof room === 'string' && room.length > 0) socket.join(room);
    });
    socket.on('unsubscribe', (room: string) => {
      if (typeof room === 'string' && room.length > 0) socket.leave(room);
    });
    socket.on('disconnect', (reason) => {
      console.log('[socket] disconnected', socket.id, reason);
    });
    socket.on('error', (err) => {
      console.warn('[socket] error', socket.id, err);
    });
  });

  // 8. Start listening on port 4000.
  httpServer.listen(PORT, () => {
    console.log(`[server] EMR API (Express + MongoDB) on port ${PORT} — env=${env.nodeEnv}`);
    console.log('[server] Socket.IO listening on path "/" (CORS "*")');
  });

  // 9. Graceful shutdown.
  const shutdown = async (sig: string) => {
    console.log(`[server] ${sig} received, shutting down...`);
    try {
      io.close();
    } catch {
      /* noop */
    }
    try {
      httpServer.close();
    } catch {
      /* noop */
    }
    await disconnectDB();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => {
    console.error('[server] Unhandled rejection:', reason);
  });
  process.on('uncaughtException', (err) => {
    console.error('[server] Uncaught exception:', err);
  });
}

main().catch((err) => {
  console.error('[server] Fatal error during boot:', err);
  process.exit(1);
});
