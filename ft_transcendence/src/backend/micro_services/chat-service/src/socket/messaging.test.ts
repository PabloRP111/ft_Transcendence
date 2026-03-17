/**
 * socket/messaging.test.ts — tests for Socket.IO real-time messaging (M6)
 *
 * How DB mocking works here:
 *   These tests don't need a real database. We intercept every call to
 *   `pool.query` and `isParticipant` with Jest mock functions, returning
 *   whatever the test needs (success, empty rows, or a thrown error).
 *
 *   jest.mock() is hoisted to the top of the file by Jest's transform step,
 *   so the mock is in place before ANY imports run — including the socket module
 *   that calls pool.query internally.
 *
 * Two-client test pattern:
 *   For "A sends → B receives" tests, we open two separate socket connections
 *   to the same server. Socket.IO rooms work at the server level, so both
 *   clients receive events emitted to a room they've joined.
 */

// ─── DB mocks (must be declared BEFORE imports) ───────────────────────────────

/**
 * jest.mock() replaces the real module with a fake for the duration of this test file.
 * The factory function returns the shape the module normally exports.
 *
 * Important: the factory cannot reference variables declared outside it
 * (jest hoists the mock call before variable declarations). We use jest.fn()
 * directly inside the factory instead.
 */
jest.mock('../db/pool', () => ({
  // __esModule: true tells Jest this mock represents an ES module.
  // Without it, `import pool from '../db/pool'` would import the whole object
  // instead of the `default` property, making pool.query undefined.
  __esModule: true,
  default: {
    query: jest.fn(),
    on: jest.fn(), // pool.on('connect', ...) is called at module load time
  },
}));

jest.mock('../db/helpers', () => ({
  __esModule: true,
  isParticipant: jest.fn(),
}));

// ─── Imports ──────────────────────────────────────────────────────────────────

import http from 'http';
import { AddressInfo } from 'net';
import { Server as SocketServer } from 'socket.io';
import { io as ioClient } from 'socket.io-client';
import type { Socket as ClientSocket } from 'socket.io-client';
import jwt from 'jsonwebtoken';
import app from '../app';
import { attachSocketIO } from './index';
import pool from '../db/pool';
import { isParticipant } from '../db/helpers';
// rateLimiter is NOT mocked — pure in-memory, no DB dependency.
// We reset it in beforeEach so rate limit state doesn't bleed between tests.
import { rateLimiter } from './rateLimiter';

// ─── Typed mock helpers ───────────────────────────────────────────────────────

/**
 * Cast a mock function to Jest's Mock type so we can call .mockResolvedValue() etc.
 * This is needed because TypeScript sees the imported functions as their real types.
 */
const mockQuery = pool.query as jest.Mock;
const mockIsParticipant = isParticipant as jest.Mock;

// ─── Constants ────────────────────────────────────────────────────────────────

const TEST_SECRET = 'test-secret-messaging-m6';
const USER_A = 'user-a-uuid';
const USER_B = 'user-b-uuid';
const CONV_ID = 'conversation-uuid-1';

// A fake message row that the DB "returns" after INSERT
const FAKE_MESSAGE_ROW = {
  id: 'message-uuid-1',
  conversation_id: CONV_ID,
  sender_id: USER_A,
  content: 'hello',
  created_at: '2026-01-01T00:00:00.000Z',
  edited_at: null,
};

// The expected `newMessage` payload — camelCase, same as REST
const EXPECTED_NEW_MESSAGE = {
  id: 'message-uuid-1',
  conversationId: CONV_ID,
  senderId: USER_A,
  content: 'hello',
  createdAt: '2026-01-01T00:00:00.000Z',
  editedAt: null,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeToken(userId: string): string {
  return jwt.sign({ sub: userId }, TEST_SECRET, { expiresIn: '1h' });
}

function connectClient(serverUrl: string, userId: string): ClientSocket {
  return ioClient(`${serverUrl}/chat`, {
    forceNew: true,
    transports: ['websocket'],
    auth: { token: makeToken(userId) },
  });
}

/** Wait for a socket to connect. Rejects on connect_error. */
function waitForConnect(socket: ClientSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    if (socket.connected) return resolve();
    socket.once('connect', resolve);
    socket.once('connect_error', reject);
  });
}

