import { ApiError } from '../utils/ApiError.js';
import { upsertSyncedSale } from './sales.service.js';
import { upsertSyncedExpense } from './expenses.service.js';
import { upsertProduct } from './products.service.js';
import type { Sale, SaleItem, Expense, Product } from '../models/types.js';

/**
 * Applies one queued record pushed from an offline device. Each entity
 * type validates and upserts independently — the frontend's syncService
 * calls one of these per queue item, keyed by entity, so a sale syncing
 * successfully never blocks on an expense that failed, and vice versa.
 */
export async function applySyncedSale(body: { sale: Sale; items: SaleItem[] }) {
  if (!body?.sale?.id) throw new ApiError(400, 'Missing sale payload');
  await upsertSyncedSale(body.sale, body.items ?? []);
}

export async function applySyncedExpense(body: Expense) {
  if (!body?.id) throw new ApiError(400, 'Missing expense payload');
  await upsertSyncedExpense(body);
}

export async function applySyncedProduct(body: Product) {
  if (!body?.id) throw new ApiError(400, 'Missing product payload');
  await upsertProduct(body);
}
