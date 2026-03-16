/**
 * socket/typing.test.ts — tests for typing indicators (M7)
 *
 * Typing events are ephemeral: no DB writes, no persistence.
 * The server just rebroadcasts them to the conversation room excluding the sender.
 *
 * These tests need no DB mocking — the handlers are pure socket logic.
 * We do need to mock pool.on (called at module load time when pool.ts is imported)
 * and the presence-related pool.query calls (getUserConversationIds on connect/disconnect).
 */

jest.mock('../db/pool', () => ({
  __esModule: true,
  default: {
    query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    on: jest.fn(),
  },
}));

jest.mock('../db/helpers', () => ({
  __esModule: true,
  isParticipant: jest.fn(),
}));

import http from 'http';
import { AddressInfo } from 'net';
import { Server as SocketServer } from 'socket.io';
import { io as ioClient } from 'socket.io-client';
import type { Socket as ClientSocket } from 'socket.io-client';
import jwt from 'jsonwebtoken';
import app from '../app';
import { attachSocketIO } from './index';

// ─── Constants ────────────────────────────────────────────────────────────────

const TEST_SECRET = 'test-secret-typing-m7';
const USER_A = 'user-a-typing';
const USER_B = 'user-b-typing';
const CONV_ID = 'conv-typing-1';

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

function waitForConnect(socket: ClientSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    if (socket.connected) return resolve();
    socket.once('connect', resolve);
    socket.once('connect_error', reject);
  });
}

function waitForEvent<T = unknown>(socket: ClientSocket, event: string, timeoutMs = 1000): Promise<T> {
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

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('Socket.IO /chat namespace — M7 typing indicators', () => {
  let httpServer: http.Server;
  let io: SocketServer;
  let serverUrl: string;

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

  let clients: ClientSocket[] = [];

  afterEach(() => {
    for (const c of clients) if (c.connected) c.disconnect();
    clients = [];
  });

  // ─── Setup helper: connect two clients and join the same room ───────────────

  async function setupTwoClients() {
    const clientA = connectClient(serverUrl, USER_A);
    const clientB = connectClient(serverUrl, USER_B);
    clients.push(clientA, clientB);

    await waitForConnect(clientA);
    await waitForConnect(clientB);

    // Join the same conversation room via acknowledgment callback
    await new Promise<void>((resolve) => {
      clientA.emit('joinConversation', { conversationId: CONV_ID }, resolve);
    });
    await new Promise<void>((resolve) => {
      clientB.emit('joinConversation', { conversationId: CONV_ID }, resolve);
    });

    return { clientA, clientB };
  }

  // ─── Test: B receives typingStart when A emits it ──────────────────────────

  it('delivers typingStart from A to B', async () => {
    // isParticipant must return true so both clients can join the room
    const { isParticipant } = jest.requireMock('../db/helpers') as { isParticipant: jest.Mock };
    isParticipant.mockResolvedValue(true);

    const { clientA, clientB } = await setupTwoClients();

    const receivedByB = waitForEvent<{ conversationId: string; userId: string }>(clientB, 'typingStart');

    clientA.emit('typingStart', { conversationId: CONV_ID });

    const event = await receivedByB;
    expect(event.conversationId).toBe(CONV_ID);
    expect(event.userId).toBe(USER_A);
  });

  // ─── Test: sender does NOT receive its own typingStart ────────────────────

  it('does not deliver typingStart back to the sender', async () => {
    const { isParticipant } = jest.requireMock('../db/helpers') as { isParticipant: jest.Mock };
    isParticipant.mockResolvedValue(true);

    const { clientA, clientB } = await setupTwoClients();

    // A emits — B should receive it, A (the sender) should NOT
    let aReceivedOwnEvent = false;
    clientA.on('typingStart', () => { aReceivedOwnEvent = true; });

    // Wait for B to receive the event (confirms the server processed it)
    const receivedByB = waitForEvent(clientB, 'typingStart');

    clientA.emit('typingStart', { conversationId: CONV_ID });

    await receivedByB; // B got it — server processed the event
    await new Promise((r) => setTimeout(r, 100)); // settle window for any stray echo

    expect(aReceivedOwnEvent).toBe(false);
  });

  // ─── Test: B receives typingStop when A emits it ───────────────────────────

  it('delivers typingStop from A to B', async () => {
    const { isParticipant } = jest.requireMock('../db/helpers') as { isParticipant: jest.Mock };
    isParticipant.mockResolvedValue(true);

    const { clientA, clientB } = await setupTwoClients();

    const receivedByB = waitForEvent<{ conversationId: string; userId: string }>(clientB, 'typingStop');

    clientA.emit('typingStop', { conversationId: CONV_ID });

    const event = await receivedByB;
    expect(event.conversationId).toBe(CONV_ID);
    expect(event.userId).toBe(USER_A);
  });

  // ─── Test: typing events are not delivered outside the room ────────────────

  it('does not deliver typingStart to a client outside the conversation room', async () => {
    const { isParticipant } = jest.requireMock('../db/helpers') as { isParticipant: jest.Mock };
    isParticipant.mockResolvedValue(true);

    // clientA joins the room; clientB does NOT
    const clientA = connectClient(serverUrl, USER_A);
    const clientB = connectClient(serverUrl, USER_B);
    clients.push(clientA, clientB);

    await waitForConnect(clientA);
    await waitForConnect(clientB);

    // Only A joins
    await new Promise<void>((resolve) => {
      clientA.emit('joinConversation', { conversationId: CONV_ID }, resolve);
    });

    let bReceived = false;
    clientB.on('typingStart', () => { bReceived = true; });

    clientA.emit('typingStart', { conversationId: CONV_ID });

    await new Promise((r) => setTimeout(r, 200));
    expect(bReceived).toBe(false);
  });
});
