import { Server as HttpServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import pool from '../db/pool';
import { isParticipant } from '../db/helpers';

interface SocketData {
  userId: string; // seguimos usando string para presencia y rooms
}

let chatNamespace: ReturnType<InstanceType<typeof SocketServer>['of']> | null = null;

export function getChatNamespace(): typeof chatNamespace {
  return chatNamespace;
}

// userId string → Set de sockets
const presence = new Map<string, Set<string>>();

async function getUserConversationIds(userId: string): Promise<string[]> {
  const result = await pool.query<{ conversation_id: string }>(
    `SELECT conversation_id FROM conversation_participants WHERE user_id = $1`,
    [userId]
  );
  return result.rows.map(r => r.conversation_id);
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

export function attachSocketIO(httpServer: HttpServer): SocketServer {
  const io = new SocketServer(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  });

  const chat = io.of('/chat');
  chatNamespace = chat;

  // Handshake: tomamos userId directamente del gateway
  chat.use((socket: Socket, next) => {
    const userId = (socket.handshake.auth as Record<string, unknown>)?.userId;
    if (!userId || typeof userId !== 'string') return next(new Error('userId missing'));
    (socket.data as SocketData).userId = userId;
    next();
  });

  chat.on('connection', async (socket: Socket) => {
    const userIdStr = (socket.data as SocketData).userId;
    const userId = Number(userIdStr); // conversion a número para DB

    if (isNaN(userId)) {
      console.error('userId no es número válido:', userIdStr);
      socket.disconnect();
      return;
    }

    const wasOffline = !presence.has(userIdStr) || presence.get(userIdStr)!.size === 0;
    if (!presence.has(userIdStr)) presence.set(userIdStr, new Set());
    presence.get(userIdStr)!.add(socket.id);

    if (wasOffline) {
      try {
        const convs = await getUserConversationIds(userIdStr);
        convs.forEach(convId => chat.to(convId).emit('userOnline', { userId: userIdStr }));
      } catch (err) { console.error(err); }
    }

    // ── joinConversation
    socket.on('joinConversation', async (payload: unknown, ack?: (res: { ok: boolean; error?: string }) => void) => {
      if (!hasStringField(payload, 'conversationId')) return ack?.({ ok: false, error: 'conversationId required' });
      const { conversationId } = payload as { conversationId: string };
      try {
        if (!(await isParticipant(conversationId, userId))) {
          return ack?.({ ok: false, error: 'not a participant' });
        }
        await socket.join(conversationId);
        ack?.({ ok: true });
      } catch (err) {
        console.error(err);
        ack?.({ ok: false, error: 'internal error' });
      }
    });

    // ── leaveConversation
    socket.on('leaveConversation', (payload: unknown) => {
      if (!hasStringField(payload, 'conversationId')) return;
      socket.leave((payload as { conversationId: string }).conversationId);
    });

    // ── sendMessage
    socket.on('sendMessage', async (payload: unknown) => {
      if (!hasStringField(payload, 'conversationId') || !hasStringField(payload, 'content')) {
        return socket.emit('messageFailed', { error: 'conversationId and content required' });
      }
      const { conversationId, content } = payload as { conversationId: string; content: string };

      try {
        if (!(await isParticipant(conversationId, userId))) {
          return socket.emit('messageFailed', { conversationId, error: 'not a participant' });
        }

        const result = await pool.query(
          `INSERT INTO chat.messages (conversation_id, sender_id, content)
           VALUES ($1,$2,$3) RETURNING id, conversation_id, sender_id, content, created_at, edited_at`,
          [conversationId, userId, content.trim()]
        );

        const msg = result.rows[0];
        chat.to(conversationId).emit('newMessage', {
          id: msg.id,
          conversationId: msg.conversation_id,
          senderId: msg.sender_id,
          content: msg.content,
          createdAt: msg.created_at,
          editedAt: msg.edited_at,
        });
      } catch (err) {
        console.error(err);
        socket.emit('messageFailed', { conversationId, error: 'failed to persist message' });
      }
    });

    // ── typing events
    ['typingStart', 'typingStop'].forEach(event => {
      socket.on(event, (payload: unknown) => {
        if (!hasStringField(payload, 'conversationId')) return;
        const { conversationId } = payload as { conversationId: string };
        socket.to(conversationId).emit(event, { conversationId, userId: userIdStr });
      });
    });

    // ── disconnect
    socket.on('disconnect', async () => {
      presence.get(userIdStr)?.delete(socket.id);
      if (!presence.has(userIdStr) || presence.get(userIdStr)!.size === 0) {
        presence.delete(userIdStr);
        try {
          const convs = await getUserConversationIds(userIdStr);
          convs.forEach(convId => chat.to(convId).emit('userOffline', { userId: userIdStr }));
        } catch (err) { console.error(err); }
      }
    });
  });

  return io;
}

export function getPresence(): Map<string, Set<string>> {
  return presence;
}
