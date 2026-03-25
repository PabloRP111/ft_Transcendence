import express from "express";
import fetch from "node-fetch";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();
const USERS_SERVICE = process.env.USERS_SERVICE || "http://users:3002";

// Search users by username — proxies to users-service GET /search?q=
router.get("/users/search", async (req, res) => {
  try {
    const q = req.query.q || "";
    const response = await fetch(`${USERS_SERVICE}/search?q=${encodeURIComponent(q)}`);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    return res.json(data);
  } catch (error) {
    console.error("/users/search fetch failed:", error);
    return res.status(503).json({ error: "Service Unavailable" });
  }
});

router.get("/me", authMiddleware, async (req, res) => {
  try {
    if (!req.user)
    return res.status(401).json({ error: "Unauthorized" });

    const response = await fetch(`${USERS_SERVICE}/${req.user.id}`);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error || "Failed to load user profile"
      });
    }

    return res.json(data);
  } catch (error) {
    console.error("/me profile fetch failed:", error);
    return res.status(503).json({ error: "Service Unavailable" });
  }
});

export default router;