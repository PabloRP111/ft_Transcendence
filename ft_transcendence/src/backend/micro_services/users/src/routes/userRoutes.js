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
      `INSERT INTO users (email, username, password)
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
      `SELECT * FROM users WHERE email = $1`,
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


// GET USER
router.get("/:id", async (req, res) => {

  try {

    const result = await pool.query(
      `SELECT id, email, username FROM users WHERE id = $1`,
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
