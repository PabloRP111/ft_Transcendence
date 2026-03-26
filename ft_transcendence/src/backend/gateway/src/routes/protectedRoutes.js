import express from "express";
import fetch from "node-fetch";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();
const USERS_SERVICE = process.env.USERS_SERVICE || "http://users:3002";

// SEARCH: Proxies request to users-service to find users by username
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

// GET PROFILE: Fetch the authenticated user's data
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

// UPDATE PROFILE: Update the authenticated user's information
router.put("/me", authMiddleware, async (req, res) => {
  try {
    if (!req.user)
      return res.status(401).json({ error: "Unauthorized" });

    const response = await fetch(`${USERS_SERVICE}/${req.user.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(req.body)
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error || "Failed to update user profile"
      });
    }

    return res.json(data);
  } catch (error) {
    console.error("/me profile update failed:", error);
    return res.status(503).json({ error: "Service Unavailable" });
  }
});

export default router;