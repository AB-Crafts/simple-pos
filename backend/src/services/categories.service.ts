import { randomUUID } from 'node:crypto';
import { db } from '../database/db.js';
import type { Category } from '../models/types.js';

interface CategoryRow {
  id: string;
  name: string;
  created_at: number;
}

function toCategory(row: CategoryRow): Category {
  return { id: row.id, name: row.name, createdAt: row.created_at };
}

export async function listCategories(): Promise<Category[]> {
  const rows = db.prepare('SELECT * FROM categories ORDER BY name').all() as CategoryRow[];
  return rows.map(toCategory);
}

export async function createCategory(input: { id?: string; name: string; createdAt?: number }): Promise<Category> {
  const id = input.id || randomUUID();
  const now = input.createdAt || Date.now();

  const existing = db.prepare('SELECT id FROM categories WHERE id = ?').get(id);
  if (existing) {
    db.prepare('UPDATE categories SET name = ? WHERE id = ?').run(input.name.trim(), id);
  } else {
    db.prepare('INSERT INTO categories (id, name, created_at) VALUES (?, ?, ?)').run(id, input.name.trim(), now);
  }

  const row = db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as CategoryRow;
  return toCategory(row);
}
