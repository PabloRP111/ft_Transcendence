/**
 * index.ts — service entry point
 *
 * Startup order matters:
 *   1. Load environment variables (.env → process.env)
 *   2. Run DB migrations (ensures schema is up to date before any request arrives)
 *   3. Start the HTTP server
 *
 * If the DB is unreachable or a migration fails, the process exits immediately
 * with code 1 rather than starting in a broken state.
 */

import dotenv from 'dotenv';
dotenv.config(); // must run before anything reads process.env

import http from 'http';
import app from './app';
import { runMigrations } from './db/migrate';
import { attachSocketIO } from './socket';

const PORT = process.env.PORT ?? 3003;

async function start(): Promise<void> {
  // Step 1: run all pending migrations.
  // This will throw (and crash the process) if the DB is unreachable.
  await runMigrations();

  // Step 2: create an HTTP server explicitly (instead of app.listen).
  //
  // Why? Socket.IO needs to share the same TCP port as Express.
  // WebSocket connections start as HTTP "upgrade" requests — Socket.IO intercepts
  // them on the same server before they reach Express.
  //
  // Previously:  app.listen(PORT) — Express created the server internally.
  // Now:         http.createServer(app) — we create it, then hand it to both Express and Socket.IO.
  const server = http.createServer(app);

  // Step 3: attach Socket.IO to the HTTP server (namespace /chat).
  // This must happen before server.listen() so Socket.IO is ready when the first
  // socket connection arrives.
  attachSocketIO(server);

  // Step 4: start accepting connections.
  server.listen(PORT, () => {
    console.log(`chat-service listening on port ${PORT}`);
  });

  // Graceful shutdown: when the process receives SIGTERM (e.g. docker stop),
  // stop accepting new connections and wait for in-flight requests to finish.
  process.on('SIGTERM', () => {
    console.log('[server] SIGTERM received — shutting down gracefully');
    server.close(() => {
      console.log('[server] closed');
      process.exit(0);
    });
  });
}

// Top-level async call. If start() throws (e.g. migration failure),
// log the error and exit with a non-zero code so Docker / the OS knows it failed.
start().catch((err) => {
  console.error('[startup] fatal error:', err);
  process.exit(1);
});
