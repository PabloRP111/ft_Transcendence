import sqlite3 from "sqlite3";

const db = new sqlite3.Database("/data/gateway.db", err => {
  if (err) console.error(err);
  else console.log("Gateway DB connected");
});

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      token TEXT,
      expires_at INTEGER
    )
  `);
});

export default db;

