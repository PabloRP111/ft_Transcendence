/**
 * socket/socket.test.ts — tests for Socket.IO connection & JWT auth (M5)
 *
 * How these tests work:
 *   1. We start a real HTTP server on a random port (port 0 = OS picks one)
 *   2. We attach Socket.IO to it (same as production)
 *   3. We use `socket.io-client` to connect, passing different tokens
 *   4. We assert that valid tokens connect successfully and invalid tokens are rejected
 *
 * Why "port 0"?
 *   It tells the OS to assign an available port automatically.
 *   This avoids port conflicts when Jest runs test files in parallel.
 *
 * No database is needed for these tests — the auth middleware runs entirely
 * in memory (JWT verification) before any DB query is made.
 */

import http from 'http';
import { AddressInfo } from 'net';
import { Server as SocketServer } from 'socket.io';
import { io as ioClient } from 'socket.io-client';
import type { Socket as ClientSocket } from 'socket.io-client';
import jwt from 'jsonwebtoken';
import app from '../app';
import { attachSocketIO } from './index';

// ─── Constants ────────────────────────────────────────────────────────────────

const TEST_SECRET = 'test-secret-socket-m5';
const TEST_USER_ID = 'user-uuid-socket-test';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Signs a JWT with the test secret. */
function makeToken(userId: string, options?: jwt.SignOptions): string {
  return jwt.sign({ sub: userId }, TEST_SECRET, { expiresIn: '1h', ...options });
}

/**
 * connectClient — create a socket.io-client pointed at our test server's /chat namespace.
 *
 * @param token - JWT to pass in the handshake auth object (undefined = no token)
 * @param serverUrl - base URL of the test server
 */
function connectClient(serverUrl: string, token?: string): ClientSocket {
  return ioClient(`${serverUrl}/chat`, {
    // forceNew: true — always open a fresh connection, never reuse a cached one.
    // Important when running many tests quickly, each expecting a clean slate.
    forceNew: true,
    // transports: ['websocket'] — skip the HTTP long-polling fallback.
    // It's faster and more predictable in tests.
    transports: ['websocket'],
    auth: token !== undefined ? { token } : {},
  });
}

/**
 * waitForEvent — returns a Promise that resolves when the named event fires on the socket,
 * or rejects after a timeout.
 *
 * Socket events are asynchronous — we need to wrap them in Promises to use with async/await.
 */
