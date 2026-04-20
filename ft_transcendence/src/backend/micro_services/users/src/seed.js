import bcrypt from "bcrypt";
import pool from "./db.js";

const users = [
  {
    email: "femoreno@student.42malaga.com",
    username: "femoreno",
    password: "femoreno@admin",
    avatar: "./assets/credits/femoreno.png",
    wins: 777,
    matches: 777,
    score: 77700,
    rank: 1
  },
  {
    email: "prosas-p@student.42malaga.com",
    username: "prosas-p",
    password: "prosas@admin",
    avatar: "./assets/credits/prosas.png",
    wins: 0,
    matches: 777,
    score: 0,
    rank: 5
  },
  {
    email: "aamoros-@student.42malaga.com",
    username: "aamoros-",
    password: "aamoros@admin",
    avatar: "./assets/credits/aamoros.png",
    wins: 7,
    matches: 10,
    score: 700,
    rank: 3
  },
  {
    email: "mzuloaga@student.42malaga.com",
    username: "mzuloaga",
    password: "mzuloaga@admin",
    avatar: "./assets/credits/mzuloaga.png",
    wins: 9,
    matches: 10,
    score: 900,
    rank: 2
  },
  {
    email: "jotrujil@student.42malaga.com",
    username: "jotrujil",
    password: "jotrujil@admin",
    avatar: "./assets/credits/jotrujil.png",
    wins: 8,
    matches: 10,
    score: 800,
    rank: 4
  }
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