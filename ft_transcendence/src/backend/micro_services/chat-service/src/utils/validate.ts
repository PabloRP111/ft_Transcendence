/**
 * utils/validate.ts: pure validation helpers for user input
 *
 * Pattern: each validator returns null on success or an error string on failure.
 * The caller decides what to do with the error (400 response, messageFailed event, etc.).
*/

/** Maximum number of characters allowed in a message body. */
export const MAX_CONTENT_LENGTH = 2000;

/**
 * validateContent — validates a message content value.
 * Valid content must be:
 *   - a string (not a number, array, or object)
 *   - non-empty after trimming whitespace
 *   - no longer than MAX_CONTENT_LENGTH characters
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
