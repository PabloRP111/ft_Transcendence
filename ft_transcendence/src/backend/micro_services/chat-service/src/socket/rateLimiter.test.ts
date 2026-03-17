/**
 * socket/rateLimiter.test.ts — unit tests for the token bucket rate limiter
 *
 * These tests do NOT need a DB, server, or sockets — the RateLimiter class is
 * pure in-memory logic. We test it directly by instantiating it and calling consume().
 *
 * We create a fresh RateLimiter instance (not the singleton) for each test so
 * test cases are fully isolated.
 */

import { RateLimiter } from './rateLimiter';

describe('RateLimiter — token bucket', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    // Fresh instance for each test — no shared state between cases.
    limiter = new RateLimiter();
  });

  // ─── Basic allowance ───────────────────────────────────────────────────────

  it('allows the first message for a new user/conversation pair', () => {
    const result = limiter.consume('user1', 'conv1');
    expect(result.allowed).toBe(true);
  });

  it('allows up to 10 messages in a burst', () => {
    for (let i = 0; i < 10; i++) {
      expect(limiter.consume('user1', 'conv1').allowed).toBe(true);
    }
  });

  // ─── Rate limit enforcement ────────────────────────────────────────────────

  it('rejects the 11th message in a burst', () => {
    for (let i = 0; i < 10; i++) {
      limiter.consume('user1', 'conv1');
    }
    const result = limiter.consume('user1', 'conv1');
    expect(result.allowed).toBe(false);
  });

  it('includes retryAfter (ms) in the rejection result', () => {
    for (let i = 0; i < 10; i++) limiter.consume('user1', 'conv1');

    const result = limiter.consume('user1', 'conv1');

    // TypeScript discriminated union — need to narrow before accessing retryAfter
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(typeof result.retryAfter).toBe('number');
      // retryAfter must be between 0 and the refill interval (1000ms)
      expect(result.retryAfter).toBeGreaterThanOrEqual(0);
      expect(result.retryAfter).toBeLessThanOrEqual(1000);
    }
  });

  // ─── Isolation between keys ────────────────────────────────────────────────

  it('rate limits are independent across different users in the same conversation', () => {
    // Drain user1's bucket
    for (let i = 0; i < 10; i++) limiter.consume('user1', 'conv1');
    expect(limiter.consume('user1', 'conv1').allowed).toBe(false);

    // user2 has a separate bucket — not affected
    expect(limiter.consume('user2', 'conv1').allowed).toBe(true);
  });

  it('rate limits are independent across different conversations for the same user', () => {
    // Drain user1's bucket for conv1
    for (let i = 0; i < 10; i++) limiter.consume('user1', 'conv1');
    expect(limiter.consume('user1', 'conv1').allowed).toBe(false);

    // Same user, different conversation — separate bucket, not affected
    expect(limiter.consume('user1', 'conv2').allowed).toBe(true);
  });

  // ─── Token refill ──────────────────────────────────────────────────────────

  it('allows a message again after 1 token has refilled (1 second)', async () => {
    // Drain the bucket completely
    for (let i = 0; i < 10; i++) limiter.consume('user1', 'conv1');
    expect(limiter.consume('user1', 'conv1').allowed).toBe(false);

    // Wait a bit longer than 1 refill interval (1 second per token)
    await new Promise((r) => setTimeout(r, 1100));

    // One token should have refilled
    expect(limiter.consume('user1', 'conv1').allowed).toBe(true);
  }, 5000); // extend Jest timeout for this test

  // ─── reset() ──────────────────────────────────────────────────────────────

  it('reset() clears all bucket state so messages are allowed again', () => {
    // Drain the bucket
    for (let i = 0; i < 10; i++) limiter.consume('user1', 'conv1');
    expect(limiter.consume('user1', 'conv1').allowed).toBe(false);

    // Reset — bucket is gone, next consume starts fresh
    limiter.reset();

    expect(limiter.consume('user1', 'conv1').allowed).toBe(true);
  });
});
