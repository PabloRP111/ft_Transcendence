import pkg from "pg";

const { Pool } = pkg;

export const pool = new Pool({
  host: process.env.POSTGRES_HOST || "postgres",
  user: process.env.POSTGRES_USER || "transcendence",
  password: process.env.POSTGRES_PASSWORD || "transcendence",
  database: process.env.POSTGRES_DB || "transcendence",
  port: Number(process.env.POSTGRES_PORT) || 5432
});

pool.on("connect", () => {
  console.log("Users connected to PostgreSQL");
});

export default pool;