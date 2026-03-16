/**
 * routes/messages.ts — REST endpoints for messages within a conversation
 *
 * Endpoints:
 *   POST /conversations/:conversationId/messages  — send a message
 *   GET  /conversations/:conversationId/messages  — fetch message history (paginated)
 *
 * Access control: both endpoints verify the caller is a participant in the
 * conversation before doing anything. Non-participants get 403 Forbidden.
 *
 * Pagination strategy (GET):
 *   We use cursor-based pagination instead of offset pagination.
 *   Why? Offset pagination breaks when new messages arrive between page loads —
 *   rows shift and you see duplicates or skip messages. Cursors don't have this problem.
 *
 *   Cursor = (created_at, id). The client passes:
 *     ?before=<ISO timestamp>&beforeId=<UUID>
 *   to request messages older than that point.
 *
 *   Response is always oldest-first (ascending), so the UI can render naturally.
 *   Default page size: 50 messages.
 */

import { Router, Request, Response } from 'express';
import pool from '../db/pool';
import { isParticipant } from '../db/helpers';
import { getChatNamespace } from '../socket';

const router = Router();

// ─── POST /conversations/:conversationId/messages ─────────────────────────────

/**
 * Send a message to a conversation.
 *
 * Request body: { content: string }
 *
 * Steps:
 *   1. Check the caller is a participant → 403 if not
 *   2. Insert the message into the DB
 *   3. Return the saved message object
 *
 * Note: M6 (Socket.IO) will extend this flow to also emit `newMessage` to
 * the conversation room after the DB write succeeds. For now, REST only.
 */
