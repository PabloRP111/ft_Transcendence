import { Router, Request, Response } from 'express';
import pool from '../db/pool';
import { isParticipant } from '../db/helpers';
import { getChatNamespace } from '../socket';
import { validateContent } from '../utils/validate';

const router = Router();

// ─── POST /conversations/:conversationId/messages ──────────────────────────────

router.post('/:conversationId/messages', async (req: Request, res: Response): Promise<void> => {
  const { conversationId } = req.params;
  const { content } = req.body as { content: unknown };
  const userId = parseInt(req.userId, 10);

  const contentError = validateContent(content);
  if (contentError) {
    res.status(400).json({ error: contentError });
    return;
  }
  const validContent = content as string;

  const allowed = await isParticipant(conversationId, userId);
  if (!allowed) {
    res.status(403).json({ error: 'not a participant in this conversation' });
    return;
  }

  try {
    /* Updated query to JOIN with auth.users to get the sender's username [English Comment] */
    const result = await pool.query<{
      id: number;
      conversation_id: number;
      sender_id: number;
      content: string;
      created_at: string;
      edited_at: string | null;
      username: string; // From JOIN
    }>(
      `WITH inserted AS (
         INSERT INTO chat.messages (conversation_id, sender_id, content)
         VALUES ($1, $2, $3)
         RETURNING id, conversation_id, sender_id, content, created_at, edited_at
       )
       SELECT i.*, u.username 
       FROM inserted i
       JOIN auth.users u ON i.sender_id = u.id`,
      [conversationId, userId, validContent.trim()],
    );

    const msg = result.rows[0];

    res.status(201).json({
      id: msg.id,
      conversationId: msg.conversation_id,
      senderId: msg.sender_id,
      content: msg.content,
      createdAt: msg.created_at,
      editedAt: msg.edited_at,
      sender: {
        username: msg.username
      }
    });
  } catch (err) {
    console.error('[POST /messages] error:', err);
    res.status(500).json({ error: 'internal server error' });
  }
});

// ─── GET /conversations/:conversationId/messages ───────────────────────────────

router.get('/:conversationId/messages', async (req: Request, res: Response): Promise<void> => {
  const { conversationId } = req.params;
  const userId = parseInt(req.userId, 10);

  const allowed = await isParticipant(conversationId, userId);
  if (!allowed) {
    res.status(403).json({ error: 'not a participant in this conversation' });
    return;
  }

  const { before, beforeId } = req.query as { before?: string; beforeId?: string };
  const rawLimit = parseInt(req.query.limit as string, 10);
  const limit = isNaN(rawLimit) ? 50 : Math.min(Math.max(rawLimit, 1), 100);

  try {
    /* Define row type including username from JOIN [English Comment] */
    type MessageRow = {
      id: number;
      conversation_id: number;
      sender_id: number;
      content: string;
      created_at: string;
      edited_at: string | null;
      username: string;
    };

    let rows: MessageRow[];

    /* Updated SELECT queries to JOIN with users [English Comment] */
    const baseQuery = `
      SELECT m.id, m.conversation_id, m.sender_id, m.content, m.created_at, m.edited_at, u.username
      FROM chat.messages m
      JOIN auth.users u ON m.sender_id = u.id
      WHERE m.conversation_id = $1
    `;

    if (before && beforeId) {
      const result = await pool.query<MessageRow>(
        `${baseQuery} AND (m.created_at, m.id) < ($2::timestamptz, $3::int)
         ORDER BY m.created_at DESC, m.id DESC LIMIT $4`,
        [conversationId, before, beforeId, limit],
      );
      rows = result.rows.reverse();
    } else {
      const result = await pool.query<MessageRow>(
        `${baseQuery} ORDER BY m.created_at DESC, m.id DESC LIMIT $2`,
        [conversationId, limit],
      );
      rows = result.rows.reverse();
    }

    res.json(
      rows.map((msg) => ({
        id: msg.id,
        conversationId: msg.conversation_id,
        senderId: msg.sender_id,
        content: msg.content,
        createdAt: msg.created_at,
        editedAt: msg.edited_at,
        sender: {
          username: msg.username
        }
      })),
    );
  } catch (err) {
    console.error('[GET /messages] error:', err);
    res.status(500).json({ error: 'internal server error' });
  }
});

// ─── PATCH /conversations/:conversationId/messages/:messageId ─────────────────

router.patch(
  '/:conversationId/messages/:messageId',
  async (req: Request, res: Response): Promise<void> => {
    const { conversationId, messageId } = req.params;
    const { content } = req.body as { content: unknown };
    const userId = parseInt(req.userId, 10);

    const contentError = validateContent(content);
    if (contentError) {
      res.status(400).json({ error: contentError });
      return;
    }
    const validContent = content as string;

    const allowed = await isParticipant(conversationId, userId);
    if (!allowed) {
      res.status(403).json({ error: 'not a participant in this conversation' });
      return;
    }

    try {
      const result = await pool.query<{
        id: number;
        conversation_id: number;
        sender_id: number;
        content: string;
        created_at: string;
        edited_at: string;
        username: string;
      }>(
        `WITH updated AS (
           UPDATE chat.messages
           SET content = $1, edited_at = NOW()
           WHERE id = $2 AND conversation_id = $3 AND sender_id = $4
           RETURNING id, conversation_id, sender_id, content, created_at, edited_at
         )
         SELECT u.*, usr.username 
         FROM updated u
         JOIN auth.users usr ON u.sender_id = usr.id`,
        [validContent.trim(), messageId, conversationId, userId],
      );

      if (result.rowCount === 0) {
        res.status(403).json({ error: 'not the sender of this message' });
        return;
      }

      const msg = result.rows[0];

      const editedMessage = {
        id: msg.id,
        conversationId: msg.conversation_id,
        senderId: msg.sender_id,
        content: msg.content,
        createdAt: msg.created_at,
        editedAt: msg.edited_at,
        sender: {
          username: msg.username
        }
      };

      const chat = getChatNamespace();
      if (chat) {
        chat.to(conversationId).emit('messageEdited', editedMessage);
      }

      res.json(editedMessage);
    } catch (err) {
      console.error('[PATCH /messages] error:', err);
      res.status(500).json({ error: 'internal server error' });
    }
  },
);

export default router;