import jwt from "jsonwebtoken";
import { pool } from "./db.js";

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "IOS is overrated";
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "superrefresh2";

// token corto (login normal)
export function generateAccessToken(userId, sessionId) {
  const expMs = Date.now() + 15 * 60 * 1000; // 15 min

  const token = jwt.sign(
    { id: userId, 
      session_id: sessionId,
      expMs },
    ACCESS_SECRET,
    { expiresIn: "15m" }
  );

  return { token, expMs };
}

// token largo (renovar sesión)
export function generateRefreshToken(userId, username, sessionId) {
  const expMs = Date.now() + 7 * 24 * 60 * 60 * 1000;

  const token = jwt.sign(
    {
      id: userId,
      username,
      session_id: sessionId,
      expMs
    },
    REFRESH_SECRET,
    { expiresIn: "7d" }
  );

  return { token, expMs };
}

// Verificación
export function verifyAccessToken(token) {
  return jwt.verify(token, ACCESS_SECRET);
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, REFRESH_SECRET);
}

// DB helpers
export async function storeSession(userId, session) {
  await pool.query(
    `
    INSERT INTO sessions.sessions
    (user_id, session_id, refresh_expires_at, last_access_expires_at, created_at)
    VALUES ($1,$2,$3,$4,$5)
    ON CONFLICT (user_id)
    DO UPDATE SET
      session_id = EXCLUDED.session_id,
      refresh_expires_at = EXCLUDED.refresh_expires_at,
      last_access_expires_at = EXCLUDED.last_access_expires_at
    `,
    [
      userId,
      session.session_id,
      session.refresh_expires_at,
      session.last_access_expires_at,
      Date.now()
    ]
  );
}

export async function deleteSession(userId) {
  await pool.query(
    "DELETE FROM sessions.sessions WHERE user_id = $1",
    [userId]
  );
}

export async function findSessionByUser(userId) {
  const result = await pool.query(
    "SELECT * FROM sessions.sessions WHERE user_id = $1",
    [userId]
  );

  return result.rows[0];
}
