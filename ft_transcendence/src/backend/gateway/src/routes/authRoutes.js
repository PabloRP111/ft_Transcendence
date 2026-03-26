import express from "express";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  storeSession,
  findSessionByUser,
  deleteSession
} from "../jwt.js";
import fetch from "node-fetch";
import { v4 as uuidv4 } from "uuid";

const USERS_SERVICE = process.env.USERS_SERVICE || "http://users:3002";
const CHAT_SERVICE = process.env.CHAT_SERVICE || "http://chat:3003";
const router = express.Router();

// LOGIN
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ error: "Missing credentials" });

  try {
    const response = await fetch(`${USERS_SERVICE}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok)
      return res.status(response.status).json(data);

    const oldSession = await findSessionByUser(data.id);

    // Generar session_id único por login
    const sessionId = uuidv4();

    // generar tokens
    const { token: refreshToken, expMs: refreshExp } = generateRefreshToken(data.id, data.username, sessionId);
    const { token: accessToken, expMs: accessExp } = generateAccessToken(data.id, sessionId);

    // almacenar sesión
    await storeSession(data.id, {
      session_id: sessionId,
      refresh_expires_at: refreshExp,
      last_access_expires_at: accessExp
    });

    
    // Emitir logout al socket anterior si existe
    if (oldSession && oldSession.session_id !== sessionId) {
      const resp = await fetch(`${CHAT_SERVICE}/force-logout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ userId: data.id })
      });

      if (!resp.ok) {
        console.error("force-logout failed", await resp.text());
      }
    }

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    return res.json({
      accessToken,
      username: data.username
    });

  } catch (error) {
    console.error("Communication Error:", error);
    return res.status(503).json({ error: "Service Unavailable" });
  }
});

// REGISTER sigue igual
router.post("/register", async (req, res) => {
  const { email, username, password } = req.body;

  if (!email || !username || !password)
    return res.status(400).json({ error: "Missing fields" });

  try {
    const response = await fetch(`${USERS_SERVICE}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, username, password }),
    });
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      console.error("Users service error:", data);
      return res.status(response.status).json({ error: data?.error || "Users service failed" });
    }

    res.status(201).json({
      id: data.id,
      email: data.email,
      username: data.username,
    });
  } catch (err) {
    console.error("Registration crash:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// REFRESH
router.post("/refresh", async (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken) return res.status(401).json({ error: "Missing tokens" });

  let refreshPayload;
  try {
    refreshPayload = verifyRefreshToken(refreshToken);
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  try {
    const session = await findSessionByUser(refreshPayload.id);
    if (!session)
      return res.status(401).json({ error: "No active session" });

    // verificar que la sesión coincide con la de la base de datos
    if (refreshPayload.session_id !== session.session_id)
      return res.status(401).json({ error: "Session replaced" });

    const { token: newAccess, expMs: newAccessExp } = generateAccessToken(refreshPayload.id, session.session_id);

    // actualizar solo last_access_expires_at
    await storeSession(refreshPayload.id, {
      session_id: session.session_id,
      refresh_expires_at: session.refresh_expires_at,
      last_access_expires_at: newAccessExp
    });

    return res.json({ accessToken: newAccess });
  } catch (err) {
    console.error("Refresh error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// LOGOUT
router.post("/logout", async (req, res) => {
  const refreshToken = req.cookies.refreshToken;

  if (refreshToken) {
    try {
      const decoded = verifyRefreshToken(refreshToken);
      await deleteSession(decoded.id);
    } catch (err) {
      console.error("Logout warning:", err);
    }
  }

  res.clearCookie("refreshToken");
  res.json({ message: "Logged out" });
});

export default router;