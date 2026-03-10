/**
 * routes/conversations.ts — REST endpoints for conversations
 *
 * Endpoints:
 *   POST /conversations  — create a DM or channel
 *   GET  /conversations  — list conversations the caller participates in
 *
 * All handlers run after the `authenticate` middleware, so `req.userId`
 * is guaranteed to be a valid UUID string by the time we get here.
 *
 * Database access uses parameterized queries ($1, $2, ...) — never string
 * interpolation — to prevent SQL injection.
 */

import { Router, Request, Response } from 'express';
import pool from '../db/pool';

const router = Router();

// ─── POST /conversations ──────────────────────────────────────────────────────

/**
 * Create a new conversation (DM or channel).
 *
 * Request body:
 *   {
 *     type:           "private" | "channel"   // required
 *     name?:          string                  // optional; useful for channels
 *     participantIds?: string[]               // optional; other users to add as members
 *   }
 *
 * What this does, step by step:
 *   1. Validate the request body
 *   2. Insert a row into `conversations`
 *   3. Insert the creator as an `admin` participant
 *   4. Insert any additional participants as `member`
 *   All three steps run inside one DB transaction — if any step fails,
 *   the whole thing is rolled back and nothing is persisted.
 *
 * Response: 201 + the created conversation object
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const { type, name, participantIds } = req.body as {
    type: unknown;
    name: unknown;
    participantIds: unknown;
  };

  // ── Validation ──────────────────────────────────────────────────────────────
  if (type !== 'private' && type !== 'channel') {
    res.status(400).json({ error: 'type must be "private" or "channel"' });
    return;
  }

  // name must be a string if provided; ignore null/undefined (it's optional)
  if (name !== undefined && name !== null && typeof name !== 'string') {
    res.status(400).json({ error: 'name must be a string' });
    return;
  }

  // participantIds must be an array of strings if provided
  if (
    participantIds !== undefined &&
    participantIds !== null &&
    (!Array.isArray(participantIds) || !(participantIds as unknown[]).every((id) => typeof id === 'string'))
  ) {
    res.status(400).json({ error: 'participantIds must be an array of strings' });
    return;
  }

  const extraParticipants = (participantIds as string[] | undefined) ?? [];

  // ── DB transaction ───────────────────────────────────────────────────────────
  // We borrow a single client from the pool so we can wrap everything in BEGIN/COMMIT.
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Step 1: insert the conversation row.
    // gen_random_uuid() and NOW() are handled by the DB defaults.
    const conversationResult = await client.query<{
      id: string;
      type: string;
      name: string | null;
      created_at: string;
    }>(
      `INSERT INTO conversations (type, name)
       VALUES ($1, $2)
       RETURNING id, type, name, created_at`,
      [type, name ?? null],
    );

    const conversation = conversationResult.rows[0];

    // Step 2: insert the creator as an admin participant.
    await client.query(
      `INSERT INTO conversation_participants (conversation_id, user_id, role)
       VALUES ($1, $2, 'admin')`,
      [conversation.id, req.userId],
    );

    // Step 3: insert any additional participants as members.
    // We loop and insert one at a time — simple and safe. For large batches
    // a multi-row INSERT would be more efficient, but that's not needed here.
    for (const participantId of extraParticipants) {
      // Skip the creator if they accidentally included themselves.
      if (participantId === req.userId) continue;

      await client.query(
        `INSERT INTO conversation_participants (conversation_id, user_id, role)
         VALUES ($1, $2, 'member')`,
        [conversation.id, participantId],
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

// ─── GET /conversations ───────────────────────────────────────────────────────

/**
 * List all conversations the authenticated user participates in.
 *
 * This query joins `conversations` with `conversation_participants` and filters
 * to only rows where the user_id matches the caller — so users can only ever
 * see conversations they belong to.
 *
 * Response: 200 + array of conversation objects (may be empty)
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    /*
     * JOIN conversations ↔ conversation_participants on conversation_id.
     * Filter: only rows where this user is a participant.
     * Order:  newest conversations first.
     */
    const result = await pool.query<{
      id: string;
      type: string;
      name: string | null;
      created_at: string;
    }>(
      `SELECT c.id, c.type, c.name, c.created_at
       FROM conversations c
       JOIN conversation_participants cp ON c.id = cp.conversation_id
       WHERE cp.user_id = $1
       ORDER BY c.created_at DESC`,
      [req.userId],
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
