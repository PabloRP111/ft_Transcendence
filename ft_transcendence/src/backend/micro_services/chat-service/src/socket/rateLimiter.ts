/**
 * socket/rateLimiter.ts — in-memory token bucket rate limiter
 *
 * What is a token bucket?
 *   Imagine each user/conversation pair owns a bucket that holds tokens.
 *   Sending a message costs one token. Tokens refill at a fixed rate over time.
 *   When the bucket is empty, the next message is rejected until a token refills.
 *
 *   This is more lenient than a hard fixed window (e.g. "0 messages after 10 in
 *   10s, hard reset") because bursting is allowed up to the capacity, but the
 *   long-run average is capped by the refill rate.
 *
 * Parameters (chosen to match the M9 spec: "10 messages / 10s"):
 *   - Capacity: 10 tokens  → max burst is 10 messages
 *   - Refill:   1 token / 1 s → full bucket restored after 10 s of silence
 *
 * Key: "userId:conversationId"
 *   Rate limits are scoped per user per conversation. The same user can freely
 *   message different conversations without interference.
 *
 * Memory:
 *   Buckets accumulate in module memory and are never explicitly evicted.
 *   This is intentional and acceptable for this service's scale — the map is
 *   bounded by (active users × active conversations), and is cleared on restart.
 *   No Redis or external store required (CLAUDE.md: "keep it simple").
 */

/** Max tokens a bucket can hold — also the maximum burst size. */
const BUCKET_CAPACITY = 10;

/**
 * Milliseconds per token refill.
 * 1000 ms / token × 10 capacity = 10 s to fully drain and fully refill.
 */
const REFILL_INTERVAL_MS = 1000;

/** Internal state for one user/conversation bucket. */
interface BucketState {
  tokens: number;     // current available tokens (0 = rate limited)
  lastRefill: number; // epoch ms timestamp of the last refill tick
}

/**
 * ConsumeResult — the two possible outcomes of a consume() call.
 *
 * TypeScript discriminated union: callers can narrow by checking `.allowed`.
 *   if (result.allowed) { ... }
 *   else { console.log(result.retryAfter) } // only present when !allowed
 */
export type ConsumeResult =
  | { allowed: true }
  | { allowed: false; retryAfter: number }; // ms until 1 token becomes available

export class RateLimiter {
  // Map from "userId:conversationId" → current bucket state
  private readonly buckets = new Map<string, BucketState>();

  /**
   * consume — attempt to use one token for the given (userId, conversationId) pair.
   *
   * Algorithm:
   *   1. If no bucket exists for this key, create one with (capacity - 1) tokens
   *      (the first message is always allowed and counts as the first consumption).
   *   2. Calculate how many full 1-second intervals have elapsed since lastRefill.
   *   3. Add that many tokens (capped at BUCKET_CAPACITY).
   *   4. Advance lastRefill by the exact number of consumed intervals (the
   *      fractional remainder is preserved for the next call — no jitter).
   *   5. If tokens > 0: decrement and return { allowed: true }.
   *   6. If empty: return { allowed: false, retryAfter } where retryAfter is
   *      the ms remaining in the current refill interval.
   */
  consume(userId: string, conversationId: string): ConsumeResult {
    const key = `${userId}:${conversationId}`;
    const now = Date.now();

    let bucket = this.buckets.get(key);
    if (!bucket) {
      // First message from this user in this conversation.
      // Initialise with capacity - 1 (the first send already consumed one token).
      this.buckets.set(key, { tokens: BUCKET_CAPACITY - 1, lastRefill: now });
      return { allowed: true };
    }

    // ── Refill step ────────────────────────────────────────────────────────────
    // How many complete 1-second intervals have passed since the last refill tick?
    const elapsed = now - bucket.lastRefill;
    const tokensToAdd = Math.floor(elapsed / REFILL_INTERVAL_MS);

    if (tokensToAdd > 0) {
      // Cap at capacity so the bucket never overfills.
      bucket.tokens = Math.min(BUCKET_CAPACITY, bucket.tokens + tokensToAdd);
      // Advance lastRefill by exactly the consumed intervals.
      // We keep the sub-interval remainder intact so tokens don't drift over time.
      bucket.lastRefill += tokensToAdd * REFILL_INTERVAL_MS;
    }

    // ── Consume step ───────────────────────────────────────────────────────────
    if (bucket.tokens > 0) {
      bucket.tokens--;
      return { allowed: true };
    }

    // Bucket empty — tell the caller when the next token will arrive.
    const msUntilNextToken = REFILL_INTERVAL_MS - (now - bucket.lastRefill);
    return { allowed: false, retryAfter: Math.max(0, msUntilNextToken) };
  }

  /**
   * reset — clears all bucket state.
   * Call this in test beforeEach() to prevent rate limit state from leaking
   * across test cases.
   */
  reset(): void {
    this.buckets.clear();
  }
}

/** Singleton instance used by the socket handler. */
export const rateLimiter = new RateLimiter();
