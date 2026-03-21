import pkg from "pg";

const { Pool } = pkg;

export const pool = new Pool({
  host: "postgres",
  user: "transcendence",
  password: "transcendence",
  database: "transcendence",
  port: 5432
});

pool.on("connect", () => {
  console.log("Gateway connected to PostgreSQL");
});

export default pool;