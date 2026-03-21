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
    let rows: Array<{
      id: number;
      conversation_id: number;
      sender_id: number;
      content: string;
      created_at: string;
      edited_at: string | null;
    }>;

    if (before && beforeId) {
      const result = await pool.query(
        `SELECT id, conversation_id, sender_id, content, created_at, edited_at
         FROM chat.messages
         WHERE conversation_id = $1
           AND (created_at, id) < ($2::timestamptz, $3::int)
         ORDER BY created_at DESC, id DESC
         LIMIT $4`,
        [conversationId, before, beforeId, limit],
      );
      rows = result.rows.reverse();
    } else {
      const result = await pool.query(
        `SELECT id, conversation_id, sender_id, content, created_at, edited_at
         FROM chat.messages
         WHERE conversation_id = $1
         ORDER BY created_at DESC, id DESC
         LIMIT $2`,
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
      }>(
        `UPDATE chat.messages
         SET content   = $1,
             edited_at = NOW()
         WHERE id             = $2
           AND conversation_id = $3
           AND sender_id      = $4
         RETURNING id, conversation_id, sender_id, content, created_at, edited_at`,
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
