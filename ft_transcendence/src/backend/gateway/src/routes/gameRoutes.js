import express from "express";
import fetch from "node-fetch";

const router = express.Router();
const GAME_SERVICE = process.env.GAME_SERVICE || "http://game:2077/api/game";

async function proxyRequest(req, res, targetPath) {
  try {
    const response = await fetch(`${GAME_SERVICE}${targetPath}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: req.body && Object.keys(req.body).length > 0 ? JSON.stringify(req.body) : undefined,
    });

    const payload = await response.json().catch(() => ({ error: "Game service response error" }));

    if (!response.ok) {
      return res.status(response.status).json(payload);
    }

    return res.json(payload);
  } catch (error) {
    console.error("Game route proxy error:", error);
    return res.status(503).json({ error: "Game service unavailable" });
  }
}

router.post("/create", async (req, res) => {
  return proxyRequest(req, res, "/create");
});

router.post("/:matchId/move", async (req, res) => {
  return proxyRequest(req, res, `/${req.params.matchId}/move`);
});

router.post("/:matchId/reset-round", async (req, res) => {
  return proxyRequest(req, res, `/${req.params.matchId}/reset-round`);
});

export default router;
