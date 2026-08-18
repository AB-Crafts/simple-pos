import { pool } from '../database/pool.js';
import type { Category } from '../models/types.js';

interface CategoryRow {
  id: string;
  name: string;
  created_at: string;
}

function toCategory(row: CategoryRow): Category {
  return { id: row.id, name: row.name, createdAt: Number(row.created_at) };
}

export async function listCategories(): Promise<Category[]> {
  const result = await pool.query<CategoryRow>('SELECT * FROM categories ORDER BY name');
  return result.rows.map(toCategory);
}

export async function createCategory(input: { id: string; name: string; createdAt: number }): Promise<Category> {
  const result = await pool.query<CategoryRow>(
    `INSERT INTO categories (id, name, created_at) VALUES ($1, $2, $3)
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
     RETURNING *`,
    [input.id, input.name, input.createdAt]
  );
  return toCategory(result.rows[0]);
}
