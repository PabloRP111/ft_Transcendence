import { Router, Request, Response } from 'express';
import pool from '../db/pool';

const router = Router();

// ─── POST /conversations ───────────────────────────────────────────────────────

router.post('/', async (req: Request, res: Response): Promise<void> => {
  const { type, name, participantIds } = req.body as {
    type: unknown;
    name: unknown;
    participantIds: unknown;
  };

  if (type !== 'private' && type !== 'channel') {
    res.status(400).json({ error: 'type must be "private" or "channel"' });
    return;
  }

  if (name !== undefined && name !== null && typeof name !== 'string') {
    res.status(400).json({ error: 'name must be a string' });
    return;
  }

  if (typeof name === 'string' && name.length > 100) {
    res.status(400).json({ error: 'name must not exceed 100 characters' });
    return;
  }

  if (
    participantIds !== undefined &&
    participantIds !== null &&
    (!Array.isArray(participantIds) || !(participantIds as unknown[]).every((id) => typeof id === 'string'))
  ) {
    res.status(400).json({ error: 'participantIds must be an array of strings' });
    return;
  }

  const extraParticipants = (participantIds as string[] | undefined) ?? [];
  const creatorId = parseInt(req.userId, 10);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    let conversation;

    /* 1. FIND_OR_CREATE_LOGIC: Force normalization to lowercase and trim spaces.
       This ensures 'Arena_General' and 'arena_general' resolve to the same ID.
    */
    const normalizedName = typeof name === 'string' ? name.trim().toLowerCase() : null;

    if (type === 'channel' && normalizedName) {
      const existingConv = await client.query<{
        id: number; type: string; name: string | null; created_at: string;
      }>(
        `SELECT id, type, name, created_at FROM chat.conversations 
         WHERE LOWER(name) = $1 AND type = 'channel' LIMIT 1`,
        [normalizedName]
      );
      
      if (existingConv.rows.length > 0) {
        conversation = existingConv.rows[0];
      }
    }

    // 2. If no existing conversation was found, create it using the normalized name
    if (!conversation) {
      const conversationResult = await client.query<{
        id: number; type: string; name: string | null; created_at: string;
      }>(
        `INSERT INTO chat.conversations (type, name)
         VALUES ($1, $2)
         RETURNING id, type, name, created_at`,
        [type, normalizedName],
      );
      conversation = conversationResult.rows[0];
    }

    /* 3. PARTICIPANT_SYNC: Add the user as a participant.
       By moving this OUTSIDE of the "if (!conversation)" block, we ensure 
       that users who didn't create the room (User B) are still added to it.
       'ON CONFLICT' prevents errors if the user is already a member.
    */
    await client.query(
      `INSERT INTO chat.conversation_participants (conversation_id, user_id, role)
       VALUES ($1, $2, 'admin')
       ON CONFLICT (conversation_id, user_id) DO NOTHING`,
      [conversation.id, creatorId],
    );

    // Add any additional participants requested
    for (const participantId of extraParticipants) {
      const pid = parseInt(participantId, 10);
      if (pid === creatorId) continue;

      await client.query(
        `INSERT INTO chat.conversation_participants (conversation_id, user_id, role)
         VALUES ($1, $2, 'member')
         ON CONFLICT (conversation_id, user_id) DO NOTHING`,
        [conversation.id, pid],
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
    console.error('[POST /conversations] error:', err);
    res.status(500).json({ error: 'internal server error' });
  } finally {
    client.release();
  }
});

// ─── GET /conversations ────────────────────────────────────────────────────────

router.get('/', async (req: Request, res: Response): Promise<void> => {
  const userId = parseInt(req.userId, 10);

  try {
    const result = await pool.query<{
      id: number;
      type: string;
      name: string | null;
      created_at: string;
    }>(
      `SELECT c.id, c.type, c.name, c.created_at
       FROM chat.conversations c
       JOIN chat.conversation_participants cp ON c.id = cp.conversation_id
       WHERE cp.user_id = $1
       ORDER BY c.created_at DESC`,
      [userId],
    );

    res.json(
      result.rows.map((row) => ({
        id: row.id,
        type: row.type,
        name: row.name,
        createdAt: row.created_at,
      })),
    );
  } catch (err) {
    console.error('[GET /conversations] error:', err);
    res.status(500).json({ error: 'internal server error' });
  }
});

export default router;