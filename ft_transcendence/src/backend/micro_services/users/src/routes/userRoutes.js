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