function waitForEvent(socket: ClientSocket, event: string, timeoutMs = 2000): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timed out waiting for event "${event}" after ${timeoutMs}ms`));
    }, timeoutMs);

    socket.once(event, (data: unknown) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

/**
 * waitForConnect — resolves when the socket connects, rejects if it doesn't within timeout.
 */
function waitForConnect(socket: ClientSocket, timeoutMs = 2000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (socket.connected) {
      resolve();
      return;
    }

    const timer = setTimeout(() => {
      reject(new Error(`Timed out waiting for socket to connect after ${timeoutMs}ms`));
    }, timeoutMs);

    socket.once('connect', () => {
      clearTimeout(timer);
      resolve();
    });

    // connect_error fires when the server rejects the handshake
    socket.once('connect_error', (err: Error) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

/**
 * waitForDisconnect — resolves when the socket disconnects.
 * Used to confirm the server rejected and closed an invalid connection.
 */
function waitForDisconnect(socket: ClientSocket, timeoutMs = 2000): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!socket.connected) {
      resolve('already disconnected');
      return;
    }

    const timer = setTimeout(() => {
      reject(new Error(`Timed out waiting for disconnect after ${timeoutMs}ms`));
    }, timeoutMs);

    socket.once('disconnect', (reason: string) => {
      clearTimeout(timer);
      resolve(reason);
    });
  });
}

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('Socket.IO /chat namespace — M5 auth', () => {
  let httpServer: http.Server;
  let io: SocketServer;
  let serverUrl: string;

  // ── Setup: start a fresh server before all tests in this file ────────────────
  beforeAll((done) => {
    // Save and override JWT_SECRET for the duration of this test file
    process.env.JWT_SECRET = TEST_SECRET;

    httpServer = http.createServer(app);
    io = attachSocketIO(httpServer);

    // Port 0 → OS assigns a random available port
    httpServer.listen(0, () => {
      const { port } = httpServer.address() as AddressInfo;
      serverUrl = `http://localhost:${port}`;
      done();
    });
  });

  // ── Teardown: close server after all tests ───────────────────────────────────
  afterAll((done) => {
    // Disconnect all namespaces and close the socket server,
    // then close the HTTP server. We ignore errors in case the server
    // already closed due to a test failure.
    io.close(() => {
      httpServer.close(() => done());
    });
  });

  // Track client sockets created per test so we can clean them up
  let clients: ClientSocket[] = [];

  afterEach(() => {
    // Disconnect and clean up all sockets created during the test
    for (const client of clients) {
      if (client.connected) client.disconnect();
    }
    clients = [];
  });

  // ─── Test: valid token connects successfully ────────────────────────────────

  it('accepts a connection with a valid JWT', async () => {
    const token = makeToken(TEST_USER_ID);
    const client = connectClient(serverUrl, token);
    clients.push(client);

    // Should connect without throwing
    await expect(waitForConnect(client)).resolves.toBeUndefined();
    expect(client.connected).toBe(true);
  });

  // ─── Test: missing token is rejected ──────────────────────────────────────

  it('rejects a connection with no token', async () => {
    // Pass no auth at all
    const client = connectClient(serverUrl, undefined);
    clients.push(client);

    // connect_error should fire with "missing token"
    const err = await waitForConnect(client).catch((e: Error) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toMatch(/missing token/i);
  });

  // ─── Test: empty token string is rejected ─────────────────────────────────

  it('rejects a connection with an empty token string', async () => {
    const client = connectClient(serverUrl, '');
    clients.push(client);

    const err = await waitForConnect(client).catch((e: Error) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toMatch(/missing token/i);
  });

  // ─── Test: expired token is rejected ──────────────────────────────────────

  it('rejects a connection with an expired JWT', async () => {
    // expiresIn: 0 creates a token that expired immediately
    const token = makeToken(TEST_USER_ID, { expiresIn: 0 });
    const client = connectClient(serverUrl, token);
    clients.push(client);

    const err = await waitForConnect(client).catch((e: Error) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toMatch(/token expired/i);
  });

  // ─── Test: token signed with wrong secret is rejected ─────────────────────

  it('rejects a connection with a token signed with the wrong secret', async () => {
    const token = jwt.sign({ sub: TEST_USER_ID }, 'wrong-secret', { expiresIn: '1h' });
    const client = connectClient(serverUrl, token);
    clients.push(client);

    const err = await waitForConnect(client).catch((e: Error) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toMatch(/invalid token/i);
  });

  // ─── Test: tampered token is rejected ─────────────────────────────────────

  it('rejects a connection with a tampered JWT payload', async () => {
    const token = makeToken(TEST_USER_ID);
    const [header, , signature] = token.split('.');
    const tamperedPayload = Buffer.from(JSON.stringify({ sub: 'hacker' })).toString('base64url');
    const tamperedToken = `${header}.${tamperedPayload}.${signature}`;

    const client = connectClient(serverUrl, tamperedToken);
    clients.push(client);

    const err = await waitForConnect(client).catch((e: Error) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toMatch(/invalid token/i);
  });

  // ─── Test: completely malformed string is rejected ─────────────────────────

  it('rejects a connection with a completely malformed token', async () => {
    const client = connectClient(serverUrl, 'this.is.not.a.jwt');
    clients.push(client);

    const err = await waitForConnect(client).catch((e: Error) => e);
    expect(err).toBeInstanceOf(Error);
    // Should be "invalid token" or similar
    expect((err as Error).message).toBeTruthy();
  });

  // ─── Test: socket.id is assigned after connect ────────────────────────────

  it('assigns a socket ID to a valid connection', async () => {
    const token = makeToken(TEST_USER_ID);
    const client = connectClient(serverUrl, token);
    clients.push(client);

    await waitForConnect(client);
    // socket.id is a non-empty string assigned by Socket.IO
    expect(typeof client.id).toBe('string');
    expect((client.id ?? '').length).toBeGreaterThan(0);
  });
});
