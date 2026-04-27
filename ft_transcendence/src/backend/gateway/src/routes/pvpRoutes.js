import express from "express";
import fetch from "node-fetch";

const router = express.Router();

const PVP_SERVICE = process.env.GAME_SERVICE || "http://game:2077/api/pvp";

async function proxyRequest(req, res, targetPath) {
  try {
    const response = await fetch(`${PVP_SERVICE}${targetPath}`, {
      method: req.method,
      headers: {
        "Content-Type": "application/json",
        "x-user-id": req.user.id
      },
      body: req.body && Object.keys(req.body).length > 0
        ? JSON.stringify(req.body)
        : undefined,
    });

    const payload = await response.json().catch(() => ({
      error: "Game service response error"
    }));

    if (!response.ok) {
      return res.status(response.status).json(payload);
    }

    return res.json(payload);
  } catch (error) {
    console.error("PvP proxy error:", error);
    return res.status(503).json({ error: "Game service unavailable" });
  }
}

// CREATE
router.post("/create", (req, res) => {
  return proxyRequest(req, res, "/create");
});

// JOIN
router.post("/join", (req, res) => {
  return proxyRequest(req, res, "/join");
});

// GET STATE
router.get("/:matchId", (req, res) => {
  return proxyRequest(req, res, `/${req.params.matchId}`);
});

// MATCHMAKING
router.post("/matchmaking", (req, res) => {
  return proxyRequest(req, res, "/matchmaking");
});

// CANCEL MATCHMAKING
router.delete("/matchmaking", (req, res) => {
  return proxyRequest(req, res, "/matchmaking");
});

export default router;
