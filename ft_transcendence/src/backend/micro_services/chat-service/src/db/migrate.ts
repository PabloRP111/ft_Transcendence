/**
 * db/migrate.ts — SQL migration runner
 *
 * How it works:
 *   1. Reads all `.sql` files from the `migrations/` folder.
 *   2. Sorts them by filename (001_init.sql, 002_something.sql, ...).
 *   3. Runs each file inside a single transaction.
 *      → If any statement fails, the whole migration is rolled back and the
 *        service crashes immediately ("crash fast") rather than starting in
 *        a broken state.
 *
 * Idempotency: every SQL statement uses IF NOT EXISTS, so running the
 * migrations a second time is safe and makes no changes.
 *
 * This function is called once at startup, before the HTTP server starts
 * accepting requests. If the DB is unreachable, the process exits with code 1.
 */

import fs from 'fs';
import path from 'path';
import pool from './pool';

export async function runMigrations(): Promise<void> {
  // Resolve the path to the migrations/ folder relative to the project root.
  // __dirname is the compiled location of this file (dist/db/), so we go up
  // two levels to reach the project root, then into migrations/.
  const migrationsDir = path.resolve(__dirname, '../../migrations');

  // Read all files in the folder, keep only .sql files, sort alphabetically.
  // Sorting ensures migrations always run in the intended order (001 before 002, etc.).
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log('[migrate] no migration files found — skipping');
    return;
  }

  // Borrow a single client from the pool for the entire migration run.
  // Using one client lets us wrap everything in a transaction.
  const client = await pool.connect();

  try {
    // BEGIN wraps all migrations in one atomic transaction.
    // If file 3 fails, files 1 and 2 are also rolled back.
    await client.query('BEGIN');

    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      console.log(`[migrate] running ${file}`);
      await client.query(sql);
    }

    // All files ran without error — commit the transaction.
    await client.query('COMMIT');
    console.log('[migrate] all migrations applied successfully');
  } catch (err) {
    // Something went wrong — roll back so the DB stays clean.
    await client.query('ROLLBACK');
    console.error('[migrate] migration failed, rolled back:', err);

    // Re-throw so the caller (index.ts) can catch it and exit the process.
    throw err;
  } finally {
    // Always return the client to the pool, even if an error was thrown.
    client.release();
  }
}
