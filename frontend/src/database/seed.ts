import { db } from './db';
import { generateId } from '../utils/id';
import { toPaisa } from '../utils/money';

/**
 * Seeds a handful of sample categories/products on first run only,
 * so a new install of the app has a usable POS screen immediately
 * instead of opening to an empty grid. Safe to call every app start —
 * it's a no-op once products already exist.
 */
export async function seedIfEmpty(): Promise<void> {
  const now = Date.now();

  // Seed default waiters if none exist
  const waiterCount = await db.waiters.count();
  if (waiterCount === 0) {
    await db.waiters.bulkAdd([
      { id: generateId(), name: 'Buraid', active: true, createdAt: now },
      { id: generateId(), name: 'Ali', active: true, createdAt: now },
      { id: generateId(), name: 'Hamza', active: true, createdAt: now },
      { id: generateId(), name: 'Usman', active: true, createdAt: now },
    ]);
  }

  const existing = await db.products.count();
  if (existing > 0) return;

  const chaiCatId = generateId();
  const parhataCatId = generateId();
  const drinksCatId = generateId();
  const snacksCatId = generateId();

  const categories = [
    { id: chaiCatId, name: 'Chai', createdAt: now },
    { id: parhataCatId, name: 'Parhata', createdAt: now },
    { id: drinksCatId, name: 'Cold Drinks', createdAt: now },
    { id: snacksCatId, name: 'Snacks & Extras', createdAt: now },
  ];
  await db.categories.bulkAdd(categories);

  const products = [
    // Chai Department
    { name: 'Karak Chai', categoryId: chaiCatId, department: 'CHAI' as const, cost: 35, sell: 70, stock: 200 },
    { name: 'Doodh Patti', categoryId: chaiCatId, department: 'CHAI' as const, cost: 55, sell: 110, stock: 150 },
    { name: 'Elaichi Chai', categoryId: chaiCatId, department: 'CHAI' as const, cost: 45, sell: 90, stock: 100 },
    { name: 'Kashmiri Chai', categoryId: chaiCatId, department: 'CHAI' as const, cost: 70, sell: 140, stock: 80 },
    { name: 'Green Tea / Qahwa', categoryId: chaiCatId, department: 'CHAI' as const, cost: 30, sell: 60, stock: 120 },

    // Parhata Department
    { name: 'Sada Parhata', categoryId: parhataCatId, department: 'PARHATA' as const, cost: 40, sell: 80, stock: 150 },
    { name: 'Aloo Parhata', categoryId: parhataCatId, department: 'PARHATA' as const, cost: 75, sell: 150, stock: 80 },
    { name: 'Anda Parhata', categoryId: parhataCatId, department: 'PARHATA' as const, cost: 70, sell: 140, stock: 80 },
    { name: 'Cheese Parhata', categoryId: parhataCatId, department: 'PARHATA' as const, cost: 120, sell: 240, stock: 50 },
    { name: 'Keema Parhata', categoryId: parhataCatId, department: 'PARHATA' as const, cost: 140, sell: 270, stock: 40 },
    { name: 'Meetha Parhata', categoryId: parhataCatId, department: 'PARHATA' as const, cost: 60, sell: 120, stock: 60 },

    // Drinks & Extras (General)
    { name: 'Mineral Water 500ml', categoryId: drinksCatId, department: 'GENERAL' as const, cost: 50, sell: 80, stock: 50 },
    { name: 'Coke 300ml', categoryId: drinksCatId, department: 'GENERAL' as const, cost: 65, sell: 90, stock: 40 },
    { name: 'Sprite 300ml', categoryId: drinksCatId, department: 'GENERAL' as const, cost: 65, sell: 90, stock: 40 },
    { name: 'Plain Omelette', categoryId: snacksCatId, department: 'GENERAL' as const, cost: 40, sell: 80, stock: 60 },
    { name: 'Cheese Omelette', categoryId: snacksCatId, department: 'GENERAL' as const, cost: 80, sell: 150, stock: 40 },
  ].map((p) => ({
    id: generateId(),
    name: p.name,
    categoryId: p.categoryId,
    department: p.department,
    costPrice: toPaisa(p.cost),
    sellingPrice: toPaisa(p.sell),
    stock: p.stock,
    active: true,
    createdAt: now,
    updatedAt: now,
  }));

  await db.products.bulkAdd(products);
}
