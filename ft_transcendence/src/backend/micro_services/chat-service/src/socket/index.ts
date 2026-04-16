import { Server as HttpServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import pool from '../db/pool';
import { isParticipant } from '../db/helpers';
import { validateContent } from '../utils/validate';
import { rateLimiter } from './rateLimiter';
/* ──────────────── TYPES ──────────────── */
interface JwtPayload {
  id: number;
}

interface SocketData {
  userId: string;
}

interface ClientToServerEvents {
  joinConversation: (
    payload: { conversationId: string },
    ack?: (res: { ok: boolean; error?: string }) => void
  ) => void;
  leaveConversation: (payload: { conversationId: string }) => void;
  sendMessage: (payload: { conversationId: string; content: string }) => void;
  markRead: (payload: { conversationId: string }) => void;
  typingStart: (payload: { conversationId: string }) => void;
  typingStop: (payload: { conversationId: string }) => void;
}

interface ServerToClientEvents {
  newMessage: (msg: any) => void;
  messageFailed: (err: any) => void;
  rateLimitExceeded: (data: any) => void;
  messageRead: (data: { conversationId: string; userId: string; readAt: string }) => void;
  typingStart: (data: any) => void;
  typingStop: (data: any) => void;
  userOnline: (data: { userId: string }) => void;
  userOffline: (data: { userId: string }) => void;
  "force-logout": () => void;
}

/* ──────────────── STATE ──────────────── */

let chatNamespace: ReturnType<InstanceType<typeof SocketServer>['of']> | null = null;

export function getChatNamespace() {
  return chatNamespace;
}

const presence = new Map<string, Set<string>>();

/* ──────────────── HELPERS ──────────────── */

async function getUserConversationIds(userId: string): Promise<string[]> {
  const result = await pool.query<{ conversation_id: string }>(
    `SELECT conversation_id
     FROM chat.conversation_participants
     WHERE user_id = $1`,
    [parseInt(userId, 10)],
  );
  return result.rows.map((r) => r.conversation_id);
}

function hasStringField(payload: unknown, field: string): boolean {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    field in payload &&
    typeof (payload as Record<string, unknown>)[field] === 'string' &&
    ((payload as Record<string, unknown>)[field] as string).trim() !== ''
  );
}

function isJwtPayload(payload: unknown): payload is JwtPayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'id' in payload &&
    typeof (payload as Record<string, unknown>).id === 'number'
  );
}

/* ──────────────── MAIN ──────────────── */

