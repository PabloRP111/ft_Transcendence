import sqlite3 from "sqlite3";

const db = new sqlite3.Database("/data/users.db", err => {
  if (err) console.error(err);
  else console.log("Users DB connected");
});

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE,
      username TEXT,
      password TEXT
    )
  `);
});

export default db;

