import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  // Fail loudly at boot rather than silently trying to connect to a
  // default local Postgres — credentials must always come from env.
  throw new Error(
    'DATABASE_URL is not set. Copy backend/.env.example to backend/.env and fill it in.'
  );
}

export const pool = new Pool({ connectionString });

pool.on('error', (err) => {
  // Idle client errors (e.g. connection dropped) shouldn't crash the
  // whole process — log and let the pool recover the connection.
  console.error('Unexpected Postgres pool error:', err);
});
