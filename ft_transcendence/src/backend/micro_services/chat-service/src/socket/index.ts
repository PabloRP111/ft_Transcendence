/**
 * socket/index.ts — Socket.IO server for the /chat namespace
 *
 * What is Socket.IO?
 *   Regular HTTP is "request/response": the client asks, the server answers, done.
 *   Socket.IO keeps a persistent two-way connection open, so the server can push
 *   data to the client at any time (e.g. "a new message arrived").
 *
 * Namespaces (/chat):
 *   Like URL paths but for sockets. We use /chat to separate chat traffic from
 *   any future socket namespaces (e.g. /game). Clients must connect to
 *   "http://host/chat" to reach this code.
 *
 * Rooms (conversation IDs):
 *   Inside a namespace, sockets can join "rooms". When a message is sent to a room,
 *   every socket in that room receives it. We use conversation UUIDs as room names.
 *   (Sockets join rooms via `joinConversation` — implemented in M6.)
 *
 * Presence (online/offline tracking):
 *   We keep an in-memory Map: userId → Set of active socket IDs.
 *   A user may have multiple tabs open — each tab is a separate socket.
 *   `userOnline` is emitted when the FIRST socket for a user connects.
 *   `userOffline` is emitted when the LAST socket for a user disconnects.
 *   This state is lost on server restart — that is intentional and acceptable.
 */

