/**
 * test-setup.ts — runs once before any test file is loaded
 *
 * Jest runs in its own process and doesn't inherit the shell environment
 * the same way `npm run dev` does. This file ensures that `.env` is loaded
 * so DATABASE_URL and JWT_SECRET are available to integration tests.
 */
import dotenv from 'dotenv';
import path from 'path';

// Load .env from the project root (one level above src/).
dotenv.config({ path: path.resolve(__dirname, '../.env') });
