/**
 * conversations.test.ts — integration tests for POST/GET /conversations
 *
 * These are INTEGRATION tests, not unit tests — they hit a real PostgreSQL database.
 * The DB must be running before you run these (docker compose up -d chat-db).
 *
 * Isolation strategy: we TRUNCATE all tables before each test, so every test
 * starts with a completely empty database. This is simple and fast for a dev DB.
 *
 * We use `supertest` to send HTTP requests to the Express app in memory —
 * no need to actually bind to a port and make network calls.
 */

import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app';
import pool from '../db/pool';

// ─── Test setup ──────────────────────────────────────────────────────────────

const TEST_SECRET = 'test-secret-for-integration';

// Two fake user UUIDs — we'll use these as if they were real authenticated users.
const USER_A = '00000000-0000-0000-0000-000000000001';
const USER_B = '00000000-0000-0000-0000-000000000002';
const USER_C = '00000000-0000-0000-0000-000000000003'; // never participates in anything

/** Creates a signed Bearer token for the given userId. */
function makeToken(userId: string): string {
  return `Bearer ${jwt.sign({ sub: userId }, TEST_SECRET, { expiresIn: '1h' })}`;
}

// Point JWT verification at the test secret for the duration of these tests.
beforeAll(() => {
  process.env.JWT_SECRET = TEST_SECRET;
});

// Wipe all data before each test so tests don't interfere with each other.
beforeEach(async () => {
  // CASCADE handles FK dependencies: clearing conversations also clears
  // conversation_participants and messages automatically.
  await pool.query('TRUNCATE conversations, conversation_participants, messages CASCADE');
});

// Close the DB connection pool when all tests are done.
// Without this, Jest would hang waiting for open handles.
afterAll(async () => {
  await pool.end();
});

// ─── POST /conversations ──────────────────────────────────────────────────────

describe('POST /conversations', () => {
  it('creates a private DM and returns 201 with conversation data', async () => {
    const res = await request(app)
      .post('/conversations')
      .set('Authorization', makeToken(USER_A))
      .send({ type: 'private' });

    expect(res.status).toBe(201);
    expect(res.body.type).toBe('private');
    expect(res.body.id).toBeDefined();
    expect(res.body.createdAt).toBeDefined();
  });

  it('creates a named channel and returns 201', async () => {
    const res = await request(app)
      .post('/conversations')
      .set('Authorization', makeToken(USER_A))
      .send({ type: 'channel', name: 'general' });

    expect(res.status).toBe(201);
    expect(res.body.type).toBe('channel');
    expect(res.body.name).toBe('general');
  });

  it('inserts the creator as an admin participant', async () => {
    const res = await request(app)
      .post('/conversations')
      .set('Authorization', makeToken(USER_A))
      .send({ type: 'channel', name: 'test-room' });

    const { id } = res.body as { id: string };

    // Query the DB directly to verify the participant row.
    const result = await pool.query(
      'SELECT role FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2',
      [id, USER_A],
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].role).toBe('admin');
  });

  it('adds extra participantIds as members', async () => {
    const res = await request(app)
      .post('/conversations')
      .set('Authorization', makeToken(USER_A))
      .send({ type: 'private', participantIds: [USER_B] });

    const { id } = res.body as { id: string };

    const result = await pool.query(
      'SELECT user_id, role FROM conversation_participants WHERE conversation_id = $1 ORDER BY role',
      [id],
    );

    // Should have 2 rows: USER_A (admin) and USER_B (member)
    expect(result.rows).toHaveLength(2);

    const roles = Object.fromEntries(result.rows.map((r: { user_id: string; role: string }) => [r.user_id, r.role]));
    expect(roles[USER_A]).toBe('admin');
    expect(roles[USER_B]).toBe('member');
  });

  it('returns 400 for an invalid type', async () => {
    const res = await request(app)
      .post('/conversations')
      .set('Authorization', makeToken(USER_A))
      .send({ type: 'group-chat' }); // not a valid type

    expect(res.status).toBe(400);
  });

  it('returns 401 with no token', async () => {
    const res = await request(app)
      .post('/conversations')
      .send({ type: 'private' });

    expect(res.status).toBe(401);
  });
});

// ─── GET /conversations ───────────────────────────────────────────────────────

describe('GET /conversations', () => {
  it('returns conversations the user participates in', async () => {
    // USER_A creates a conversation.
    await request(app)
      .post('/conversations')
      .set('Authorization', makeToken(USER_A))
      .send({ type: 'channel', name: 'user-a-room' });

    const res = await request(app)
      .get('/conversations')
      .set('Authorization', makeToken(USER_A));

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('user-a-room');
  });

  it('does NOT return conversations the user is not part of', async () => {
    // USER_A creates a conversation — USER_C is not invited.
    await request(app)
      .post('/conversations')
      .set('Authorization', makeToken(USER_A))
      .send({ type: 'private' });

    // USER_C should see an empty list.
    const res = await request(app)
      .get('/conversations')
      .set('Authorization', makeToken(USER_C));

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it('returns an empty array when the user has no conversations', async () => {
    const res = await request(app)
      .get('/conversations')
      .set('Authorization', makeToken(USER_A));

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns only the conversations relevant to the requesting user', async () => {
    // USER_A creates one. USER_B creates another.
    await request(app)
      .post('/conversations')
      .set('Authorization', makeToken(USER_A))
      .send({ type: 'channel', name: 'a-only' });

    await request(app)
      .post('/conversations')
      .set('Authorization', makeToken(USER_B))
      .send({ type: 'channel', name: 'b-only' });

    // USER_A should only see their own conversation.
    const res = await request(app)
      .get('/conversations')
      .set('Authorization', makeToken(USER_A));

    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('a-only');
  });

  it('returns 401 with no token', async () => {
    const res = await request(app).get('/conversations');
    expect(res.status).toBe(401);
  });
});
