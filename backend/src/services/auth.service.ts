import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { db } from '../database/db.js';
import { signToken } from '../middleware/auth.js';
import { ApiError } from '../utils/ApiError.js';
import type { UserRole } from '../models/types.js';

interface UserRow {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: UserRole;
  active: number;
}

export async function register(name: string, email: string, password: string, role: UserRole) {
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) throw new ApiError(409, 'Email already registered');

  const passwordHash = await bcrypt.hash(password, 10);
  const id = randomUUID();
  const now = Date.now();

  db.prepare(`
    INSERT INTO users (id, name, email, password_hash, role, active, created_at)
    VALUES (?, ?, ?, ?, ?, 1, ?)
  `).run(id, name.trim(), email.trim().toLowerCase(), passwordHash, role, now);

  const token = signToken({ sub: id, role, email });
  return { token, user: { id, name, email, role } };
}

export async function login(email: string, password: string) {
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase()) as UserRow | undefined;
  if (!row || !row.active) throw new ApiError(401, 'Invalid email or password');

  const valid = await bcrypt.compare(password, row.password_hash);
  if (!valid) throw new ApiError(401, 'Invalid email or password');

  const token = signToken({ sub: row.id, role: row.role, email: row.email });
  return { token, user: { id: row.id, name: row.name, email: row.email, role: row.role } };
}
