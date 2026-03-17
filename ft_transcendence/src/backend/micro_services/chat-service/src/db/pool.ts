/**
 * db/pool.ts — PostgreSQL connection pool
 *
 * Instead of opening a new DB connection for every request (slow and wasteful),
 * we create a shared "pool" of connections that Express handlers can borrow and return.
 *
 * `pg.Pool` manages:
 *   - Opening connections on demand (up to `max`)
 *   - Reusing idle connections
 *   - Closing connections that have been idle too long
 *
 * We export a single `pool` instance used across the entire service.
 * The connection string comes from DATABASE_URL in the environment.
 */

import { Pool } from 'pg';

// Pool reads DATABASE_URL automatically if connectionString is set.
// Example: postgresql://chat_user:chat_pass@localhost:5432/chat_db
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Log a message whenever the pool opens a new physical connection to Postgres.
// Helpful for understanding how many connections are active during development.
pool.on('connect', () => {
  console.log('[db] new client connected to PostgreSQL');
});

// Log unexpected errors on idle clients.
// Without this handler, Node would throw an uncaught exception and crash.
pool.on('error', (err) => {
  console.error('[db] unexpected error on idle client:', err);
});

export default pool;
