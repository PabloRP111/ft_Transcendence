import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('connect', () => {
  console.log('[db] connected');
});

pool.on('error', (err) => {
  console.error('[db] error:', err);
});

export default pool;
