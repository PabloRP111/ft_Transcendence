import jwt from "jsonwebtoken";
import db from "./db.js";

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "supersecret2";
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "superrefresh2";

// token corto (login normal)
export function generateAccessToken(userId) {
  const expMs = Date.now() + 15 * 60 * 1000; // 15 min

  const token = jwt.sign(
    { id: userId, expMs },
    ACCESS_SECRET,
    { expiresIn: "15m" }
  );

  return { token, expMs };
}

// token largo (renovar sesión)
export function generateRefreshToken(userId, username) {
  const expMs = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 días

  const token = jwt.sign(
    {
      id: userId,
      username,
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
  return new Promise((resolve, reject) => {
    db.run(
      `
      INSERT OR REPLACE INTO sessions
      (user_id, refresh_expires_at, last_access_expires_at, created_at)
      VALUES (?, ?, ?, ?)
      `,
      [
        userId,
        session.refresh_expires_at,
        session.last_access_expires_at,
        Date.now()
      ],
      err => err ? reject(err) : resolve()
    );
  });
}

export async function deleteSession(userId) {
  return new Promise((resolve, reject) => {
    db.run(
      "DELETE FROM sessions WHERE user_id = ?",
      [userId],
      err => err ? reject(err) : resolve()
    );
  });
}

export async function findSessionByUser(userId) {
  return new Promise((resolve, reject) => {
    db.get(
      "SELECT * FROM sessions WHERE user_id = ?",
      [userId],
      (err, row) => err ? reject(err) : resolve(row)
    );
  });
}
