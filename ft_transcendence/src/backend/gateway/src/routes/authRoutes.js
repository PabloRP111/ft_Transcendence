import express from "express";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  storeSession,
  findSessionByUser,
  deleteSession,
  hashToken
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
  if (!email || !password) {
    return res.status(400).json({ error: "Missing credentials" });
  }

  try {
    const response = await fetch(`${USERS_SERVICE}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    // 1. Obtener el cuerpo de la respuesta del microservicio
    const data = await response.json().catch(() => ({}));

    // 2. Si la respuesta NO es exitosa (4xx o 5xx)
    if (!response.ok) {
      // Devolvemos el mismo status y el mismo error que nos dio el microservicio
      return res.status(response.status).json(data);
    }
    // 3. Si llegamos aquí, es un 200 OK del microservicio
  
    // Proceso de tokens (esto ocurre en el Gateway)
    const accessToken = generateAccessToken(data);
    const { token: refreshToken, exp } = generateRefreshToken(data);

    await storeSession(data.id, hashToken(refreshToken), exp);

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: true, 
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    return res.json({ accessToken });

  } catch (error) {
    // Este error es de RED (el servicio de usuarios está caído)
    console.error("Communication Error:", error);
    return res.status(503).json({ error: "Service Unavailable" });
  }
});

router.post("/refresh", async (req, res) => {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken)
    return res.status(401).json({ error: "Missing refresh token" });

  let decoded;

  // Verificar JWT
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch {
    return res.status(401).json({ error: "Invalid refresh token" });
  }

  try {
    // Buscar sesión del usuario
    const session = await findSessionByUser(decoded.id);

    if (!session)
      return res.status(401).json({ error: "No active session" });

    // Comparar token almacenado con el recibido
    const hashed = hashToken(refreshToken);

    if (session.refresh_token !== hashed)
      return res.status(401).json({ error: "Session revoked" });

    // Comprobar expiración en DB
    if (session.expires_at < Math.floor(Date.now() / 1000))
    {
      await deleteSession(decoded.id);
      return res.status(401).json({ error: "Refresh token expired" });
    }

    // Generar nuevo access token
    const newAccessToken = generateAccessToken({ id: decoded.id });

    return res.json({ accessToken: newAccessToken });
  } catch (err) {
    console.error("Refresh error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/logout", async (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  
  if (refreshToken)
  {
    try {
      const decoded = verifyRefreshToken(refreshToken);
      await deleteSession(decoded.id);
    } catch {}
  }

  res.clearCookie("refreshToken");
  res.json({ message: "Logged out" });
});

export default router;
