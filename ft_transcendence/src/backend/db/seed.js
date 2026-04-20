import bcrypt from "bcrypt";
import pool from "../micro_services/users/src/db.js";

const users = [
  {
    email: "femoreno@student.42malaga.com",
    username: "femoreno",
    password: "femoreno@admin",
    avatar: "./assets/credits/femoreno.png",
    wins: 10,
    matches: 10,
    score: 1000,
    rank: 2
  },
  // ...
];

async function seed() {
  for (const u of users) {
    const hashed = await bcrypt.hash(u.password, 10);

    await pool.query(
      `INSERT INTO auth.users (email, username, password, avatar, wins, matches, score, rank)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (email) DO NOTHING`,
      [u.email, u.username, hashed, u.avatar, u.wins, u.matches, u.score, u.rank]
    );
  }

  console.log("Seed completed");
  process.exit();
}

seed();