import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { pool } from './pool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function migrate() {
  const sql = readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
  console.log('Applying schema.sql ...');
  await pool.query(sql);
  console.log('Done. Tables are ready.');
  await pool.end();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
