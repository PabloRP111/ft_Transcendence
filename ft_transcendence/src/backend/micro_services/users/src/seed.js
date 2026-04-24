import bcrypt from "bcrypt";
import pool from "./db.js";

const users = [
  {
    email: "femoreno@student.42malaga.com",
    username: "femoreno",
    password: process.env.SEED_PASSWORD_FEMORENO,
    avatar: "./assets/credits/femoreno.png",
    wins: 0,
    matches: 777,
    score: 3,
    rank: 5
  },
  {
    email: "prosas-p@student.42malaga.com",
    username: "prosas-p",
    password: process.env.SEED_PASSWORD_PROSAS,
    avatar: "./assets/credits/prosas.png",
    wins: 12,
    matches: 12,
    score: 1200,
    rank: 1
  },
  {
    email: "aamoros-@student.42malaga.com",
    username: "aamoros-",
    password: process.env.SEED_PASSWORD_AAMOROS,
    avatar: "./assets/credits/aamoros.png",
    wins: 7,
    matches: 7,
    score: 700,
    rank: 3
  },
  {
    email: "mzuloaga@student.42malaga.com",
    username: "mzuloaga",
    password: process.env.SEED_PASSWORD_MZULOAGA,
    avatar: "./assets/credits/mzuloaga.png",
    wins: 9,
    matches: 9,
    score: 900,
    rank: 2
  },
  {
    email: "jotrujil@student.42malaga.com",
    username: "jotrujil",
    password: process.env.SEED_PASSWORD_JOTRUJIL,
    avatar: "./assets/credits/jotrujil.png",
    wins: 8,
    matches: 8,
    score: 800,
    rank: 4
  }
];

const missing = users.filter(u => !u.password).map(u => u.username);
if (missing.length > 0) {
  console.error(`Missing seed password env vars for: ${missing.join(", ")}`);
  process.exit(1);
}

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