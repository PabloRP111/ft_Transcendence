import sqlite3 from "sqlite3";

const db = new sqlite3.Database("/data/gateway.db", err => {
  if (err) console.error(err);
  else console.log("Gateway DB connected");
});

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      user_id INTEGER PRIMARY KEY,
      refresh_expires_at INTEGER NOT NULL,
      last_access_expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);
});

export default db;

