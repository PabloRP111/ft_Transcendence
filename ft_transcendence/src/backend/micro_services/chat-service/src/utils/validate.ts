/**
 * utils/validate.ts — pure validation helpers for user-supplied input
 *
 * Why pure functions instead of a library like Zod?
 *   The payloads in this service are simple (2–5 fields each). Hand-written
 *   guards are easier to read, have zero dependencies, and add nothing to
 *   install time or bundle size.
 *
 * Pattern: each validator returns null on success or an error string on failure.
 * The caller decides what to do with the error (400 response, messageFailed event, etc.).
 */

/** Maximum number of characters allowed in a message body. */
export const MAX_CONTENT_LENGTH = 2000;

/**
 * validateContent — validates a message content value.
 *
 * Returns a human-readable error string if invalid, or null if valid.
 *
 * Valid content must be:
 *   - a string (not a number, array, or object)
 *   - non-empty after trimming whitespace
 *   - no longer than MAX_CONTENT_LENGTH characters
 *
 * Note: the length check uses raw `.length`, not trimmed length.
 * A 2001-char string of spaces is still rejected — it's oversized payload
 * regardless of what it contains after trimming.
 */
export function validateContent(content: unknown): string | null {
  if (typeof content !== 'string') {
    return 'content must be a string';
  }
  if (content.trim() === '') {
    return 'content must be a non-empty string';
  }
  if (content.length > MAX_CONTENT_LENGTH) {
    return `content must not exceed ${MAX_CONTENT_LENGTH} characters`;
  }
  return null;
}
