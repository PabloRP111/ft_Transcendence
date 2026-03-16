/**
 * middleware/auth.ts — JWT authentication middleware
 *
 * Express middleware runs between receiving a request and your route handler.
 * This middleware intercepts every request, checks for a valid JWT, and either:
 *   - Attaches req.userId and calls next() → the route handler runs
 *   - Sends 401 Unauthorized → the route handler never runs
 *
 * Flow:
 *   Client sends:  Authorization: Bearer eyJhbGci...
 *   Middleware:    1. Extract token from header
 *                 2. Verify signature using JWT_SECRET
 *                 3. Check token hasn't expired (jsonwebtoken does this automatically)
 *                 4. Attach userId to req, pass control to next handler
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

/**
 * TypeScript doesn't know that we're adding `userId` to the Express Request object.
 * This "declaration merging" extends Express's built-in Request type so that
 * `req.userId` is recognised as a string throughout the entire codebase.
 */
declare global {
  namespace Express {
    interface Request {
      userId: string;
    }
  }
}

/**
 * The shape we expect inside a valid JWT payload.
 * `sub` is the standard JWT field for the subject (i.e. the user's ID).
 * Other fields may exist (iat, exp, etc.) — we ignore them.
 */
interface JwtPayload {
  sub: string;
}

/**
 * authenticate — Express middleware function
 *
 * Signature: (req, res, next) => void
 *   - req:  the incoming HTTP request
 *   - res:  the outgoing HTTP response (used here only to send 401s)
 *   - next: call this to hand off to the next middleware or route handler
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  // Step 1: Read the Authorization header.
  // Expected format: "Bearer eyJhbGci..."
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // No token provided — reject immediately.
    res.status(401).json({ error: 'missing token' });
    return; // return prevents calling next() after sending a response
  }

  // Step 2: Extract the token string (everything after "Bearer ").
  const token = authHeader.slice(7); // "Bearer ".length === 7

  // Step 3: Read JWT_SECRET from environment.
  // This secret must match the one used by whatever service issued the token.
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    // Misconfiguration — the service shouldn't start without a secret,
    // but we guard here defensively.
    console.error('[auth] JWT_SECRET is not set');
    res.status(500).json({ error: 'server misconfiguration' });
    return;
  }

  try {
    // Step 4: Verify the token.
    // jwt.verify() will throw if:
    //   - The signature doesn't match (tampered token)
    //   - The token has expired (exp claim is in the past)
    //   - The token is malformed
    const payload = jwt.verify(token, secret) as unknown;

    // Step 5: Narrow the type and extract userId.
    // We use `unknown` + a type guard to avoid unsafe `any` casts.
    if (!isJwtPayload(payload)) {
      res.status(401).json({ error: 'invalid token payload' });
      return;
    }

    // Step 6: Attach userId to the request object.
    // Every route handler that runs after this middleware can read req.userId.
    req.userId = payload.sub;

    // Step 7: Pass control to the next middleware or route handler.
    next();
  } catch (err) {
    // jwt.verify() threw — token is invalid or expired.
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: 'token expired' });
    } else {
      res.status(401).json({ error: 'invalid token' });
    }
  }
}

/**
 * Type guard: checks at runtime that payload has the shape we expect.
 * Returns true (and narrows the type to JwtPayload) if `sub` is a non-empty string.
 */
function isJwtPayload(payload: unknown): payload is JwtPayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'sub' in payload &&
    typeof (payload as Record<string, unknown>).sub === 'string' &&
    (payload as Record<string, unknown>).sub !== ''
  );
}
