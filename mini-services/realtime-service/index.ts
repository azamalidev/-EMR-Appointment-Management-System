/**
 * EMR Realtime Service
 * --------------------
 * Independent Socket.IO mini-service for the Enterprise EMR Appointment
 * Management System.
 *
 * Responsibilities:
 *   - Accept long-lived WebSocket connections from browser clients (path "/").
 *   - Expose an HTTP `/__broadcast` endpoint that Next.js API routes call to
 *     fan-out real-time EMR appointment events to all (or room-scoped) clients.
 *
 * Port: 3003 (hardcoded — never read from env, per project conventions).
 *
 * Browser clients connect via: io("/?XTransformPort=3003")
 * Next.js API routes broadcast via: POST http://localhost:3003/__broadcast
 *
 * Implementation note on path "/":
 *   Socket.IO, when configured with path "/", attaches its own HTTP
 *   'request' listener and (because every URL path starts with "/") tries to
 *   interpret EVERY request as an Engine.IO request — returning
 *   `{"code":0,"message":"Transport unknown"}` for /__broadcast and plain
 *   health checks. To support both Socket.IO AND a custom HTTP endpoint on the
 *   same port, we reorder the 'request' listeners so OUR dispatcher runs first
 *   and selectively hands off Engine.IO requests (those carrying EIO= /
 *   transport= / sid= query params) to Socket.IO's listener.
 */

import { createServer, IncomingMessage, ServerResponse } from 'http';
import { Server, Socket } from 'socket.io';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const PORT = 3003; // Hardcoded — never read from env (per project conventions).
const BROADCAST_PATH = '/__broadcast';

interface BroadcastBody {
  token?: string;
  event?: string;
  payload?: unknown;
  room?: string;
}

interface AuthData {
  token?: string;
}

// ---------------------------------------------------------------------------
// HTTP server (no request callback — Socket.IO will attach, then we wrap it)
// ---------------------------------------------------------------------------
const httpServer = createServer();

// ---------------------------------------------------------------------------
// Socket.IO server — attaches its own 'request' and 'upgrade' listeners.
// ---------------------------------------------------------------------------
const io = new Server(httpServer, {
  // CRITICAL: path "/" is required so that Caddy can forward
  // `/?XTransformPort=3003` requests to this service.
  path: '/',
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// ---------------------------------------------------------------------------
// Reorder 'request' listeners so our dispatcher runs first.
// After `new Server(httpServer, …)`, the only 'request' listener is the one
// Socket.IO just attached. We capture it, remove it, then install our own
// dispatcher that decides whether to handle the request itself (broadcast /
// health) or hand it off to Socket.IO (real Engine.IO handshakes).
// ---------------------------------------------------------------------------
const socketIoRequestListener = httpServer.listeners('request')[0] as
  | ((req: IncomingMessage, res: ServerResponse) => void)
  | undefined;

httpServer.removeAllListeners('request');

function isSocketIORequest(req: IncomingMessage): boolean {
  const u = req.url || '';
  // Engine.IO polling requests always carry EIO=, transport=, and (after the
  // first exchange) sid= query params. WebSocket upgrades are handled via the
  // 'upgrade' event, not here.
  return /[?&](EIO|transport|sid)=/.test(u);
}

function writeJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Buffer));
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