/** Wait for a named event on a socket. Rejects on timeout. */
function waitForEvent<T = unknown>(socket: ClientSocket, event: string, timeoutMs = 2000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timeout waiting for "${event}"`)),
      timeoutMs,
    );
    socket.once(event, (data: T) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

/**
 * joinConversation — emit joinConversation and wait for the ACK response.
 * Socket.IO acknowledgment callbacks are the 3rd argument to socket.emit().
 */
function joinConversation(
  socket: ClientSocket,
  conversationId: string,
): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    socket.emit('joinConversation', { conversationId }, resolve);
  });
}

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('Socket.IO /chat namespace — M6 messaging', () => {
  let httpServer: http.Server;
  let io: SocketServer;
  let serverUrl: string;

  // ── Server lifecycle ──────────────────────────────────────────────────────

  beforeAll((done) => {
    process.env.JWT_SECRET = TEST_SECRET;

    httpServer = http.createServer(app);
    io = attachSocketIO(httpServer);

    httpServer.listen(0, () => {
      const { port } = httpServer.address() as AddressInfo;
      serverUrl = `http://localhost:${port}`;
      done();
    });
  });

  afterAll((done) => {
    io.close(() => httpServer.close(() => done()));
  });

  // ── Per-test cleanup ──────────────────────────────────────────────────────

  let clients: ClientSocket[] = [];

  beforeEach(() => {
    // Before each test: reset all mock call counts and return values
    mockQuery.mockReset();
    mockIsParticipant.mockReset();

    // getUserConversationIds is called on connect (for presence tracking).
    // Return empty rows by default — user has no conversations, so no userOnline
    // events are emitted to any rooms. This keeps tests focused.
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });

    // Clear rate limiter state so each test starts with a fresh bucket.
    // Without this, a test that sends 10 messages would leave the bucket drained
    // and cause the next test's first sendMessage to be rate-limited.
    rateLimiter.reset();
  });

  afterEach(() => {
    for (const client of clients) {
      if (client.connected) client.disconnect();
    }
    clients = [];
  });

  // ─── joinConversation: valid participant ────────────────────────────────────

  it('allows a participant to join a conversation room', async () => {
    mockIsParticipant.mockResolvedValue(true); // DB says user IS a participant

    const clientA = connectClient(serverUrl, USER_A);
    clients.push(clientA);
    await waitForConnect(clientA);

    const ack = await joinConversation(clientA, CONV_ID);

    expect(ack.ok).toBe(true);
    expect(ack.error).toBeUndefined();
  });

  // ─── joinConversation: non-participant is rejected ──────────────────────────

  it('rejects a non-participant from joining a conversation room', async () => {
    mockIsParticipant.mockResolvedValue(false); // DB says user is NOT a participant

    const clientA = connectClient(serverUrl, USER_A);
    clients.push(clientA);
    await waitForConnect(clientA);

    const ack = await joinConversation(clientA, CONV_ID);

    expect(ack.ok).toBe(false);
    expect(ack.error).toMatch(/not a participant/i);
  });

  // ─── sendMessage: A sends, both A and B receive newMessage ─────────────────

  it('broadcasts newMessage to all sockets in the room when DB write succeeds', async () => {
    // Both users are participants
    mockIsParticipant.mockResolvedValue(true);

    // DB returns the fake message row on INSERT
    mockQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // getUserConversationIds for A on connect
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // getUserConversationIds for B on connect
      .mockResolvedValueOnce({ rows: [FAKE_MESSAGE_ROW], rowCount: 1 }); // INSERT message

    const clientA = connectClient(serverUrl, USER_A);
    const clientB = connectClient(serverUrl, USER_B);
    clients.push(clientA, clientB);

    await waitForConnect(clientA);
    await waitForConnect(clientB);

    // Both join the same conversation room
    await joinConversation(clientA, CONV_ID);
    await joinConversation(clientB, CONV_ID);

    // Set up listeners BEFORE emitting so we don't miss the event
    const receivedByA = waitForEvent<typeof EXPECTED_NEW_MESSAGE>(clientA, 'newMessage');
    const receivedByB = waitForEvent<typeof EXPECTED_NEW_MESSAGE>(clientB, 'newMessage');

    // A sends the message
    clientA.emit('sendMessage', { conversationId: CONV_ID, content: 'hello' });

    // Both A and B should receive newMessage with the correct payload
    const [msgA, msgB] = await Promise.all([receivedByA, receivedByB]);

    expect(msgA).toEqual(EXPECTED_NEW_MESSAGE);
    expect(msgB).toEqual(EXPECTED_NEW_MESSAGE);
  });

  // ─── sendMessage: DB failure → messageFailed to sender, no broadcast ────────

  it('emits messageFailed to sender only when DB write fails, and does not broadcast', async () => {
    mockIsParticipant.mockResolvedValue(true);

    // INSERT throws a DB error
    mockQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // getUserConversationIds for A on connect
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // getUserConversationIds for B on connect
      .mockRejectedValueOnce(new Error('DB connection lost')); // INSERT fails

    const clientA = connectClient(serverUrl, USER_A);
    const clientB = connectClient(serverUrl, USER_B);
    clients.push(clientA, clientB);

    await waitForConnect(clientA);
    await waitForConnect(clientB);

    await joinConversation(clientA, CONV_ID);
    await joinConversation(clientB, CONV_ID);

    // Set up a spy on B: we want to assert B does NOT get newMessage
    let bReceivedNewMessage = false;
    clientB.on('newMessage', () => {
      bReceivedNewMessage = true;
    });

    // A should receive messageFailed
    const failedPromise = waitForEvent(clientA, 'messageFailed');

    clientA.emit('sendMessage', { conversationId: CONV_ID, content: 'hello' });

    const failed = await failedPromise;
    expect(failed).toMatchObject({ conversationId: CONV_ID });

    // Give a short window for any stray newMessage to arrive before asserting
    await new Promise((r) => setTimeout(r, 100));
    expect(bReceivedNewMessage).toBe(false);
  });

  // ─── leaveConversation: socket no longer receives messages ─────────────────

  it('stops delivering messages to a socket after leaveConversation', async () => {
    mockIsParticipant.mockResolvedValue(true);

    mockQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // connect A
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // connect B
      .mockResolvedValueOnce({ rows: [FAKE_MESSAGE_ROW], rowCount: 1 }); // INSERT

    const clientA = connectClient(serverUrl, USER_A);
    const clientB = connectClient(serverUrl, USER_B);
    clients.push(clientA, clientB);

    await waitForConnect(clientA);
    await waitForConnect(clientB);

    // Both join
    await joinConversation(clientA, CONV_ID);
    await joinConversation(clientB, CONV_ID);

    // B leaves
    clientB.emit('leaveConversation', { conversationId: CONV_ID });

    // Small delay to let the server process the leave before the send
    await new Promise((r) => setTimeout(r, 50));

    let bReceivedNewMessage = false;
    clientB.on('newMessage', () => {
      bReceivedNewMessage = true;
    });

    const receivedByA = waitForEvent(clientA, 'newMessage');

    clientA.emit('sendMessage', { conversationId: CONV_ID, content: 'hello' });

    // A still gets the message
    await receivedByA;

    // Give time for B to potentially (wrongly) receive it
    await new Promise((r) => setTimeout(r, 100));
    expect(bReceivedNewMessage).toBe(false);
  });

  // ─── sendMessage: invalid payload is rejected ─────────────────────────────

  it('emits messageFailed for a missing conversationId in payload', async () => {
    const clientA = connectClient(serverUrl, USER_A);
    clients.push(clientA);
    await waitForConnect(clientA);

    const failed = waitForEvent(clientA, 'messageFailed');

    // Malformed payload — missing conversationId
    clientA.emit('sendMessage', { content: 'hello' });

    await expect(failed).resolves.toBeTruthy();
  });

  // ─── sendMessage: content length validation ───────────────────────────────

  it('emits messageFailed when content exceeds 2000 characters', async () => {
    const clientA = connectClient(serverUrl, USER_A);
    clients.push(clientA);
    await waitForConnect(clientA);

    const failed = waitForEvent(clientA, 'messageFailed');

    // 2001-character content — over the limit
    clientA.emit('sendMessage', {
      conversationId: CONV_ID,
      content: 'a'.repeat(2001),
    });

    const result = await failed;
    // The failure should identify which conversation it was for
    expect(result).toMatchObject({ conversationId: CONV_ID });
  });

  // ─── sendMessage: rate limiting ───────────────────────────────────────────

  /**
   * Send 10 messages sequentially (each awaited so we confirm it succeeded before
   * sending the next). The 11th message should trigger rateLimitExceeded.
   *
   * Why sequential instead of all-at-once?
   *   Sending 10 messages in parallel and awaiting all 10 newMessage events is
   *   unreliable because each waitForEvent() registers a `once` handler — when
   *   the first event arrives, ALL 10 handlers fire and all promises resolve with
   *   the same data, masking individual failures.
   *   Sequential is slower but unambiguous: we confirm each message succeeds
   *   before firing the next.
   */
  it('emits rateLimitExceeded after 10 messages in a burst', async () => {
    mockIsParticipant.mockResolvedValue(true);

    // getUserConversationIds fires once on connect; each sendMessage does one INSERT.
    mockQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // connect: getUserConversationIds
      .mockResolvedValue({ rows: [FAKE_MESSAGE_ROW], rowCount: 1 }); // all INSERTs

    const clientA = connectClient(serverUrl, USER_A);
    clients.push(clientA);
    await waitForConnect(clientA);
    await joinConversation(clientA, CONV_ID);

    // Send 10 messages one by one, confirming each succeeds before the next
    for (let i = 0; i < 10; i++) {
      const received = waitForEvent(clientA, 'newMessage');
      clientA.emit('sendMessage', { conversationId: CONV_ID, content: `message ${i + 1}` });
      await received;
    }

    // 11th message — bucket is empty, should be rate-limited
    const exceeded = waitForEvent(clientA, 'rateLimitExceeded');
    clientA.emit('sendMessage', { conversationId: CONV_ID, content: 'over the limit' });

    const result = await exceeded;
    expect(result).toMatchObject({
      conversationId: CONV_ID,
      retryAfter: expect.any(Number),
    });
  }, 10000); // extend timeout: 10 sequential round-trips need room
});
