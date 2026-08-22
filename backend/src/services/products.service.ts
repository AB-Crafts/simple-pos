import { randomUUID } from 'node:crypto';
import { db } from '../database/db.js';
import { ApiError } from '../utils/ApiError.js';
import type { Product } from '../models/types.js';

interface ProductRow {
  id: string;
  name: string;
  barcode: string | null;
  category_id: string | null;
  department: Product['department'];
  unit: string | null;
  cost_price: number;
  selling_price: number;
  stock: number;
  active: number;
  created_at: number;
  updated_at: number;
}

function toProduct(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    barcode: row.barcode,
    categoryId: row.category_id,
    department: row.department,
    unit: row.unit,
    costPrice: row.cost_price,
    sellingPrice: row.selling_price,
    stock: row.stock,
    active: Boolean(row.active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listProducts(): Promise<Product[]> {
  const rows = db.prepare('SELECT * FROM products ORDER BY name').all() as ProductRow[];
  return rows.map(toProduct);
}

export async function getProduct(id: string): Promise<Product> {
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as ProductRow | undefined;
  if (!row) throw new ApiError(404, 'Product not found');
  return toProduct(row);
}

export async function getProductByBarcode(barcode: string): Promise<Product | null> {
  const row = db.prepare('SELECT * FROM products WHERE barcode = ? AND active = 1').get(barcode) as ProductRow | undefined;
  return row ? toProduct(row) : null;
}

export async function upsertProduct(input: Partial<Product> & { name: string; sellingPrice: number }): Promise<Product> {
  const now = Date.now();
  const id = input.id || randomUUID();
  const existing = db.prepare('SELECT id FROM products WHERE id = ?').get(id);

  if (existing) {
    db.prepare(`
      UPDATE products SET
        name = ?,
        barcode = ?,
        category_id = ?,
        department = ?,
        unit = ?,
        cost_price = ?,
        selling_price = ?,
        stock = ?,
        active = ?,
        updated_at = ?
      WHERE id = ?
    `).run(
      input.name.trim(),
      input.barcode ?? null,
      input.categoryId ?? null,
      input.department ?? 'GENERAL',
      input.unit ?? null,
      input.costPrice ?? 0,
      input.sellingPrice,
      input.stock ?? 0,
      input.active === false ? 0 : 1,
      now,
      id
    );
  } else {
    db.prepare(`
      INSERT INTO products (id, name, barcode, category_id, department, unit, cost_price, selling_price, stock, active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.name.trim(),
      input.barcode ?? null,
      input.categoryId ?? null,
      input.department ?? 'GENERAL',
      input.unit ?? null,
      input.costPrice ?? 0,
      input.sellingPrice,
      input.stock ?? 0,
      input.active === false ? 0 : 1,
      input.createdAt ?? now,
      now
    );
  }

  return getProduct(id);
}

export async function toggleProductActive(id: string): Promise<Product> {
  const product = await getProduct(id);
  const updatedActive = product.active ? 0 : 1;
  db.prepare('UPDATE products SET active = ?, updated_at = ? WHERE id = ?').run(updatedActive, Date.now(), id);
  return getProduct(id);
}
