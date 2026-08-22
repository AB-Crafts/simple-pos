import { db } from './db';
import { generateId } from '../utils/id';
import { toPaisa } from '../utils/money';
import type { Department, Product, Category } from '../types';

/**
 * Normalizes product name for deduplication comparison.
 */
export function normalizeProductName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Normalizes category name for deduplication comparison.
 */
export function normalizeCategoryName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Returns the proper department based on product name and existing department.
 */
export function inferDepartment(name: string, currentDept?: Department): Department {
  const n = normalizeProductName(name);
  if (
    n.includes('chai') ||
    n.includes('tea') ||
    n.includes('doodh') ||
    n.includes('milk') ||
    n.includes('qahwa') ||
    n.includes('kahwa') ||
    n.includes('elaichi')
  ) {
    return 'CHAI';
  }
  if (
    n.includes('parhata') ||
    n.includes('paratha') ||
    n.includes('lacha') ||
    n.includes('roti')
  ) {
    return 'PARHATA';
  }
  if (currentDept === 'CHAI' || currentDept === 'PARHATA') {
    return currentDept;
  }
  return 'GENERAL';
}

/**
 * Deduplicates categories in Dexie IndexedDB and standardizes canonical categories:
 * - 'Chai'
 * - 'Parhata'
 * - 'Cold Drinks'
 * - 'Snacks & Extras'
 *
 * Any duplicate category objects are merged, products remapped, and duplicates deleted.
 */
export async function deduplicateAndAlignCategories(): Promise<{
  chaiCatId: string;
  parhataCatId: string;
  drinksCatId: string;
  snacksCatId: string;
}> {
  const now = Date.now();
  const allCategories = await db.categories.toArray();

  // 1. Group categories by normalized name
  const catGroups = new Map<string, Category[]>();
  for (const cat of allCategories) {
    const norm = normalizeCategoryName(cat.name);
    if (!catGroups.has(norm)) {
      catGroups.set(norm, []);
    }
    catGroups.get(norm)!.push(cat);
  }

  // 2. Deduplicate groups with exact same normalized name
  for (const [, group] of catGroups.entries()) {
    if (group.length > 1) {
      // Pick canonical: oldest created or first
      group.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      const canonical = group[0];
      const duplicates = group.slice(1);

      for (const dup of duplicates) {
        // Remap any products pointing to duplicate category
        const prodsWithDup = await db.products.where('categoryId').equals(dup.id).toArray();
        for (const p of prodsWithDup) {
          await db.products.update(p.id, { categoryId: canonical.id });
        }
        await db.categories.delete(dup.id);
      }
    }
  }

  // 3. Re-fetch cleaned categories
  let remainingCats = await db.categories.toArray();

  // Helper to ensure canonical category exists with exact title
  async function ensureCategory(standardName: string, keywords: string[]): Promise<string> {
    let match = remainingCats.find((c) => {
      const n = normalizeCategoryName(c.name);
      return keywords.some((k) => n.includes(k));
    });

    if (!match) {
      const id = generateId();
      match = { id, name: standardName, createdAt: now };
      await db.categories.add(match);
      remainingCats.push(match);
    } else if (match.name !== standardName) {
      await db.categories.update(match.id, { name: standardName });
      match.name = standardName;
    }
    return match.id;
  }

  const chaiCatId = await ensureCategory('Chai', ['chai', 'tea']);
  const parhataCatId = await ensureCategory('Parhata', ['parhata', 'paratha']);
  const drinksCatId = await ensureCategory('Cold Drinks', ['cold drink', 'drink', 'beverage']);
  const snacksCatId = await ensureCategory('Snacks & Extras', ['snack', 'extra']);

  // 4. Clean up any remaining secondary duplicates across standard names
  const finalCats = await db.categories.toArray();
  const seenCanonical = new Map<string, string>(); // normName -> id
  for (const cat of finalCats) {
    const norm = normalizeCategoryName(cat.name);
    if (seenCanonical.has(norm)) {
      const canonId = seenCanonical.get(norm)!;
      const prodsWithDup = await db.products.where('categoryId').equals(cat.id).toArray();
      for (const p of prodsWithDup) {
        await db.products.update(p.id, { categoryId: canonId });
      }
      await db.categories.delete(cat.id);
    } else {
      seenCanonical.set(norm, cat.id);
    }
  }

  return { chaiCatId, parhataCatId, drinksCatId, snacksCatId };
}

/**
 * Deduplicates products in Dexie IndexedDB and aligns departments & categories.
 * Safe to run on every startup: cleans up any duplicate entries and preserves sales history.
 */