import { Server as HttpServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import pool from '../db/pool';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * The shape we expect inside a valid JWT payload.
 * We store userId on socket.data so every event handler can read it safely.
 */
interface JwtPayload {
  sub: string;
}

/**
 * We extend Socket's `data` property with our own fields.
 * socket.data is a plain object Socket.IO provides for per-socket custom state.
 */
interface SocketData {
  userId: string;
}

// ─── In-memory presence map ───────────────────────────────────────────────────

/**
 * presence: userId → Set of currently-connected socket IDs for that user.
 *
 * Why a Set of socket IDs instead of a simple boolean?
 * A single user can have multiple active sockets (multiple tabs, mobile + desktop).
 * We only consider them "offline" when ALL their sockets have disconnected.
 *
 * This map lives in module scope — it persists for the lifetime of the process.
 * It is intentionally NOT stored in the database (CLAUDE.md: "in-memory; lost on restart is acceptable").
 */
const presence = new Map<string, Set<string>>();

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * getUserConversationIds — fetch all conversation IDs the user participates in.
 *
 * We call this on connect and disconnect to know which Socket.IO rooms to
 * broadcast `userOnline` / `userOffline` to. Other sockets in those rooms
 * will receive the presence event even before they've joined the room
 * explicitly (M6 joinConversation handles explicit room joining).
 */
async function getUserConversationIds(userId: string): Promise<string[]> {
  const result = await pool.query<{ conversation_id: string }>(
    `SELECT conversation_id
     FROM conversation_participants
     WHERE user_id = $1`,
    [userId],
  );
  return result.rows.map((r) => r.conversation_id);
}

/**
 * Type guard: verifies the JWT payload has the shape we expect.
 */
function isJwtPayload(payload: unknown): payload is JwtPayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'sub' in payload &&
    typeof (payload as Record<string, unknown>).sub === 'string' &&
    (payload as Record<string, unknown>).sub !== ''
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * attachSocketIO — creates the Socket.IO server and attaches it to the HTTP server.
 *
 * Why do we need the HTTP server?
 *   Socket.IO uses the WebSocket protocol, which starts as an HTTP "upgrade" request.
 *   Both Express and Socket.IO need to share the same TCP port, so Socket.IO must
 *   hook into the same underlying `http.Server` that Express is listening on.
 *
 * @param httpServer - the Node.js http.Server created in index.ts
 * @returns the Socket.IO server instance (useful for testing and M6 event handlers)
 */
export function attachSocketIO(httpServer: HttpServer): SocketServer {
  // Create the Socket.IO server, attached to the existing HTTP server.
  // cors: "*" is permissive for development — tighten this in production.
  const io = new SocketServer(httpServer, {
    cors: {
      origin: '*', // TODO: restrict to the frontend origin in production
      methods: ['GET', 'POST'],
    },
  });

  // ── /chat namespace ──────────────────────────────────────────────────────────
  // All chat events live under /chat. Clients connect with: io("/chat", { auth: { token } })
  const chat = io.of('/chat');

  // ── Handshake middleware ─────────────────────────────────────────────────────
  /**
   * This runs ONCE per connection attempt, before `connection` fires.
   * It's analogous to Express's `authenticate` middleware but for sockets.
   *
   * The client must pass the JWT in the handshake auth object:
   *   socket = io("/chat", { auth: { token: "<jwt>" } })
   *
   * If the token is missing or invalid, we call next(new Error(...)) which
   * causes Socket.IO to reject the connection immediately.
   */
  chat.use((socket: Socket, next: (err?: Error) => void) => {
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      console.error('[socket] JWT_SECRET is not set');
      return next(new Error('server misconfiguration'));
    }

    // The client puts the JWT in socket.handshake.auth.token
    const token = (socket.handshake.auth as Record<string, unknown>)?.token;

    if (typeof token !== 'string' || token === '') {
      return next(new Error('missing token'));
    }

    try {
      // jwt.verify throws on invalid/expired tokens — same logic as the HTTP middleware
      const payload = jwt.verify(token, secret) as unknown;

      if (!isJwtPayload(payload)) {
        return next(new Error('invalid token payload'));
      }

      // Attach userId to socket.data — available in all event handlers below
      (socket.data as SocketData).userId = payload.sub;
      next(); // token is valid — allow the connection
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        return next(new Error('token expired'));
      }
      return next(new Error('invalid token'));
    }
  });

  // ── Connection handler ───────────────────────────────────────────────────────
  /**
   * Fires whenever a socket successfully passes the handshake middleware.
   * At this point we know:
   *   - socket.id: unique ID for this socket connection
   *   - socket.data.userId: the authenticated user's UUID
   */
  chat.on('connection', async (socket: Socket) => {
    const userId = (socket.data as SocketData).userId;

    console.log(`[socket] user ${userId} connected (socket ${socket.id})`);

    // ── Presence: mark user as online ────────────────────────────────────────

    // Track whether this is the user's FIRST active socket.
    // If they already have another tab open, they're already "online" — don't re-emit.
    const wasOffline = !presence.has(userId) || presence.get(userId)!.size === 0;

    // Add this socket to the user's active socket set
    if (!presence.has(userId)) {
      presence.set(userId, new Set());
    }
    presence.get(userId)!.add(socket.id);

    if (wasOffline) {
      // Query which conversations this user belongs to,
      // then broadcast `userOnline` to every room that has members who care.
      try {
        const conversationIds = await getUserConversationIds(userId);
        for (const convId of conversationIds) {
          // Emit to the room named after the conversation ID.
          // Only sockets that have joined that room (via joinConversation in M6) will receive this.
          chat.to(convId).emit('userOnline', { userId });
        }
        console.log(`[socket] emitted userOnline for ${userId} to ${conversationIds.length} rooms`);
      } catch (err) {
        // Non-fatal: presence notification failed, but the connection is still valid.
        console.error(`[socket] failed to emit userOnline for ${userId}:`, err);
      }
    }

    // ── Disconnect handler ────────────────────────────────────────────────────
    /**
     * Fires when this socket's connection closes (browser tab closed, network drop, etc.).
     * We check if this was the user's LAST socket — only then are they truly "offline".
     */
    socket.on('disconnect', async (reason) => {
      console.log(`[socket] user ${userId} disconnected (socket ${socket.id}, reason: ${reason})`);

      // Remove this socket from the presence set
      presence.get(userId)?.delete(socket.id);

      // If no more active sockets, the user is fully offline
      if (!presence.has(userId) || presence.get(userId)!.size === 0) {
        presence.delete(userId); // clean up the empty set

        try {
          const conversationIds = await getUserConversationIds(userId);
          for (const convId of conversationIds) {
            chat.to(convId).emit('userOffline', { userId });
          }
          console.log(`[socket] emitted userOffline for ${userId} to ${conversationIds.length} rooms`);
        } catch (err) {
          console.error(`[socket] failed to emit userOffline for ${userId}:`, err);
        }
      }
    });
  });

  return io;
}

/**
 * getPresence — returns the current in-memory presence map.
 * Exported for use in tests and future endpoints (e.g. "who is online?").
 */
export function getPresence(): Map<string, Set<string>> {
  return presence;
}
