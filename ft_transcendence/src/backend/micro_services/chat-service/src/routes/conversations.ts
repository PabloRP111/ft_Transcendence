import { Router, Request, Response } from 'express';
import pool from '../db/pool';

const router = Router();

// ─── POST /conversations ───────────────────────────────────────────────────────

router.post('/', async (req: Request, res: Response): Promise<void> => {
  const { type, name, participantIds, is_public, description } = req.body as {
    type: unknown;
    name: unknown;
    participantIds: unknown;
    is_public: unknown;
    description: unknown;
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

    let conversation: { id: number; type: string; name: string | null; is_public: boolean; description: string | null; created_at: string } | undefined;

    /* 1. FIND_OR_CREATE_LOGIC: Force normalization to lowercase and trim spaces.
       This ensures 'Arena_General' and 'arena_general' resolve to the same ID.
    */
    const normalizedName = typeof name === 'string' ? name.trim().toLowerCase() : null;

    if (type === 'channel' && normalizedName) {
      const existingConv = await client.query<{
        id: number; type: string; name: string | null; is_public: boolean; description: string | null; created_at: string;
      }>(
        `SELECT id, type, name, is_public, description, created_at FROM chat.conversations
         WHERE LOWER(name) = $1 AND type = 'channel' LIMIT 1`,
        [normalizedName]
      );
      
      if (existingConv.rows.length > 0) {
        conversation = existingConv.rows[0];
      }
    }

    // 2. If no existing conversation was found, create it
    if (!conversation) {
      // is_public defaults to true for channels; always true for private DMs
      const isPublicVal = type === 'channel' ? (is_public === false ? false : true) : true;
      const descriptionVal = typeof description === 'string' ? description.trim() || null : null;

      const conversationResult = await client.query<{
        id: number; type: string; name: string | null; is_public: boolean; description: string | null; created_at: string;
      }>(
        `INSERT INTO chat.conversations (type, name, is_public, description)
         VALUES ($1, $2, $3, $4)
         RETURNING id, type, name, is_public, description, created_at`,
        [type, normalizedName, isPublicVal, descriptionVal],
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
      isPublic: conversation.is_public ?? true,
      description: conversation.description ?? null,
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

// ─── GET /conversations/search ────────────────────────────────────────────────
// Search public channels by name. Does NOT require the user to be a participant.
// Query param: ?q=searchTerm
// Returns channels whose name matches (case-insensitive, partial match).

router.get('/search', async (req: Request, res: Response): Promise<void> => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';

  if (!q) {
    res.status(400).json({ error: 'missing search query' });
    return;
  }

  try {
    const result = await pool.query<{
      id: number;
      type: string;
      name: string | null;
      is_public: boolean;
      description: string | null;
      created_at: string;
    }>(
      `SELECT id, type, name, is_public, description, created_at
       FROM chat.conversations
       WHERE type = 'channel'
         AND is_public = true
         AND name ILIKE $1
       ORDER BY name
       LIMIT 20`,
      [`%${q}%`],
    );

    res.json(
      result.rows.map((row) => ({
        id: row.id,
        type: row.type,
        name: row.name,
        isPublic: row.is_public,
        description: row.description,
        createdAt: row.created_at,
      })),
    );
  } catch (err) {
    console.error('[GET /conversations/search] error:', err);
    res.status(500).json({ error: 'internal server error' });
  }
});

// ─── POST /conversations/:id/participants ──────────────────────────────────────
// Join an existing channel. The requesting user is added as 'member'.
// Only channels are joinable this way — DMs require being invited at creation.

router.post('/:id/participants', async (req: Request, res: Response): Promise<void> => {
  const conversationId = req.params.id;
  const userId = parseInt(req.userId, 10);

  try {
    // Verify the conversation exists and is a channel (not a private DM)
    const convResult = await pool.query<{ type: string }>(
      `SELECT type FROM chat.conversations WHERE id = $1`,
      [conversationId],
    );

    if (convResult.rows.length === 0) {
      res.status(404).json({ error: 'conversation not found' });
      return;
    }

    if (convResult.rows[0].type !== 'channel') {
      res.status(403).json({ error: 'cannot join a private conversation' });
      return;
    }

    // Add the user — ON CONFLICT handles the case where they are already a member
    await pool.query(
      `INSERT INTO chat.conversation_participants (conversation_id, user_id, role)
       VALUES ($1, $2, 'member')
       ON CONFLICT (conversation_id, user_id) DO NOTHING`,
      [conversationId, userId],
    );

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[POST /conversations/:id/participants] error:', err);
    res.status(500).json({ error: 'internal server error' });
  }
});

// ─── GET /conversations ────────────────────────────────────────────────────────

router.get('/', async (req: Request, res: Response): Promise<void> => {
  const userId = parseInt(req.userId, 10);

  try {
    // For private DMs we need to show the other user's name, not "Direct_Link".
    // We do a lateral subquery that fetches the OTHER participants' id+username
    // only for private conversations (channels already have a name field).
    const result = await pool.query<{
      id: number;
      type: string;
      name: string | null;
      created_at: string;
      participants: { id: number; username: string }[] | null;
      last_message_at: string | null;
    }>(
      `SELECT c.id, c.type, c.name, c.created_at,
        CASE WHEN c.type = 'private' THEN (
          SELECT json_agg(json_build_object('id', u.id, 'username', u.username))
          FROM chat.conversation_participants cp2
          JOIN auth.users u ON cp2.user_id = u.id
          WHERE cp2.conversation_id = c.id AND cp2.user_id != $1
        ) ELSE NULL END AS participants,
        (
          SELECT MAX(m.created_at)
          FROM chat.messages m
          WHERE m.conversation_id = c.id
        ) AS last_message_at
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
        participants: row.participants ?? [],
        lastMessageAt: row.last_message_at ?? null,
      })),
    );
  } catch (err) {
    console.error('[GET /conversations] error:', err);
    res.status(500).json({ error: 'internal server error' });
  }
});

export default router;