router.post('/:conversationId/messages', async (req: Request, res: Response): Promise<void> => {
  const { conversationId } = req.params;
  const { content } = req.body as { content: unknown };

  // ── Validation ──────────────────────────────────────────────────────────────
  if (typeof content !== 'string' || content.trim() === '') {
    res.status(400).json({ error: 'content must be a non-empty string' });
    return;
  }

  // ── Access control ──────────────────────────────────────────────────────────
  // Verify the caller belongs to this conversation before inserting.
  const allowed = await isParticipant(conversationId, req.userId);
  if (!allowed) {
    res.status(403).json({ error: 'not a participant in this conversation' });
    return;
  }

  // ── Insert ──────────────────────────────────────────────────────────────────
  try {
    const result = await pool.query<{
      id: string;
      conversation_id: string;
      sender_id: string;
      content: string;
      created_at: string;
      edited_at: string | null;
    }>(
      `INSERT INTO messages (conversation_id, sender_id, content)
       VALUES ($1, $2, $3)
       RETURNING id, conversation_id, sender_id, content, created_at, edited_at`,
      [conversationId, req.userId, content.trim()],
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

// ─── GET /conversations/:conversationId/messages ──────────────────────────────

/**
 * Fetch message history for a conversation, paginated.
 *
 * Query params:
 *   before   (optional) ISO timestamp — return messages older than this
 *   beforeId (optional) UUID          — tiebreaker when timestamps match
 *   limit    (optional) number        — page size, max 100, default 50
 *
 * Both `before` and `beforeId` must be provided together to use the cursor.
 * If neither is provided, the most recent `limit` messages are returned.
 *
 * Response: array of message objects, ordered oldest → newest (ascending).
 */
router.get('/:conversationId/messages', async (req: Request, res: Response): Promise<void> => {
  const { conversationId } = req.params;

  // ── Access control ──────────────────────────────────────────────────────────
  const allowed = await isParticipant(conversationId, req.userId);
  if (!allowed) {
    res.status(403).json({ error: 'not a participant in this conversation' });
    return;
  }

  // ── Parse query params ──────────────────────────────────────────────────────
  const { before, beforeId } = req.query as { before?: string; beforeId?: string };

  // Clamp page size between 1 and 100; default to 50.
  const rawLimit = parseInt(req.query.limit as string, 10);
  const limit = isNaN(rawLimit) ? 50 : Math.min(Math.max(rawLimit, 1), 100);

  // ── Query ───────────────────────────────────────────────────────────────────
  try {
    let rows: Array<{
      id: string;
      conversation_id: string;
      sender_id: string;
      content: string;
      created_at: string;
      edited_at: string | null;
    }>;

    if (before && beforeId) {
      /*
       * Cursor query: fetch messages older than the given (created_at, id) pair.
       *
       * PostgreSQL row comparison: (created_at, id) < ($2, $3)
       * This means: created_at < $2  OR  (created_at = $2 AND id < $3)
       * It works correctly because UUIDs are compared lexicographically,
       * which is a consistent tiebreaker even if not chronological.
       *
       * We query DESC to get the most recent ones before the cursor,
       * then reverse the array so the response is oldest-first.
       */
      const result = await pool.query(
        `SELECT id, conversation_id, sender_id, content, created_at, edited_at
         FROM messages
         WHERE conversation_id = $1
           AND (created_at, id) < ($2::timestamptz, $3::uuid)
         ORDER BY created_at DESC, id DESC
         LIMIT $4`,
        [conversationId, before, beforeId, limit],
      );
      rows = result.rows.reverse(); // reverse to return oldest-first
    } else {
      /*
       * No cursor: return the most recent `limit` messages.
       * Query DESC to get newest first, then reverse for oldest-first response.
       */
      const result = await pool.query(
        `SELECT id, conversation_id, sender_id, content, created_at, edited_at
         FROM messages
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

/**
 * Edit a message.
 *
 * Rules:
 *   - The caller must be a participant in the conversation (403 if not)
 *   - The caller must be the original sender of the message (403 if not)
 *   - Only `content` can be changed; `edited_at` is set automatically by the DB
 *
 * After a successful DB update, we emit `messageEdited` to the conversation room
 * via Socket.IO so all connected clients get the change in real time.
 *
 * Why check isParticipant AND sender ownership separately?
 *   isParticipant confirms the user belongs to the conversation.
 *   Sender ownership confirms they own this specific message.
 *   Both are needed — a participant should not be able to edit other people's messages.
 *
 * Response shape: same as the message object returned by POST and GET.
 */
router.patch(
  '/:conversationId/messages/:messageId',
  async (req: Request, res: Response): Promise<void> => {
    const { conversationId, messageId } = req.params;
    const { content } = req.body as { content: unknown };

    // ── Validation ────────────────────────────────────────────────────────────
    if (typeof content !== 'string' || content.trim() === '') {
      res.status(400).json({ error: 'content must be a non-empty string' });
      return;
    }

    // ── Participant check ─────────────────────────────────────────────────────
    const allowed = await isParticipant(conversationId, req.userId);
    if (!allowed) {
      res.status(403).json({ error: 'not a participant in this conversation' });
      return;
    }

    // ── Update with ownership check ───────────────────────────────────────────
    try {
      /*
       * UPDATE ... WHERE id = $1 AND sender_id = $2
       *
       * By including sender_id = req.userId in the WHERE clause, we enforce
       * ownership in a single query: if the message exists but belongs to someone
       * else, zero rows are updated and we return 403.
       *
       * NOW() sets edited_at to the current timestamp on the DB server,
       * ensuring consistent time regardless of the application server's clock.
       */
      const result = await pool.query<{
        id: string;
        conversation_id: string;
        sender_id: string;
        content: string;
        created_at: string;
        edited_at: string;
      }>(
        `UPDATE messages
         SET content   = $1,
             edited_at = NOW()
         WHERE id          = $2
           AND conversation_id = $3
           AND sender_id   = $4
         RETURNING id, conversation_id, sender_id, content, created_at, edited_at`,
        [content.trim(), messageId, conversationId, req.userId],
      );

      // Zero rows updated means either the message doesn't exist or caller isn't the sender
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

      // ── Emit messageEdited to socket room ─────────────────────────────────
      // All clients currently in the conversation room receive the updated message.
      // getChatNamespace() may return null if Socket.IO isn't attached (e.g. in
      // some test environments) — we skip the emit gracefully in that case.
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
