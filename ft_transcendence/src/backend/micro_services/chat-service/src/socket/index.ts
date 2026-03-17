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
import { isParticipant } from '../db/helpers';
import { validateContent } from '../utils/validate';
import { rateLimiter } from './rateLimiter';

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

// ─── Module-level namespace reference ────────────────────────────────────────

/**
 * chatNamespace — the Socket.IO /chat namespace, stored at module scope.
 *
 * Why store it here?
 *   REST route handlers (e.g. PATCH /messages/:id) need to emit socket events
 *   after a successful DB write. But route handlers don't have direct access to
 *   the Socket.IO server — they're wired up through Express, separately from Socket.IO.
 *
 *   By storing the namespace here and exporting a getter, any module can call
 *   getChatNamespace() to emit events without needing the full io instance passed
 *   around through every layer of the app.
 *
 * It's set once when attachSocketIO() runs (before the server starts accepting
 * requests), so it's always populated by the time any route handler runs.
 */
let chatNamespace: ReturnType<InstanceType<typeof SocketServer>['of']> | null = null;

/**
 * getChatNamespace — returns the /chat namespace for emitting events from outside the socket layer.
 * Returns null if called before attachSocketIO() — should never happen in practice.
 */
export function getChatNamespace(): ReturnType<InstanceType<typeof SocketServer>['of']> | null {
  return chatNamespace;
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
 * hasStringField — type guard that checks a payload object has a non-empty string field.
 *
 * We use `unknown` for all incoming socket event payloads because clients are
 * untrusted — they can send anything. This guard lets us safely narrow the type
 * before reading specific fields.
 *
 * Example:
 *   hasStringField(payload, 'conversationId') // true if payload.conversationId is a non-empty string
 */
function hasStringField(payload: unknown, field: string): boolean {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    field in payload &&
    typeof (payload as Record<string, unknown>)[field] === 'string' &&
    ((payload as Record<string, unknown>)[field] as string).trim() !== ''
  );
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

  // Store in module scope so REST route handlers can emit events via getChatNamespace()
  chatNamespace = chat;

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

    // ── joinConversation ─────────────────────────────────────────────────────
    /**
     * Client emits: { conversationId: string }
     * Optional ACK callback: (result: { ok: boolean; error?: string }) => void
     *
     * What is a Socket.IO "room"?
     *   A room is just a named group of sockets. When you call socket.join("abc"),
     *   that socket subscribes to any event emitted to the "abc" room.
     *   Rooms are identified by a string — we use conversation UUIDs.
     *
     * We check DB participation before joining. A user who is not in the
     * conversation_participants table cannot join the room and will never
     * receive messages from it.
     *
     * The optional ACK callback lets the client know immediately whether the
     * join succeeded or why it failed, without needing a separate error event.
     */
    socket.on(
      'joinConversation',
      async (
        payload: unknown,
        ack?: (result: { ok: boolean; error?: string }) => void,
      ) => {
        if (!hasStringField(payload, 'conversationId')) {
          ack?.({ ok: false, error: 'invalid payload: conversationId required' });
          return;
        }

        const { conversationId } = payload as { conversationId: string };

        try {
          const allowed = await isParticipant(conversationId, userId);

          if (!allowed) {
            ack?.({ ok: false, error: 'not a participant in this conversation' });
            return;
          }

          // socket.join(roomName) — adds this socket to the named room.
          // After this call, chat.to(conversationId).emit(...) will reach this socket.
          await socket.join(conversationId);
          console.log(`[socket] user ${userId} joined room ${conversationId}`);
          ack?.({ ok: true });
        } catch (err) {
          console.error('[socket] joinConversation error:', err);
          ack?.({ ok: false, error: 'internal error' });
        }
      },
    );

    // ── leaveConversation ────────────────────────────────────────────────────
    /**
     * Client emits: { conversationId: string }
     *
     * Removes the socket from the room. The client will no longer receive
     * `newMessage` events for this conversation until they join again.
     * No DB write needed — this is purely a socket-level operation.
     */
    socket.on('leaveConversation', (payload: unknown) => {
      if (!hasStringField(payload, 'conversationId')) return;

      const { conversationId } = payload as { conversationId: string };
      socket.leave(conversationId);
      console.log(`[socket] user ${userId} left room ${conversationId}`);
    });

    // ── sendMessage ──────────────────────────────────────────────────────────
    /**
     * Client emits: { conversationId: string, content: string }
     *
     * "Persist before emit" invariant (from CLAUDE.md):
     *   The message MUST be written to the DB successfully before we broadcast it.
     *   This guarantees that reconnecting clients can always fetch the full
     *   history via GET /conversations/:id/messages.
     *
     * Success flow:
     *   1. Validate payload
     *   2. Verify the sender is a participant (access control)
     *   3. INSERT into messages table
     *   4. Broadcast `newMessage` to the conversation room
     *      (sender receives it too if they've joined the room — keeps clients in sync)
     *
     * Failure flow:
     *   - Any error → emit `messageFailed` to the sender only (no broadcast)
     *   - `newMessage` is NEVER emitted if the DB write didn't succeed
     *
     * The `newMessage` payload shape matches the REST response exactly so the
     * client can use the same data model for both HTTP history and real-time events.
     */
    socket.on('sendMessage', async (payload: unknown) => {
      // ── Step 1: validate conversationId ─────────────────────────────────────
      if (!hasStringField(payload, 'conversationId')) {
        socket.emit('messageFailed', { error: 'invalid payload: conversationId required' });
        return;
      }

      const { conversationId } = payload as { conversationId: string };

      // ── Step 2: validate content (type, empty, max length) ──────────────────
      // validateContent returns null on success or an error string on failure.
      // We check the raw field from payload (not yet narrowed to string).
      const contentError = validateContent((payload as Record<string, unknown>).content);
      if (contentError) {
        socket.emit('messageFailed', { conversationId, error: contentError });
        return;
      }

      // Safe to cast — validateContent confirmed it's a non-empty string within length.
      const { content } = payload as { conversationId: string; content: string };

      // ── Step 3: rate limit check ─────────────────────────────────────────────
      // Checked BEFORE the DB participant query to avoid unnecessary DB load.
      // The rate limit key is "userId:conversationId" — independent per conversation.
      const rateResult = rateLimiter.consume(userId, conversationId);
      if (!rateResult.allowed) {
        // Emit rateLimitExceeded (not messageFailed) so the client can distinguish
        // the reason and show a "slow down" UI hint with the retry delay.
        socket.emit('rateLimitExceeded', {
          conversationId,
          retryAfter: rateResult.retryAfter, // ms until 1 token refills
        });
        return;
      }

      // ── Access control ──────────────────────────────────────────────────────
      try {
        const allowed = await isParticipant(conversationId, userId);
        if (!allowed) {
          socket.emit('messageFailed', {
            conversationId,
            error: 'not a participant in this conversation',
          });
          return;
        }
      } catch (err) {
        console.error('[socket] sendMessage participant check error:', err);
        socket.emit('messageFailed', { conversationId, error: 'internal error' });
        return;
      }

      // ── Persist to DB, then broadcast ──────────────────────────────────────
      try {
        /*
         * INSERT the message. We use RETURNING to get back all fields in one
         * round-trip — no need for a separate SELECT after the insert.
         */
        const result = await pool.query<{
          id: string;
          conversation_id: string;
          sender_id: string;
          content: string;
          created_at: string;
          edited_at: string | null;
        }>(
          `INSERT INTO messages (conversation_id, sender_id, content)
           VALUES ($1, $2, $3)
           RETURNING id, conversation_id, sender_id, content, created_at, edited_at`,
          [conversationId, userId, content.trim()],
        );

        const msg = result.rows[0];

        // Build the message object — same camelCase shape as the REST endpoint.
        // This consistency means the frontend can handle both HTTP and socket
        // messages with the same code.
        const newMessage = {
          id: msg.id,
          conversationId: msg.conversation_id,
          senderId: msg.sender_id,
          content: msg.content,
          createdAt: msg.created_at,
          editedAt: msg.edited_at,
        };

        // Broadcast to the room — every socket that called joinConversation for
        // this conversation (including the sender) will receive `newMessage`.
        chat.to(conversationId).emit('newMessage', newMessage);
        console.log(`[socket] message ${msg.id} persisted and broadcast to room ${conversationId}`);
      } catch (err) {
        // DB write failed — notify sender only, do NOT broadcast.
        // The "no partial state" rule: either everyone gets the message or nobody does.
        console.error(`[socket] sendMessage DB error for conversation ${conversationId}:`, err);
        socket.emit('messageFailed', { conversationId, error: 'failed to persist message' });
      }
    });

    // ── typingStart / typingStop ─────────────────────────────────────────────
    /**
     * Client emits: { conversationId: string }
     *
     * These are ephemeral presence hints — they are NOT persisted to the DB.
     * The server simply rebroadcasts them to the conversation room, excluding
     * the sender (no one needs to see their own "typing..." indicator).
     *
     * Why `socket.to(room)` instead of `chat.to(room)`?
     *   `chat.to(room).emit(...)` — sends to ALL sockets in the room, including sender.
     *   `socket.to(room).emit(...)` — sends to all sockets in the room EXCEPT the sender.
     *   For typing indicators we always want to exclude the sender.
     *
     * The payload forwarded to other clients includes `userId` so the UI
     * knows whose name to display in the "Alice is typing..." indicator.
     */
    socket.on('typingStart', (payload: unknown) => {
      if (!hasStringField(payload, 'conversationId')) return;

      const { conversationId } = payload as { conversationId: string };
      // Rebroadcast to room, excluding this socket
      socket.to(conversationId).emit('typingStart', { conversationId, userId });
    });

    socket.on('typingStop', (payload: unknown) => {
      if (!hasStringField(payload, 'conversationId')) return;

      const { conversationId } = payload as { conversationId: string };
      socket.to(conversationId).emit('typingStop', { conversationId, userId });
    });

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
