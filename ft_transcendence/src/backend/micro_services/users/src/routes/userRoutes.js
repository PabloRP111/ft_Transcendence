import express from "express";
import pool from "../db.js";
import bcrypt from "bcrypt";

const router = express.Router();
const SALT_ROUNDS = 10;

// REGISTER
router.post("/register", async (req, res) => {
  const { email, username, password } = req.body;

  if (!email || !username || !password)
    return res.status(400).json({ error: "Missing fields" });

  try {
    const hashed = await bcrypt.hash(password, SALT_ROUNDS);

    const result = await pool.query(
      `INSERT INTO auth.users (email, username, password)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [email, username, hashed]
    );

    res.status(201).json({
      id: result.rows[0].id,
      email,
      username,
      status: 200
    });

  } catch (err) {

    if (err.code === "23505")
      return res.status(409).json({ error: "User exists" });

    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});


// LOGIN
router.post("/login", async (req, res) => {

  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ error: "Missing credentials" });

  try {

    const result = await pool.query(
      `SELECT * FROM auth.users WHERE email = $1`,
      [email]
    );

    const user = result.rows[0];

    if (!user)
      return res.status(401).json({ error: "Invalid credentials" });

    const valid = await bcrypt.compare(password, user.password);

    if (!valid)
      return res.status(401).json({ error: "Invalid credentials" });

    res.json({
      id: user.id,
      email: user.email,
      username: user.username,
      status: 200
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});


// SEARCH USERS by username (partial, case-insensitive)
// Query param: ?q=searchTerm
// Returns: [{ id, username }]
router.get("/search", async (req, res) => {
  const { q } = req.query;

  if (!q || typeof q !== "string" || q.trim() === "") {
    return res.status(400).json({ error: "Missing search query" });
  }

  try {
    const result = await pool.query(
      `SELECT id, username FROM auth.users
       WHERE username ILIKE $1
       ORDER BY username
       LIMIT 20`,
      [`%${q.trim()}%`]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// UPDATE USER
router.put("/:id", async (req, res) => {
  const { username, email, password } = req.body;

  if (!username && !email && !password)
    return res.status(400).json({ error: "Nothing to update" });

  try {
    const fields = [];
    const values = [];
    let i = 1;

    if (username) { fields.push(`username = $${i++}`); values.push(username); }
    if (email)    { fields.push(`email = $${i++}`);    values.push(email); }
    if (password) {
      const hashed = await bcrypt.hash(password, SALT_ROUNDS);
      fields.push(`password = $${i++}`);
      values.push(hashed);
    }

    values.push(req.params.id);

    const result = await pool.query(
      `UPDATE auth.users SET ${fields.join(", ")} WHERE id = $${i}
       RETURNING id, email, username`,
      values
    );

    if (result.rows.length === 0)
      return res.status(404).json({ error: "User not found" });

    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === "23505")
      return res.status(409).json({ error: "Username or email already taken" });
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// GET USER BY USERNAME (exact match)
router.get("/by-username/:username", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, username, wins, matches, score, rank FROM auth.users WHERE username = $1`,
      [req.params.username]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "User not found" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// ── FRIENDS ───────────────────────────────────────────────────────────────────
// All friends routes receive X-User-Id from the gateway (injected after JWT validation)
// req.headers['x-user-id'] is the authenticated user making the request

// GET /users/blocked — list users I have blocked
router.get("/users/blocked", async (req, res) => {
  const userId = parseInt(req.headers["x-user-id"], 10);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const result = await pool.query(
      `SELECT u.id, u.username
       FROM auth.friendships f
       JOIN auth.users u ON f.friend_id = u.id
       WHERE f.user_id = $1 AND f.status = 'blocked'
       ORDER BY u.username`,
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// GET /friends — list accepted friends with their stats
router.get("/friends", async (req, res) => {
  const userId = parseInt(req.headers["x-user-id"], 10);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const result = await pool.query(
      `SELECT u.id, u.username, u.wins, u.matches, u.score, u.rank
       FROM auth.friendships f
       JOIN auth.users u ON (
         CASE WHEN f.user_id = $1 THEN f.friend_id ELSE f.user_id END = u.id
       )
       WHERE (f.user_id = $1 OR f.friend_id = $1)
         AND f.status = 'accepted'`,
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// GET /friends/pending — incoming friend requests (others requested me)
router.get("/friends/pending", async (req, res) => {
  const userId = parseInt(req.headers["x-user-id"], 10);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const result = await pool.query(
      `SELECT u.id, u.username, f.created_at
       FROM auth.friendships f
       JOIN auth.users u ON f.user_id = u.id
       WHERE f.friend_id = $1 AND f.status = 'pending'
       ORDER BY f.created_at DESC`,
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// GET /friends/status/:targetId — relationship status between me and another user
// Returns: none | pending_sent | pending_received | accepted | blocked | blocked_by
router.get("/friends/status/:targetId", async (req, res) => {
  const userId = parseInt(req.headers["x-user-id"], 10);
  const targetId = parseInt(req.params.targetId, 10);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const result = await pool.query(
      `SELECT status, user_id FROM auth.friendships
       WHERE (user_id = $1 AND friend_id = $2)
          OR (user_id = $2 AND friend_id = $1)`,
      [userId, targetId]
    );
    if (result.rows.length === 0) return res.json({ status: "none" });

    const row = result.rows[0];

    if (row.status === "blocked") {
      // Directional: who put the block in place?
      return res.json({ status: row.user_id === userId ? "blocked" : "blocked_by" });
    }

    if (row.status === "pending")
      return res.json({ status: row.user_id === userId ? "pending_sent" : "pending_received" });

    res.json({ status: row.status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// POST /users/block/:targetId — block a user
// Removes any existing friendship/pending request, then inserts a block record.
router.post("/users/block/:targetId", async (req, res) => {
  const userId = parseInt(req.headers["x-user-id"], 10);
  const targetId = parseInt(req.params.targetId, 10);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  if (userId === targetId) return res.status(400).json({ error: "Cannot block yourself" });

  try {
    // Remove any existing relationship in both directions before inserting the block
    await pool.query(
      `DELETE FROM auth.friendships
       WHERE (user_id = $1 AND friend_id = $2)
          OR (user_id = $2 AND friend_id = $1)`,
      [userId, targetId]
    );

    // Insert directional block: userId → targetId
    await pool.query(
      `INSERT INTO auth.friendships (user_id, friend_id, status)
       VALUES ($1, $2, 'blocked')`,
      [userId, targetId]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// DELETE /users/block/:targetId — unblock a user
router.delete("/users/block/:targetId", async (req, res) => {
  const userId = parseInt(req.headers["x-user-id"], 10);
  const targetId = parseInt(req.params.targetId, 10);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    await pool.query(
      `DELETE FROM auth.friendships
       WHERE user_id = $1 AND friend_id = $2 AND status = 'blocked'`,
      [userId, targetId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// POST /friends/request/:targetId — send a friend request
router.post("/friends/request/:targetId", async (req, res) => {
  const userId = parseInt(req.headers["x-user-id"], 10);
  const targetId = parseInt(req.params.targetId, 10);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  if (userId === targetId) return res.status(400).json({ error: "Cannot add yourself" });

  try {
    await pool.query(
      `INSERT INTO auth.friendships (user_id, friend_id, status)
       VALUES ($1, $2, 'pending')
       ON CONFLICT DO NOTHING`,
      [userId, targetId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// POST /friends/accept/:requesterId — accept a pending request
router.post("/friends/accept/:requesterId", async (req, res) => {
  const userId = parseInt(req.headers["x-user-id"], 10);
  const requesterId = parseInt(req.params.requesterId, 10);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const result = await pool.query(
      `UPDATE auth.friendships SET status = 'accepted'
       WHERE user_id = $1 AND friend_id = $2 AND status = 'pending'`,
      [requesterId, userId]
    );
    if (result.rowCount === 0)
      return res.status(404).json({ error: "No pending request found" });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// POST /friends/decline/:requesterId — decline a pending request
router.post("/friends/decline/:requesterId", async (req, res) => {
  const userId = parseInt(req.headers["x-user-id"], 10);
  const requesterId = parseInt(req.params.requesterId, 10);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    await pool.query(
      `DELETE FROM auth.friendships
       WHERE user_id = $1 AND friend_id = $2 AND status = 'pending'`,
      [requesterId, userId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// DELETE /friends/:friendId — remove an accepted friend
router.delete("/friends/:friendId", async (req, res) => {
  const userId = parseInt(req.headers["x-user-id"], 10);
  const friendId = parseInt(req.params.friendId, 10);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    await pool.query(
      `DELETE FROM auth.friendships
       WHERE ((user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1))
         AND status = 'accepted'`,
      [userId, friendId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// GET USER BY ID
router.get("/:id", async (req, res) => {

  try {

    const result = await pool.query(
      `SELECT id, email, username, wins, matches, score, rank FROM auth.users WHERE id = $1`,
      [req.params.id]
    );

    const user = result.rows[0];

    if (!user)
      return res.status(404).json({ error: "User not found" });

    res.json(user);

  } catch (err) {

    console.error(err);
    res.status(500).json({ error: "Database error" });

  }
});

export default router;
