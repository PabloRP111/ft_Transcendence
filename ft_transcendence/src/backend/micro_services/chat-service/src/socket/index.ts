import { Server as HttpServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import pool from '../db/pool';
import { isParticipant } from '../db/helpers';
import { validateContent } from '../utils/validate';
import { rateLimiter } from './rateLimiter';

interface JwtPayload {
  sub: string;
}

interface SocketData {
  userId: string;
}

let chatNamespace: ReturnType<InstanceType<typeof SocketServer>['of']> | null = null;

export function getChatNamespace(): ReturnType<InstanceType<typeof SocketServer>['of']> | null {
  return chatNamespace;
}

const presence = new Map<string, Set<string>>();

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
    'sub' in payload &&
    typeof (payload as Record<string, unknown>).sub === 'string' &&
    (payload as Record<string, unknown>).sub !== ''
  );
}

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

  // ── Handshake middleware — JWT validation ─────────────────────────────────────
  chat.use((socket: Socket, next: (err?: Error) => void) => {
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      console.error('[socket] JWT_SECRET is not set');
      return next(new Error('server misconfiguration'));
    }

    const token = (socket.handshake.auth as Record<string, unknown>)?.token;

    if (typeof token !== 'string' || token === '') {
      return next(new Error('missing token'));
    }

    try {
      const payload = jwt.verify(token, secret) as unknown;

      if (!isJwtPayload(payload)) {
        return next(new Error('invalid token payload'));
      }

      (socket.data as SocketData).userId = payload.sub;
      next();
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        return next(new Error('token expired'));
      }
      return next(new Error('invalid token'));
    }
  });

  chat.on('connection', async (socket: Socket) => {
    const userId = (socket.data as SocketData).userId;
    const userIdInt = parseInt(userId, 10);

    console.log(`[socket] user ${userId} connected (socket ${socket.id})`);

    // ── Presence ──────────────────────────────────────────────────────────────
    const wasOffline = !presence.has(userId) || presence.get(userId)!.size === 0;
    if (!presence.has(userId)) presence.set(userId, new Set());
    presence.get(userId)!.add(socket.id);

    if (wasOffline) {
      try {
        const conversationIds = await getUserConversationIds(userId);
        for (const convId of conversationIds) {
          chat.to(convId).emit('userOnline', { userId });
        }
      } catch (err) {
        console.error(`[socket] failed to emit userOnline for ${userId}:`, err);
      }
    }

    // ── joinConversation ──────────────────────────────────────────────────────
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
          const allowed = await isParticipant(conversationId, userIdInt);
          if (!allowed) {
            ack?.({ ok: false, error: 'not a participant in this conversation' });
            return;
          }

          await socket.join(conversationId);
          console.log(`[socket] user ${userId} joined room ${conversationId}`);
          ack?.({ ok: true });
        } catch (err) {
          console.error('[socket] joinConversation error:', err);
          ack?.({ ok: false, error: 'internal error' });
        }
      },
    );

    // ── leaveConversation ─────────────────────────────────────────────────────
    socket.on('leaveConversation', (payload: unknown) => {
      if (!hasStringField(payload, 'conversationId')) return;
      const { conversationId } = payload as { conversationId: string };
      socket.leave(conversationId);
      console.log(`[socket] user ${userId} left room ${conversationId}`);
    });

    // ── sendMessage ───────────────────────────────────────────────────────────
    socket.on('sendMessage', async (payload: unknown) => {
      if (!hasStringField(payload, 'conversationId')) {
        socket.emit('messageFailed', { error: 'invalid payload: conversationId required' });
        return;
      }

      const { conversationId } = payload as { conversationId: string };

      const contentError = validateContent((payload as Record<string, unknown>).content);
      if (contentError) {
        socket.emit('messageFailed', { conversationId, error: contentError });
        return;
      }

      const { content } = payload as { conversationId: string; content: string };

      const rateResult = rateLimiter.consume(userId, conversationId);
      if (!rateResult.allowed) {
        socket.emit('rateLimitExceeded', { conversationId, retryAfter: rateResult.retryAfter });
        return;
      }

      try {
        const allowed = await isParticipant(conversationId, userIdInt);
        if (!allowed) {
          socket.emit('messageFailed', { conversationId, error: 'not a participant in this conversation' });
          return;
        }
      } catch (err) {
        console.error('[socket] sendMessage participant check error:', err);
        socket.emit('messageFailed', { conversationId, error: 'internal error' });
        return;
      }

      try {
        const result = await pool.query<{
          id: number;
          conversation_id: number;
          sender_id: number;
          content: string;
          created_at: string;
          edited_at: string | null;
        }>(
          `INSERT INTO chat.messages (conversation_id, sender_id, content)
           VALUES ($1, $2, $3)
           RETURNING id, conversation_id, sender_id, content, created_at, edited_at`,
          [conversationId, userIdInt, content.trim()],
        );

        const msg = result.rows[0];
        const newMessage = {
          id: msg.id,
          conversationId: msg.conversation_id,
          senderId: msg.sender_id,
          content: msg.content,
          createdAt: msg.created_at,
          editedAt: msg.edited_at,
        };

        chat.to(conversationId).emit('newMessage', newMessage);
        console.log(`[socket] message ${msg.id} persisted and broadcast to room ${conversationId}`);
      } catch (err) {
        console.error(`[socket] sendMessage DB error for conversation ${conversationId}:`, err);
        socket.emit('messageFailed', { conversationId, error: 'failed to persist message' });
      }
    });

    // ── typingStart / typingStop ──────────────────────────────────────────────
    socket.on('typingStart', (payload: unknown) => {
      if (!hasStringField(payload, 'conversationId')) return;
      const { conversationId } = payload as { conversationId: string };
      socket.to(conversationId).emit('typingStart', { conversationId, userId });
    });

    socket.on('typingStop', (payload: unknown) => {
      if (!hasStringField(payload, 'conversationId')) return;
      const { conversationId } = payload as { conversationId: string };
      socket.to(conversationId).emit('typingStop', { conversationId, userId });
    });

    // ── Disconnect ────────────────────────────────────────────────────────────
    socket.on('disconnect', async (reason) => {
      console.log(`[socket] user ${userId} disconnected (socket ${socket.id}, reason: ${reason})`);

      presence.get(userId)?.delete(socket.id);

      if (!presence.has(userId) || presence.get(userId)!.size === 0) {
        presence.delete(userId);

        try {
          const conversationIds = await getUserConversationIds(userId);
          for (const convId of conversationIds) {
            chat.to(convId).emit('userOffline', { userId });
          }
        } catch (err) {
          console.error(`[socket] failed to emit userOffline for ${userId}:`, err);
        }
      }
    });
  });

  return io;
}

export function getPresence(): Map<string, Set<string>> {
  return presence;
}
