/**
 * auth.test.ts — unit tests for the JWT authentication middleware
 *
 * These tests don't need a database or a running server.
 * We use `supertest` to send HTTP requests directly to the Express app in memory.
 *
 * We register a dummy protected route GET /protected that just echoes back the
 * userId — this lets us confirm the middleware correctly extracted it from the token.
 */

import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { authenticate } from './auth';

// A fixed secret used only in tests — isolated from whatever is in .env.
const TEST_SECRET = 'test-secret-do-not-use-in-production';

// A fixed userId we embed in test tokens.
const TEST_USER_ID = 'user-uuid-1234';

/**
 * Build a minimal Express app with the auth middleware and one protected route.
 * We build a fresh app per test file (not per test) — it's stateless so that's fine.
 */
function buildApp() {
  const app = express();
  app.use(express.json());

  // Public route — no auth.
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  // Auth middleware applied to everything below.
  app.use(authenticate);

  // Protected route — only reachable with a valid token.
  // Echoes req.userId so we can assert the middleware set it correctly.
  app.get('/protected', (req, res) => res.json({ userId: req.userId }));

  return app;
}

// Set JWT_SECRET before each test and clean up after.
// process.env changes are global, so we restore the original value after each test.
let originalSecret: string | undefined;

beforeEach(() => {
  originalSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = TEST_SECRET;
});

afterEach(() => {
  process.env.JWT_SECRET = originalSecret;
});

// ─── Helper ──────────────────────────────────────────────────────────────────

/** Creates a signed JWT with the given userId and optional overrides. */
function makeToken(userId: string, options?: jwt.SignOptions): string {
  return jwt.sign({ sub: userId }, TEST_SECRET, { expiresIn: '1h', ...options });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('authenticate middleware', () => {
  const app = buildApp();

  it('allows /health without a token', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('accepts a valid token and attaches userId to req', async () => {
    const token = makeToken(TEST_USER_ID);

    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.userId).toBe(TEST_USER_ID);
  });

  it('returns 401 when Authorization header is missing', async () => {
    const res = await request(app).get('/protected');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('missing token');
  });

  it('returns 401 when the header has no "Bearer " prefix', async () => {
    const token = makeToken(TEST_USER_ID);

    const res = await request(app)
      .get('/protected')
      .set('Authorization', token); // missing "Bearer "

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('missing token');
  });

  it('returns 401 for an expired token', async () => {
    // expiresIn: 0 creates a token that is already expired.
    const token = makeToken(TEST_USER_ID, { expiresIn: 0 });

    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('token expired');
  });

  it('returns 401 for a token signed with the wrong secret', async () => {
    const token = jwt.sign({ sub: TEST_USER_ID }, 'wrong-secret', { expiresIn: '1h' });

    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('invalid token');
  });

  it('returns 401 for a tampered token (modified payload)', async () => {
    const token = makeToken(TEST_USER_ID);

    // Split the JWT into its 3 parts: header.payload.signature
    const [header, , signature] = token.split('.');

    // Replace the payload with a different base64-encoded object.
    // The signature no longer matches, so verification should fail.
    const tamperedPayload = Buffer.from(JSON.stringify({ sub: 'hacker' })).toString('base64url');
    const tamperedToken = `${header}.${tamperedPayload}.${signature}`;

    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${tamperedToken}`);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('invalid token');
  });

  it('returns 401 for a completely malformed token string', async () => {
    const res = await request(app)
      .get('/protected')
      .set('Authorization', 'Bearer this.is.not.a.jwt');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('invalid token');
  });
});
