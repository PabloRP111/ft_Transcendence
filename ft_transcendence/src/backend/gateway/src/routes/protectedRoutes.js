import express from "express";
import fetch from "node-fetch";

const router = express.Router();
const USERS_SERVICE = process.env.USERS_SERVICE || "http://users:3002";

router.get("/me", async (req, res) => {
  try {
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

router.put("/me", async (req, res) => {
  try {
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

