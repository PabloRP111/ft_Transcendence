/*
1. Valida el JWT — usando el authMiddleware que ya existe
2. Inyecta X-User-Id — añade el id del usuario autenticado como header
3. Hace proxy — reenvía la petición al chat-service con todos los headers y el body
*/

import express from "express";
import fetch from "node-fetch";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();
const CHAT_SERVICE = process.env.CHAT_SERVICE || "http://chat:3003";

//auth done for all chat routes, validate the JWT
router.use(authMiddleware);

//send all "/chat" requests to chat-service,
// adding x-user-id so chat-service knows who is making the request
router.all("*", async (req, res) => {

  const targetUrl = `${CHAT_SERVICE}${req.url}`;

  try {
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        "Content-Type": "application/json",
        "X-User-Id": String(req.user.id),
      },
      body: ["POST", "PATCH", "PUT"].includes(req.method)
        ? JSON.stringify(req.body)
        : undefined,
    });

    const data = await response.json().catch(() => ({}));
    res.status(response.status).json(data);
  } catch (err) {
    console.error("[gateway] chat proxy error:", err);
    res.status(503).json({ error: "chat service unavailable" });
  }
});

export default router;
