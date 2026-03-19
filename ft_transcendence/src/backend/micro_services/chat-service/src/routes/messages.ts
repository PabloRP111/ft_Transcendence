import { Router, Request, Response } from 'express';
import pool from '../db/pool';

const router = Router();

// Enviar mensaje
router.post('/:conversationId/messages', async (req: Request, res: Response) => {
  const { conversationId } = req.params;
  const { content } = req.body as { content: string };

  if (!content || content.trim() === '') {
    res.status(400).json({ error: 'content must be non-empty' });
    return;
  }

  try {
    const result = await pool.query(
      `INSERT INTO chat.messages (conversation_id, sender_id, content)
       VALUES ($1, 1, $2)
       RETURNING id, conversation_id, sender_id, content, created_at, edited_at`,
      [conversationId, content.trim()]
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
    console.error(err);
    res.status(500).json({ error: 'internal server error' });
  }
});

// Listar mensajes
router.get('/:conversationId/messages', async (req: Request, res: Response) => {
  const { conversationId } = req.params;
  const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 50, 1), 100);

  try {
    const result = await pool.query(
      `SELECT id, conversation_id, sender_id, content, created_at, edited_at
       FROM chat.messages
       WHERE conversation_id = $1
       ORDER BY created_at ASC
       LIMIT $2`,
      [conversationId, limit]
    );

    res.json(result.rows.map(msg => ({
      id: msg.id,
      conversationId: msg.conversation_id,
      senderId: msg.sender_id,
      content: msg.content,
      createdAt: msg.created_at,
      editedAt: msg.edited_at,
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal server error' });
  }
});

// Editar mensaje
router.patch('/:conversationId/messages/:messageId', async (req: Request, res: Response) => {
  const { conversationId, messageId } = req.params;
  const { content } = req.body as { content: string };

  if (!content || content.trim() === '') {
    res.status(400).json({ error: 'content must be non-empty' });
    return;
  }

  try {
    const result = await pool.query(
      `UPDATE chat.messages
       SET content = $1, edited_at = NOW()
       WHERE id = $2 AND conversation_id = $3 AND sender_id = 1
       RETURNING id, conversation_id, sender_id, content, created_at, edited_at`,
      [content.trim(), messageId, conversationId]
    );

    if (result.rowCount === 0) {
      res.status(403).json({ error: 'not the sender' });
      return;
    }

    const msg = result.rows[0];
    res.json({
      id: msg.id,
      conversationId: msg.conversation_id,
      senderId: msg.sender_id,
      content: msg.content,
      createdAt: msg.created_at,
      editedAt: msg.edited_at,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal server error' });
  }
});

export default router;
