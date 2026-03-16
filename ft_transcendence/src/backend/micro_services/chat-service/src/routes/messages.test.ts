/**
 * messages.test.ts — integration tests for POST/GET /conversations/:id/messages
 *
 * Requires the chat-db Docker container to be running.
 *
 * Each test starts with a fresh DB (TRUNCATE in beforeEach).
 * We create a conversation via the API in beforeEach so tests have
 * something to send messages to.
 */

import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app';
import pool from '../db/pool';

const TEST_SECRET = 'test-secret-for-integration';

const USER_A = '00000000-0000-0000-0000-000000000001'; // participant
const USER_B = '00000000-0000-0000-0000-000000000002'; // participant
const USER_C = '00000000-0000-0000-0000-000000000003'; // outsider — never invited

function makeToken(userId: string): string {
  return `Bearer ${jwt.sign({ sub: userId }, TEST_SECRET, { expiresIn: '1h' })}`;
}

beforeAll(() => {
  process.env.JWT_SECRET = TEST_SECRET;
});

beforeEach(async () => {
  await pool.query('TRUNCATE conversations, conversation_participants, messages CASCADE');
});

afterAll(async () => {
  await pool.end();
});

// ─── Helper ──────────────────────────────────────────────────────────────────

/** Creates a conversation with USER_A as admin and USER_B as member. Returns the conversation id. */
async function createConversation(): Promise<string> {
  const res = await request(app)
    .post('/conversations')
    .set('Authorization', makeToken(USER_A))
    .send({ type: 'private', participantIds: [USER_B] });

  return (res.body as { id: string }).id;
}

/** Sends a message from USER_A to a conversation. */
async function sendMessage(conversationId: string, content: string, userId = USER_A): Promise<void> {
  await request(app)
    .post(`/conversations/${conversationId}/messages`)
    .set('Authorization', makeToken(userId))
    .send({ content });
}

// ─── POST /conversations/:id/messages ────────────────────────────────────────

describe('POST /conversations/:conversationId/messages', () => {
  it('sends a message and returns 201 with the saved message object', async () => {
    const convId = await createConversation();

    const res = await request(app)
      .post(`/conversations/${convId}/messages`)
      .set('Authorization', makeToken(USER_A))
      .send({ content: 'hello world' });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.conversationId).toBe(convId);
    expect(res.body.senderId).toBe(USER_A);
    expect(res.body.content).toBe('hello world');
    expect(res.body.createdAt).toBeDefined();
    expect(res.body.editedAt).toBeNull(); // not edited yet
  });

  it('persists the message to the DB (offline delivery path)', async () => {
    const convId = await createConversation();

    const res = await request(app)
      .post(`/conversations/${convId}/messages`)
      .set('Authorization', makeToken(USER_A))
      .send({ content: 'persisted message' });

    const { id } = res.body as { id: string };

    // Query DB directly — no socket involved.
    const result = await pool.query('SELECT content FROM messages WHERE id = $1', [id]);
    expect(result.rows[0].content).toBe('persisted message');
  });

  it('returns 403 when a non-participant tries to send', async () => {
    const convId = await createConversation();

    const res = await request(app)
      .post(`/conversations/${convId}/messages`)
      .set('Authorization', makeToken(USER_C)) // USER_C was never invited
      .send({ content: 'sneaky message' });

    expect(res.status).toBe(403);
  });

  it('returns 400 for an empty content string', async () => {
    const convId = await createConversation();

    const res = await request(app)
      .post(`/conversations/${convId}/messages`)
      .set('Authorization', makeToken(USER_A))
      .send({ content: '   ' }); // whitespace only

    expect(res.status).toBe(400);
  });

  it('returns 400 when content is missing', async () => {
    const convId = await createConversation();

    const res = await request(app)
      .post(`/conversations/${convId}/messages`)
      .set('Authorization', makeToken(USER_A))
      .send({});

    expect(res.status).toBe(400);
  });

  it('returns 401 with no token', async () => {
    const convId = await createConversation();

    const res = await request(app)
      .post(`/conversations/${convId}/messages`)
      .send({ content: 'no auth' });

    expect(res.status).toBe(401);
  });
});

// ─── GET /conversations/:id/messages ─────────────────────────────────────────

