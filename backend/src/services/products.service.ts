import { pool } from '../database/pool.js';
import { ApiError } from '../utils/ApiError.js';
import type { Product } from '../models/types.js';

interface ProductRow {
  id: string;
  name: string;
  barcode: string | null;
  category_id: string | null;
  cost_price: string;
  selling_price: string;
  stock: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

function toProduct(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    barcode: row.barcode,
    categoryId: row.category_id,
    costPrice: Number(row.cost_price),
    sellingPrice: Number(row.selling_price),
    stock: row.stock,
    active: row.active,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

export async function listProducts(): Promise<Product[]> {
  const result = await pool.query<ProductRow>('SELECT * FROM products ORDER BY name');
  return result.rows.map(toProduct);
}

export async function getProduct(id: string): Promise<Product> {
  const result = await pool.query<ProductRow>('SELECT * FROM products WHERE id = $1', [id]);
  if (!result.rowCount) throw new ApiError(404, 'Product not found');
  return toProduct(result.rows[0]);
}

/** Upserts a product — used both by direct POST /api/products and by the
 * sync queue, so a product created offline and later edited online never
 * conflicts on id. */
export async function upsertProduct(input: Product): Promise<Product> {
  const result = await pool.query<ProductRow>(
    `INSERT INTO products (id, name, barcode, category_id, cost_price, selling_price, stock, active, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name,
       barcode = EXCLUDED.barcode,
       category_id = EXCLUDED.category_id,
       cost_price = EXCLUDED.cost_price,
       selling_price = EXCLUDED.selling_price,
       stock = EXCLUDED.stock,
       active = EXCLUDED.active,
       updated_at = EXCLUDED.updated_at
     RETURNING *`,
    [
      input.id,
      input.name,
      input.barcode ?? null,
      input.categoryId,
      input.costPrice,
      input.sellingPrice,
      input.stock,
      input.active,
      input.createdAt,
      input.updatedAt,
    ]
  );
  return toProduct(result.rows[0]);
}