export async function deduplicateAndAlignProducts(): Promise<void> {
  const now = Date.now();

  // Deduplicate categories first and get canonical category IDs
  const { chaiCatId, parhataCatId, drinksCatId, snacksCatId } = await deduplicateAndAlignCategories();

  const allProducts = await db.products.toArray();

  // 1. Group products by normalized name to find duplicates
  const groups = new Map<string, Product[]>();
  for (const p of allProducts) {
    const norm = normalizeProductName(p.name);
    if (!groups.has(norm)) {
      groups.set(norm, []);
    }
    groups.get(norm)!.push(p);
  }

  for (const [, prods] of groups.entries()) {
    if (prods.length > 1) {
      // Pick best canonical product:
      // Prefer active > has department > has valid price > most recently updated
      prods.sort((a, b) => {
        if (a.active !== b.active) return a.active ? -1 : 1;
        if (a.department && !b.department) return -1;
        if (!a.department && b.department) return 1;
        return (b.updatedAt || 0) - (a.updatedAt || 0);
      });

      const canonical = prods[0];
      const duplicates = prods.slice(1);

      // Reassign saleItems referencing duplicates to canonical product ID
      for (const dup of duplicates) {
        const saleItems = await db.saleItems.where('productId').equals(dup.id).toArray();
        for (const item of saleItems) {
          await db.saleItems.update(item.id, { productId: canonical.id });
        }
        await db.products.delete(dup.id);
      }
    }
  }

  // 2. Normalize departments, categories, and units on all remaining products
  const remainingProducts = await db.products.toArray();
  for (const p of remainingProducts) {
    const targetDept = inferDepartment(p.name, p.department);
    let targetCatId = p.categoryId;

    if (!targetCatId) {
      if (targetDept === 'CHAI') targetCatId = chaiCatId;
      else if (targetDept === 'PARHATA') targetCatId = parhataCatId;
      else if (
        p.name.toLowerCase().includes('water') ||
        p.name.toLowerCase().includes('coke') ||
        p.name.toLowerCase().includes('sprite') ||
        p.name.toLowerCase().includes('drink')
      ) {
        targetCatId = drinksCatId;
      } else {
        targetCatId = snacksCatId;
      }
    }

    let targetUnit = p.unit;
    if (p.name.toLowerCase().includes('milk')) {
      targetUnit = 'kg';
    }

    if (p.department !== targetDept || p.categoryId !== targetCatId || p.unit !== targetUnit) {
      await db.products.update(p.id, {
        department: targetDept,
        categoryId: targetCatId,
        unit: targetUnit,
        updatedAt: now,
      });
    }
  }
}

let seedingPromise: Promise<void> | null = null;

/**
 * Seeds sample categories/products if database is empty,
 * and runs deduplication and department alignment.
 * Singleton promise prevents race conditions in React StrictMode.
 */
export function seedIfEmpty(): Promise<void> {
  if (!seedingPromise) {
    seedingPromise = runSeedIfEmpty().catch((err) => {
      seedingPromise = null;
      console.error('Failed to seed/align database:', err);
      throw err;
    });
  }
  return seedingPromise;
}

async function runSeedIfEmpty(): Promise<void> {
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
  if (existing > 0) {
    await deduplicateAndAlignProducts();
    return;
  }

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
    { name: 'Karak Chai', categoryId: chaiCatId, department: 'CHAI' as const, unit: 'cup', cost: 35, sell: 70, stock: 200 },
    { name: 'Doodh Patti', categoryId: chaiCatId, department: 'CHAI' as const, unit: 'cup', cost: 55, sell: 110, stock: 150 },
    { name: 'Fresh Milk', categoryId: chaiCatId, department: 'CHAI' as const, unit: 'kg', cost: 160, sell: 200, stock: 100 },
    { name: 'Elaichi Chai', categoryId: chaiCatId, department: 'CHAI' as const, unit: 'cup', cost: 45, sell: 90, stock: 100 },
    { name: 'Kashmiri Chai', categoryId: chaiCatId, department: 'CHAI' as const, cost: 70, sell: 140, stock: 80 },
    { name: 'Green Tea / Qahwa', categoryId: chaiCatId, department: 'CHAI' as const, cost: 30, sell: 60, stock: 120 },

    // Parhata Department
    { name: 'Lacha Parhata', categoryId: parhataCatId, department: 'PARHATA' as const, cost: 50, sell: 100, stock: 150 },
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
  await deduplicateAndAlignProducts();
}
