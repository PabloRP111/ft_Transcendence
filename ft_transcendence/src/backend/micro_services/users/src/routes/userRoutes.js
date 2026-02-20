import express from "express";
import db from "../db.js";
import { hashPassword, verifyPassword } from "../utils/hash.js";

const router = express.Router();

// REGISTER
router.post("/register", async (req, res) => {
  const { email, username, password } = req.body;

  if (!email || !username || !password)
    return res.status(400).json({ error: "Missing fields" });

  try {
    // hash password
    const hashed = await hashPassword(password);

    db.run(
      "INSERT INTO users (email, username, password) VALUES (?, ?, ?)",
      [email, username, hashed],
      function (err) {
        if (err) {
          if (err.message.includes("UNIQUE"))
            return res.status(409).json({ error: "User exists" });

          return res.status(500).json({ error: "Database error" });
        }

        res.status(201).json({
          id: this.lastID,
          email,
          username,
        });
      }
    );

  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});


// LOGIN
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ error: "Missing credentials" });

  db.get(
    "SELECT * FROM users WHERE email = ?",
    [email],
    async (err, user) => {
      if (err)
        return res.status(500).json({ error: "Database error" });

      if (!user)
        return res.status(401).json({ error: "Invalid credentials" });

      const valid = await verifyPassword(password, user.password);

      if (!valid)
        return res.status(401).json({ error: "Invalid credentials" });

      res.json({
        id: user.id,
        email: user.email,
        username: user.username,
      });
    }
  );
});


// GET USER BY ID
router.get("/:id", (req, res) => {
  db.get(
    "SELECT id, email, username FROM users WHERE id = ?",
    [req.params.id],
    (err, user) => {
      if (err)
        return res.status(500).json({ error: "Database error" });

      if (!user)
        return res.status(404).json({ error: "User not found" });

      res.json(user);
    }
  );
});

export default router;
