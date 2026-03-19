import { Router, Request, Response } from 'express';
import pool from '../db/pool';

const router = Router();

// Crear conversación
router.post('/', async (req: Request, res: Response) => {
  const { type, name, participantIds } = req.body as {
    type: string;
    name?: string;
    participantIds?: number[];
  };

  if (type !== 'private' && type !== 'channel') {
    res.status(400).json({ error: 'type must be "private" or "channel"' });
    return;
  }

  const extras = participantIds ?? [];
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const conversationResult = await client.query(
      `INSERT INTO chat.conversations (type, name)
       VALUES ($1, $2)
       RETURNING id, type, name, created_at`,
      [type, name ?? null],
    );
    const conversation = conversationResult.rows[0];

    // Por simplicidad, el creador será id 1
    await client.query(
      `INSERT INTO chat.conversation_participants (conversation_id, user_id, role)
       VALUES ($1, 1, 'admin')`,
      [conversation.id],
    );

    for (const userId of extras) {
      if (userId === 1) continue;
      await client.query(
        `INSERT INTO chat.conversation_participants (conversation_id, user_id, role)
         VALUES ($1, $2, 'member')`,
        [conversation.id, userId],
      );
    }

    await client.query('COMMIT');

    res.status(201).json({
      id: conversation.id,
      type: conversation.type,
      name: conversation.name,
      createdAt: conversation.created_at,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'internal server error' });
  } finally {
    client.release();
  }
});

// Listar conversaciones
router.get('/', async (_, res) => {
  try {
    const result = await pool.query(
      `SELECT c.id, c.type, c.name, c.created_at
       FROM chat.conversations c
       JOIN chat.conversation_participants cp ON c.id = cp.conversation_id
       WHERE cp.user_id = 1
       ORDER BY c.created_at DESC`
    );

    res.json(result.rows.map(r => ({
      id: r.id,
      type: r.type,
      name: r.name,
      createdAt: r.created_at,
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal server error' });
  }
});

export default router;