describe('GET /conversations/:conversationId/messages', () => {
  it('returns an empty array for a conversation with no messages', async () => {
    const convId = await createConversation();

    const res = await request(app)
      .get(`/conversations/${convId}/messages`)
      .set('Authorization', makeToken(USER_A));

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns messages in ascending order (oldest first)', async () => {
    const convId = await createConversation();

    await sendMessage(convId, 'first');
    await sendMessage(convId, 'second');
    await sendMessage(convId, 'third');

    const res = await request(app)
      .get(`/conversations/${convId}/messages`)
      .set('Authorization', makeToken(USER_A));

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
    expect(res.body[0].content).toBe('first');
    expect(res.body[1].content).toBe('second');
    expect(res.body[2].content).toBe('third');
  });

  it('returns 403 for a non-participant', async () => {
    const convId = await createConversation();

    const res = await request(app)
      .get(`/conversations/${convId}/messages`)
      .set('Authorization', makeToken(USER_C));

    expect(res.status).toBe(403);
  });

  it('paginates across a page boundary using cursor', async () => {
    const convId = await createConversation();

    // Insert 5 messages with a small delay to ensure distinct created_at values.
    // We use direct DB inserts to avoid timing issues with the API.
    for (let i = 1; i <= 5; i++) {
      await pool.query(
        `INSERT INTO messages (conversation_id, sender_id, content, created_at)
         VALUES ($1, $2, $3, NOW() + ($4 || ' milliseconds')::interval)`,
        [convId, USER_A, `message-${i}`, i * 10],
      );
    }

    // Page 1: fetch latest 3 messages.
    const page1 = await request(app)
      .get(`/conversations/${convId}/messages?limit=3`)
      .set('Authorization', makeToken(USER_A));

    expect(page1.body).toHaveLength(3);
    // Oldest-first: messages 3, 4, 5
    expect(page1.body[0].content).toBe('message-3');
    expect(page1.body[2].content).toBe('message-5');

    // Page 2: use the cursor from the first item of page 1 to get older messages.
    const cursor = page1.body[0] as { createdAt: string; id: string };
    const page2 = await request(app)
      .get(`/conversations/${convId}/messages?limit=3&before=${encodeURIComponent(cursor.createdAt)}&beforeId=${cursor.id}`)
      .set('Authorization', makeToken(USER_A));

    expect(page2.body).toHaveLength(2); // messages 1 and 2
    expect(page2.body[0].content).toBe('message-1');
    expect(page2.body[1].content).toBe('message-2');
  });

  it('returns 401 with no token', async () => {
    const convId = await createConversation();

    const res = await request(app).get(`/conversations/${convId}/messages`);

    expect(res.status).toBe(401);
  });
});

// ─── PATCH /conversations/:id/messages/:messageId ─────────────────────────────

describe('PATCH /conversations/:conversationId/messages/:messageId', () => {
  /** Sends a message and returns its full body. */
  async function postMessage(
    convId: string,
    content: string,
    userId = USER_A,
  ): Promise<{ id: string; content: string; editedAt: string | null }> {
    const res = await request(app)
      .post(`/conversations/${convId}/messages`)
      .set('Authorization', makeToken(userId))
      .send({ content });

    return res.body as { id: string; content: string; editedAt: string | null };
  }

  it('returns 200 and the updated message when the owner edits it', async () => {
    const convId = await createConversation();
    const msg = await postMessage(convId, 'original content');

    const res = await request(app)
      .patch(`/conversations/${convId}/messages/${msg.id}`)
      .set('Authorization', makeToken(USER_A))
      .send({ content: 'edited content' });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(msg.id);
    expect(res.body.content).toBe('edited content');
    // editedAt must now be set — was null before the edit
    expect(res.body.editedAt).not.toBeNull();
  });

  it('sets edited_at in the DB after a successful edit', async () => {
    const convId = await createConversation();
    const msg = await postMessage(convId, 'will be edited');

    await request(app)
      .patch(`/conversations/${convId}/messages/${msg.id}`)
      .set('Authorization', makeToken(USER_A))
      .send({ content: 'now edited' });

    // Query the DB directly to confirm edited_at was persisted
    const result = await pool.query(
      'SELECT content, edited_at FROM messages WHERE id = $1',
      [msg.id],
    );
    expect(result.rows[0].content).toBe('now edited');
    expect(result.rows[0].edited_at).not.toBeNull();
  });

  it('returns 403 when a non-owner participant tries to edit', async () => {
    const convId = await createConversation();
    // USER_A sends the message
    const msg = await postMessage(convId, 'user A message');

    // USER_B is a participant but did not send this message
    const res = await request(app)
      .patch(`/conversations/${convId}/messages/${msg.id}`)
      .set('Authorization', makeToken(USER_B))
      .send({ content: 'user B trying to edit' });

    expect(res.status).toBe(403);
  });

  it('returns 403 when a non-participant tries to edit', async () => {
    const convId = await createConversation();
    const msg = await postMessage(convId, 'some message');

    // USER_C was never added to this conversation
    const res = await request(app)
      .patch(`/conversations/${convId}/messages/${msg.id}`)
      .set('Authorization', makeToken(USER_C))
      .send({ content: 'outsider edit attempt' });

    expect(res.status).toBe(403);
  });

  it('returns 400 for an empty content string', async () => {
    const convId = await createConversation();
    const msg = await postMessage(convId, 'original');

    const res = await request(app)
      .patch(`/conversations/${convId}/messages/${msg.id}`)
      .set('Authorization', makeToken(USER_A))
      .send({ content: '   ' });

    expect(res.status).toBe(400);
  });

  it('returns 401 with no token', async () => {
    const convId = await createConversation();
    const msg = await postMessage(convId, 'original');

    const res = await request(app)
      .patch(`/conversations/${convId}/messages/${msg.id}`)
      .send({ content: 'no auth edit' });

    expect(res.status).toBe(401);
  });
});
