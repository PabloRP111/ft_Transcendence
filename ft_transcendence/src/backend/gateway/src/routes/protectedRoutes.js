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

// GET USER BY USERNAME
router.get("/users/by-username/:username", authMiddleware, async (req, res) => {
  try {
    const response = await fetch(`${USERS_SERVICE}/by-username/${encodeURIComponent(req.params.username)}`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok)
      return res.status(response.status).json({ error: data?.error || "User not found" });
    return res.json(data);
  } catch (error) {
    console.error("/users/by-username fetch failed:", error);
    return res.status(503).json({ error: "Service Unavailable" });
  }
});

// GET ANY USER PROFILE: Fetch any user's public data by ID
router.get("/users/:id", authMiddleware, async (req, res) => {
  try {
    const response = await fetch(`${USERS_SERVICE}/${req.params.id}`);
    const data = await response.json().catch(() => ({}));

    if (!response.ok)
      return res.status(response.status).json({ error: data?.error || "User not found" });

    return res.json(data);
  } catch (error) {
    console.error("/users/:id fetch failed:", error);
    return res.status(503).json({ error: "Service Unavailable" });
  }
});

router.get("/users/:id/avatar", authMiddleware, async (req, res) => {
  try {
    const response = await fetch(`${USERS_SERVICE}/${req.params.id}/avatar`);
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return res.status(response.status).send(text || "Avatar not found");
    }

    // Copiar content-type y devolver stream/buffer
    res.setHeader("Content-Type", response.headers.get("content-type") || "application/octet-stream");
    const buffer = await response.arrayBuffer();
    return res.send(Buffer.from(buffer));
  } catch (error) {
    console.error("/users/avatar/:id fetch failed:", error);
    return res.status(503).json({ error: "Service Unavailable" });
  }
});

// UPLOAD AVATAR
router.post("/users/:id/avatar", authMiddleware, async (req, res) => {
  try {
    if (!req.user || String(req.user.id) !== String(req.params.id))
      return res.status(403).json({ error: "Forbidden" });

    const response = await fetch(`${USERS_SERVICE}/${req.params.id}/avatar`, {
      method: "POST",
      headers: {
        "Content-Type": req.headers["content-type"] || "multipart/form-data",
        ...(req.headers["content-length"] ? { "Content-Length": req.headers["content-length"] } : {})
      },
      body: req
    });

    const contentType = response.headers.get("content-type") || "application/json";
    res.setHeader("Content-Type", contentType);
    const buffer = await response.arrayBuffer();
    return res.status(response.status).send(Buffer.from(buffer));
  } catch (error) {
    console.error("/users/:id/avatar upload failed:", error);
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

// Helper: proxy friends endpoints injecting X-User-Id
async function friendsProxy(req, res, path, method = "GET", body = null) {
  try {
    const opts = {
      method,
      headers: { "Content-Type": "application/json", "X-User-Id": String(req.user.id) },
    };
    if (body) opts.body = JSON.stringify(body);
    const response = await fetch(`${USERS_SERVICE}${path}`, opts);
    const data = await response.json().catch(() => ({}));
    return res.status(response.status).json(data);
  } catch (err) {
    console.error(`[gateway] friends proxy error ${path}:`, err);
    return res.status(503).json({ error: "Service Unavailable" });
  }
}

// FRIENDS ENDPOINTS
router.get("/friends",                      authMiddleware, (req, res) => friendsProxy(req, res, "/friends"));
router.get("/friends/pending",              authMiddleware, (req, res) => friendsProxy(req, res, "/friends/pending"));
router.get("/friends/status/:targetId",     authMiddleware, (req, res) => friendsProxy(req, res, `/friends/status/${req.params.targetId}`));
router.post("/friends/request/:targetId",   authMiddleware, (req, res) => friendsProxy(req, res, `/friends/request/${req.params.targetId}`, "POST"));
router.post("/friends/accept/:requesterId", authMiddleware, (req, res) => friendsProxy(req, res, `/friends/accept/${req.params.requesterId}`, "POST"));
router.post("/friends/decline/:requesterId",authMiddleware, (req, res) => friendsProxy(req, res, `/friends/decline/${req.params.requesterId}`, "POST"));
router.delete("/friends/:friendId",         authMiddleware, (req, res) => friendsProxy(req, res, `/friends/${req.params.friendId}`, "DELETE"));

export default router;