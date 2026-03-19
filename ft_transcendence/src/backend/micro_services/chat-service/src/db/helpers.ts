import pool from './pool';

// Returns true if `userId` is a participant in `conversationId`.
export async function isParticipant(conversationId: string, userId: number): Promise<boolean> {
  const result = await pool.query(
    `SELECT 1
     FROM chat.conversation_participants
     WHERE conversation_id = $1 AND user_id = $2
     LIMIT 1`,
    [conversationId, userId],
  );

  return (result.rowCount ?? 0) > 0;
}