export function attachSocketIO(httpServer: HttpServer): SocketServer {
  const allowedOrigin = process.env.FRONTEND_URL || 'https://localhost:8443';

  const io = new SocketServer<ClientToServerEvents, ServerToClientEvents, {}, SocketData>(httpServer, {
    cors: {
      origin: allowedOrigin,
      methods: ['GET', 'POST'],
    },
  });

  const chat = io.of('/chat');
  chatNamespace = chat;

  // AUTH MIDDLEWARE: JWT validation before connection
  chat.use((socket, next) => {
    const secret = process.env.JWT_SECRET;
    if (!secret) return next(new Error('server misconfiguration'));

    const token = socket.handshake.auth?.token;
    if (typeof token !== 'string' || !token) return next(new Error('missing token'));

    try {
      const payload = jwt.verify(token, secret);
      if (!isJwtPayload(payload)) return next(new Error('invalid token payload'));

      socket.data.userId = String(payload.id);
      next();
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) return next(new Error('token expired'));
      return next(new Error('invalid token'));
    }
  });

  // CONNECTION HANDLER
  chat.on('connection', async (socket) => {
    const userId = socket.data.userId;
    const userIdInt = parseInt(userId, 10);

    // Join personal room for targeted events (like force-logout)
    socket.join(`user-${userId}`);
    console.log(`[socket] user ${userId} connected (${socket.id})`);

    /* ───── Presence & Auto-Join ───── */
    const wasOffline = !presence.has(userId) || presence.get(userId)!.size === 0;
    if (!presence.has(userId)) presence.set(userId, new Set());
    presence.get(userId)!.add(socket.id);

    try {
      const conversationIds = await getUserConversationIds(userId);
      for (const convId of conversationIds) {
        await socket.join(convId);
      }

      if (wasOffline) {
        for (const convId of conversationIds) {
          chat.to(convId).emit('userOnline', { userId });
        }
      }
    } catch (err) {
      console.error('[socket] auto-join error:', err);
    }

    /* ───── Event Listeners ───── */
    socket.on('joinConversation', async ({ conversationId }, ack) => {
      try {
        const allowed = await isParticipant(conversationId, userIdInt);
        if (!allowed) return ack?.({ ok: false, error: 'not a participant' });
        await socket.join(conversationId);
        ack?.({ ok: true });
      } catch {
        ack?.({ ok: false, error: 'internal error' });
      }
    });

    socket.on('leaveConversation', ({ conversationId }) => {
      socket.leave(conversationId);
    });

    socket.on('sendMessage', async ({ conversationId, content }) => {
      const contentError = validateContent(content);
      if (contentError) return socket.emit('messageFailed', { conversationId, error: contentError });

      const rateResult = rateLimiter.consume(userId, conversationId);
      if (!rateResult.allowed) {
        return socket.emit('rateLimitExceeded', { conversationId, retryAfter: rateResult.retryAfter });
      }

      try {
        const allowed = await isParticipant(conversationId, userIdInt);
        if (!allowed) return socket.emit('messageFailed', { conversationId, error: 'not allowed' });

        // Combined SQL: Insert and Join to get username in one trip
        const result = await pool.query(
          `WITH inserted AS (
              INSERT INTO chat.messages (conversation_id, sender_id, content)
              VALUES ($1, $2, $3)
              RETURNING id, conversation_id, sender_id, content, created_at, edited_at
            )
            SELECT i.*, u.username 
            FROM inserted i
            JOIN auth.users u ON i.sender_id = u.id`,
          [conversationId, userIdInt, content.trim()]
        );

        const msg = result.rows[0];

        // Mapped response for Frontend (snake_case to camelCase)
        chat.to(conversationId).emit('newMessage', {
          id: msg.id,
          conversationId: msg.conversation_id,
          senderId: msg.sender_id,
          content: msg.content,
          createdAt: msg.created_at,
          editedAt: msg.edited_at,
          sender: { username: msg.username }
        });
      } catch (err) {
        console.error('[socket] sendMessage error:', err);
        socket.emit('messageFailed', { conversationId, error: 'db error' });
      }
    });

    // Mark conversation as read: updates last_read_at for this user and notifies
    // the other participant in real time so they can show the "Read" indicator.
    socket.on('markRead', async ({ conversationId }) => {
      if (!hasStringField({ conversationId }, 'conversationId')) return;
      try {
        const allowed = await isParticipant(conversationId, userIdInt);
        if (!allowed) return;

        const result = await pool.query<{ last_read_at: string }>(
          `UPDATE chat.conversation_participants
           SET last_read_at = NOW()
           WHERE conversation_id = $1 AND user_id = $2
           RETURNING last_read_at`,
          [conversationId, userIdInt],
        );

        const readAt = result.rows[0]?.last_read_at;
        if (!readAt) return;

        // Notify everyone in the room (the sender will use this to show "Read")
        chat.to(conversationId).emit('messageRead', {
          conversationId,
          userId,
          readAt,
        });
      } catch (err) {
        console.error('[socket] markRead error:', err);
      }
    });

    socket.on('typingStart', ({ conversationId }) => {
      socket.to(conversationId).emit('typingStart', { conversationId, userId });
    });

    socket.on('typingStop', ({ conversationId }) => {
      socket.to(conversationId).emit('typingStop', { conversationId, userId });
    });

    socket.on('disconnect', async () => {
      presence.get(userId)?.delete(socket.id);
      if (!presence.has(userId) || presence.get(userId)!.size === 0) {
        presence.delete(userId);
        try {
          const conversationIds = await getUserConversationIds(userId);
          for (const convId of conversationIds) {
            chat.to(convId).emit('userOffline', { userId });
          }
        } catch (err) {
          console.error('[socket] userOffline error:', err);
        }
      }
    });
  });

  return io;
}

export function getPresence() {
  return presence;
}