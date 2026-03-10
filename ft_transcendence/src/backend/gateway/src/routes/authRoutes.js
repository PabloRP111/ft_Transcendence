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

const USERS_SERVICE = process.env.USERS_SERVICE || "http://users:3002";

const router = express.Router();

router.post("/register", async (req, res) => {
  const { email, username, password } = req.body;

  // Validación inicial
  if (!email || !username || !password) {
    return res.status(400).json({ error: "Missing fields" });
  }

  try {
    // Llamada directa al microservicio de usuarios
    const response = await fetch(`${USERS_SERVICE}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, username, password }),
    });

    // Intentamos parsear el JSON, si falla devolvemos null
    const data = await response.json().catch(() => null);

    // Manejo de errores de la respuesta del servicio
    if (!response.ok) {
      console.error("Users service error:", data);
      return res.status(response.status).json({ 
        error: data?.error || "Users service failed" 
      });
    }

    // Éxito: Devolvemos los datos filtrados
    res.status(201).json({
      id: data.id,
      email: data.email,
      username: data.username,
    });

  } catch (err) {
    // Errores de red o fallos inesperados
    console.error("Registration crash:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

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

    // generar tokens
    const { token: refreshToken, expMs: refreshExp } = generateRefreshToken(data.id, data.username);
    const { token: accessToken, expMs: accessExp } = generateAccessToken(data.id);

    // sesión global única (reemplaza la anterior)
    await storeSession(data.id, {
      refresh_expires_at: refreshExp,
      last_access_expires_at: accessExp
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    return res.json({ accessToken });

  } catch (error) {
    console.error("Communication Error:", error);
    return res.status(503).json({ error: "Service Unavailable" });
  }
});

router.post("/refresh", async (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken)
    return res.status(401).json({ error: "Missing tokens" });

  let refreshPayload;
  // verificar firma + expiración JWT
  try {
    refreshPayload = verifyRefreshToken(refreshToken);
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  try {
    const session = await findSessionByUser(refreshPayload.id);
    if (!session)
      return res.status(401).json({ error: "No active session" });

    // refresh debe ser el último emitido
    if (refreshPayload.expMs !== session.refresh_expires_at)
      return res.status(401).json({ error: "Session replaced" });

    // generar nuevo access token
    const { token: newAccess, expMs: newAccessExp } =
      generateAccessToken(refreshPayload.id);

    // actualizar solo access expiry
    await storeSession(refreshPayload.id, {
      refresh_expires_at: session.refresh_expires_at,
      last_access_expires_at: newAccessExp
    });

    return res.json({ accessToken: newAccess });
  } catch (err) {
    console.error("Refresh error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/logout", async (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  
  if (refreshToken) {
    try {
      const decoded = verifyRefreshToken(refreshToken);
      await deleteSession(decoded.id);
    } catch (err) {
      // token inválido o ya caducado, da igual: seguimos con logout
      console.error("Logout warning:", err);
    }
  }

  // Limpiamos la cookie en el frontend
  res.clearCookie("refreshToken");
  res.json({ message: "Logged out" });
});

export default router;