httpServer.on('request', async (req: IncomingMessage, res: ServerResponse) => {
  const url = req.url || '';
  const pathname = url.split('?')[0];

  // ---- /__broadcast endpoint (POST only) -------------------------------
  if (req.method === 'POST' && pathname === BROADCAST_PATH) {
    let body: BroadcastBody;
    try {
      body = (await readJsonBody(req)) as BroadcastBody;
    } catch {
      return writeJson(res, 400, { success: false, message: 'invalid JSON body' });
    }

    // --- Token validation ---
    const expectedToken = process.env.REALTIME_BROADCAST_TOKEN;
    if (!expectedToken) {
      console.warn(
        '[broadcast] REALTIME_BROADCAST_TOKEN is not set — accepting all broadcast requests. This is unsafe for production.'
      );
    } else if (typeof body.token !== 'string' || body.token !== expectedToken) {
      console.warn('[broadcast] unauthorized broadcast attempt.');
      return writeJson(res, 401, { success: false, message: 'unauthorized' });
    }

    // --- Event validation ---
    if (typeof body.event !== 'string' || body.event.length === 0) {
      return writeJson(res, 400, { success: false, message: 'missing or invalid "event"' });
    }

    const event = body.event;
    const payload = body.payload;
    const room =
      typeof body.room === 'string' && body.room.length > 0 ? body.room : null;

    if (room) {
      io.to(room).emit(event, payload);
      const roomSize = io.sockets.adapter.rooms.get(room)?.size ?? 0;
      console.log(
        `[broadcast] room="${room}" event="${event}" clients_in_room=${roomSize}`
      );
    } else {
      io.emit(event, payload);
      console.log(
        `[broadcast] global event="${event}" connected_clients=${io.engine.clientsCount}`
      );
    }

    return writeJson(res, 200, { success: true });
  }

  // ---- Socket.IO hand-off ----------------------------------------------
  // Real Engine.IO polling requests must reach Socket.IO's own listener.
  if (socketIoRequestListener && isSocketIORequest(req)) {
    socketIoRequestListener(req, res);
    return;
  }

  // ---- Default: service health / identity ------------------------------
  // Any other request (plain GET /, unknown paths, non-POST to /__broadcast,
  // etc.) gets a simple 200 identity response.
  return writeJson(res, 200, { ok: true, service: 'emr-realtime' });
});

// ---------------------------------------------------------------------------
// Socket.IO connection handling
// ---------------------------------------------------------------------------
function handleConnection(socket: Socket): void {
  const socketId = socket.id;
  const connectedAt = new Date().toISOString();
  console.log(`[socket] connected id=${socketId}`);

  // Greet the new client
  socket.emit('connected', { socketId, at: connectedAt });

  // Room subscription
  socket.on('subscribe', (room: unknown) => {
    if (typeof room !== 'string' || room.length === 0) {
      socket.emit('error', { message: 'invalid room in "subscribe"' });
      return;
    }
    void socket.join(room);
    console.log(`[socket] id=${socketId} joined room="${room}"`);
    socket.emit('subscribed', { room });
  });

  socket.on('unsubscribe', (room: unknown) => {
    if (typeof room !== 'string' || room.length === 0) {
      socket.emit('error', { message: 'invalid room in "unsubscribe"' });
      return;
    }
    void socket.leave(room);
    console.log(`[socket] id=${socketId} left room="${room}"`);
    socket.emit('unsubscribed', { room });
  });

  // Best-effort authentication (demo only — no hard auth)
  socket.on('authenticate', (data: unknown) => {
    const token =
      data && typeof data === 'object' && 'token' in data
        ? String((data as AuthData).token ?? '')
        : '';
    (socket.data as { token?: string }).token = token;
    console.log(`[socket] id=${socketId} authenticated (best-effort)`);
    socket.emit('authenticated', { ok: true, socketId });
  });

  // Latency helper
  socket.on('ping', (ts: unknown) => {
    socket.emit('pong', { clientTs: ts, serverTs: Date.now() });
  });

  socket.on('disconnect', (reason: string) => {
    console.log(`[socket] disconnected id=${socketId} reason=${reason}`);
  });

  socket.on('error', (err: Error) => {
    console.error(`[socket] error id=${socketId}:`, err);
  });
}

io.on('connection', handleConnection);

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
httpServer.listen(PORT, () => {
  console.log(
    `[emr-realtime] Socket.IO service listening on port ${PORT} (path "/")`
  );
  if (!process.env.REALTIME_BROADCAST_TOKEN) {
    console.warn(
      '[emr-realtime] WARNING: REALTIME_BROADCAST_TOKEN is unset — /__broadcast accepts all requests.'
    );
  }
});

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------
function shutdown(signal: string): void {
  console.log(`[emr-realtime] received ${signal}, shutting down...`);
  // Close Socket.IO first so clients get a clean disconnect
  io.close(() => {
    httpServer.close(() => {
      console.log('[emr-realtime] http server closed.');
      process.exit(0);
    });
  });
  // Force-exit if close hangs
  setTimeout(() => {
    console.warn('[emr-realtime] shutdown timed out, forcing exit.');
    process.exit(0);
  }, 5000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
