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

  typingStart: (payload: { conversationId: string }) => void;
  typingStop: (payload: { conversationId: string }) => void;
}

interface ServerToClientEvents {
  newMessage: (msg: any) => void;
  messageFailed: (err: any) => void;
  rateLimitExceeded: (data: any) => void;

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

  const io = new SocketServer(httpServer, {
    cors: {
      origin: allowedOrigin,
      methods: ['GET', 'POST'],
    },
  });

  const chat = io.of('/chat');
  chatNamespace = chat;

  // 🔐 AUTH MIDDLEWARE
  chat.use((
    socket: Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>,
    next: (err?: Error) => void
  ) => {
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      return next(new Error('server misconfiguration'));
    }

    const token = socket.handshake.auth?.token;
    console.log('[socket] received token:', token);

    if (typeof token !== 'string' || !token) {
      return next(new Error('missing token'));
    }

    try {
      const payload = jwt.verify(token, secret);

      if (!isJwtPayload(payload)) {
        return next(new Error('invalid token payload'));
      }

      socket.data.userId = String(payload.id);
      next();
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        return next(new Error('token expired'));
      }
      return next(new Error('invalid token'));
    }
  });

  // 🔌 CONNECTION
  chat.on('connection', async (
    socket: Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>
  ) => {
    const userId = socket.data.userId;
    const userIdInt = parseInt(userId, 10);

    socket.join(`user-${userId}`);
    console.log(`[socket] joined personal room user-${userId}`);
    console.log(`[socket] user ${userId} connected (${socket.id})`);

    /* ───── Presence ───── */

    const wasOffline = !presence.has(userId) || presence.get(userId)!.size === 0;

    if (!presence.has(userId)) {
      presence.set(userId, new Set());
    }

    presence.get(userId)!.add(socket.id);

		try {
      const conversationIds = await getUserConversationIds(userId);

      // Join every room the user belongs to
      for (const convId of conversationIds) {
        await socket.join(convId);
      }
      console.log(`[socket] user ${userId} auto-joined ${conversationIds.length} room(s)`);

      // Presence broadcast
      if (wasOffline) {
        for (const convId of conversationIds) {
          console.log(`[socket] emitting userOnline for user ${userId} in conversation ${convId}`);
          chat.to(convId).emit('userOnline', { userId });
        }
      }
    } catch (err) {
      console.error('userOnline error:', err);
    }

    /* ───── Events ───── */

    socket.on('joinConversation', async (payload, ack) => {
      const { conversationId } = payload;

      try {
        const allowed = await isParticipant(conversationId, userIdInt);

        if (!allowed) {
          ack?.({ ok: false, error: 'not a participant' });
          return;
        }

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
      if (contentError) {
        socket.emit('messageFailed', { conversationId, error: contentError });
        return;
      }

      const rateResult = rateLimiter.consume(userId, conversationId);
      if (!rateResult.allowed) {
        socket.emit('rateLimitExceeded', {
          conversationId,
          retryAfter: rateResult.retryAfter
        });
        return;
      }

      try {
        const allowed = await isParticipant(conversationId, userIdInt);
        if (!allowed) {
          socket.emit('messageFailed', { conversationId, error: 'not allowed' });
          return;
        }

        const result = await pool.query(
          `INSERT INTO chat.messages (conversation_id, sender_id, content)
           VALUES ($1, $2, $3)
           RETURNING *`,
          [conversationId, userIdInt, content.trim()]
        );

        const msg = result.rows[0];

        chat.to(conversationId).emit('newMessage', {
          id: msg.id,
          conversationId: msg.conversation_id, // Map from conversation_id
          senderId: msg.sender_id,             // Map from sender_id
          content: msg.content,
          createdAt: msg.created_at,           // Map from created_at
          editedAt: msg.edited_at,
        });

      } catch (err) {
        console.error('sendMessage error:', err);
        socket.emit('messageFailed', { conversationId, error: 'db error' });
      }
    });

    socket.on('typingStart', ({ conversationId }) => {
      socket.to(conversationId).emit('typingStart', { conversationId, userId });
    });

    socket.on('typingStop', ({ conversationId }) => {
      socket.to(conversationId).emit('typingStop', { conversationId, userId });
    });

    /* ───── Disconnect ───── */

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
          console.error('userOffline error:', err);
        }
      }
    });
  });

  return io;
}

export function getPresence() {
  return presence;
}