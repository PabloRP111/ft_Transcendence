import jwt from "jsonwebtoken";
import db from "./db.js";
import crypto from "crypto";

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "supersecret2";
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "superrefresh2";

export function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// token corto (login normal)
export function generateAccessToken(user) {
  return jwt.sign(
    { id: user.id },
    ACCESS_SECRET,
    { expiresIn: "15m" }
  );
}

// token largo (renovar sesión)
export function generateRefreshToken(user) {
  const token = jwt.sign(
    { id: user.id },
    REFRESH_SECRET,
    { expiresIn: "7d" }
  );

  const { exp } = jwt.verify(token, REFRESH_SECRET);

  return { token, exp };
}

// Verificación
export function verifyAccessToken(token) {
  return jwt.verify(token, ACCESS_SECRET);
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, REFRESH_SECRET);
}

// DB helpers
export async function storeSession(userId, token, expiresAt) {
  return new Promise((resolve, reject) => {
    db.run(
      `
      INSERT OR REPLACE INTO sessions
      (user_id, refresh_token, expires_at, created_at)
      VALUES (?, ?, ?, ?)
      `,
      [userId, token, expiresAt, Math.floor(Date.now() / 1000)],
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
