import bcrypt from 'bcryptjs';
import { pool } from '../database/pool.js';
import { signToken } from '../middleware/auth.js';
import { ApiError } from '../utils/ApiError.js';
import type { UserRole } from '../models/types.js';

interface UserRow {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: UserRole;
  active: boolean;
}

/**
 * Registration is intentionally open here (no invite system yet) — per
 * spec §20, auth is kept minimal in V1. The first registered user should
 * be made OWNER by whoever runs this; a future phase can add invites /
 * an admin-only creation flow without touching this shape.
 */
export async function register(name: string, email: string, password: string, role: UserRole) {
  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rowCount) throw new ApiError(409, 'Email already registered');

  const passwordHash = await bcrypt.hash(password, 10);
  const result = await pool.query<UserRow>(
    `INSERT INTO users (name, email, password_hash, role, created_at)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, email, role`,
    [name, email, passwordHash, role, Date.now()]
  );
  const user = result.rows[0];
  const token = signToken({ sub: user.id, role: user.role, email: user.email });
  return { token, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
}

export async function login(email: string, password: string) {
  const result = await pool.query<UserRow>('SELECT * FROM users WHERE email = $1', [email]);
  const row = result.rows[0];
  if (!row || !row.active) throw new ApiError(401, 'Invalid email or password');

  const valid = await bcrypt.compare(password, row.password_hash);
  if (!valid) throw new ApiError(401, 'Invalid email or password');

  const token = signToken({ sub: row.id, role: row.role, email: row.email });
  return { token, user: { id: row.id, name: row.name, email: row.email, role: row.role } };
}
