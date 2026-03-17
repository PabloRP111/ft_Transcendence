/**
 * db/helpers.ts — reusable DB query helpers
 *
 * These are small, focused functions that multiple route files share.
 * Keeping them here avoids duplicating the same SQL in several places.
 */

import pool from './pool';

/**
 * Returns true if `userId` is a participant in `conversationId`.
 *
 * Used before every message read/write to enforce access control —
 * a user must be in a conversation to read or send messages there.
 */
export async function isParticipant(conversationId: string, userId: string): Promise<boolean> {
  const result = await pool.query(
    `SELECT 1
     FROM conversation_participants
     WHERE conversation_id = $1 AND user_id = $2
     LIMIT 1`,
    [conversationId, userId],
  );

  return result.rowCount !== null && result.rowCount > 0;
}
