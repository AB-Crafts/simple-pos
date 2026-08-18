import { db } from '../database/db';
import { apiClient } from './apiClient';
import type { SyncQueueItem } from '../types';

/**
 * Pushes locally-created sales/expenses/products to the backend when the
 * device is online. This is designed so a sale/expense NEVER waits on
 * this to complete — completeSale() and recordExpense() already finished
 * and returned before this ever runs. Sync is purely a background
 * best-effort push; failures are retried later and nothing is lost.
 */

type SyncListener = (event: 'start' | 'success' | 'error' | 'idle') => void;
const listeners = new Set<SyncListener>();

export function onSyncEvent(listener: SyncListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(event: 'start' | 'success' | 'error' | 'idle') {
  listeners.forEach((l) => l(event));
}

/** Marks the source record (sale/expense/product) as synced, explicitly
 * per entity type — avoids fragile dynamic table indexing on `db`. */
async function markEntitySynced(item: SyncQueueItem) {
  switch (item.entity) {
    case 'sale':
      return db.sales.update(item.entityId, { syncStatus: 'SYNCED' });
    case 'expense':
      return db.expenses.update(item.entityId, { syncStatus: 'SYNCED' });
    case 'product':
      // Products don't carry a syncStatus field (they're not append-only
      // transactions) — nothing further to update beyond the queue itself.
      return;
  }
}

async function buildPayload(item: SyncQueueItem) {
  switch (item.entity) {
    case 'sale': {
      const sale = await db.sales.get(item.entityId);
      if (!sale) return null;
      const items = await db.saleItems.where('saleId').equals(item.entityId).toArray();
      return { sale, items };
    }
    case 'expense':
      return db.expenses.get(item.entityId);
    case 'product':
      return db.products.get(item.entityId);
    default:
      return null;
  }
}

let syncing = false;

/**
 * Drains the syncQueue: sends every PENDING or FAILED item to the backend.
 * Safe to call repeatedly — it no-ops if already running or offline.
 */
export async function syncPending(): Promise<void> {
  if (syncing) return;
  if (!navigator.onLine) return;

  const due = await db.syncQueue.where('status').anyOf('PENDING', 'FAILED').toArray();
  if (due.length === 0) return;

  syncing = true;
  emit('start');
  let anyFailed = false;

  for (const item of due) {
    try {
      const payload = await buildPayload(item);
      if (payload == null) {
        // Referenced record no longer exists locally — drop the queue entry.
        await db.syncQueue.delete(item.id);
        continue;
      }

      await apiClient.post(`/sync/${item.entity}`, payload);

      await db.transaction('rw', db.syncQueue, db.sales, db.expenses, async () => {
        await db.syncQueue.update(item.id, { status: 'SYNCED' });
        await markEntitySynced(item);
      });
    } catch (err) {
      anyFailed = true;
      await db.syncQueue.update(item.id, {
        status: 'FAILED',
        attempts: item.attempts + 1,
        lastError: err instanceof Error ? err.message : String(err),
      });
    }
  }

  syncing = false;
  emit(anyFailed ? 'error' : 'success');
}

let intervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Wires up automatic sync: immediately, whenever the browser regains a
 * connection, and on a periodic interval while online (in case sync
 * failed silently or the 'online' event doesn't fire, e.g. captive
 * portals). Call once from the app root; call the returned function to
 * tear down (mainly useful for tests / hot reload).
 */
export function startAutoSync(): () => void {
  const trigger = () => void syncPending();

  trigger();
  window.addEventListener('online', trigger);
  intervalId = setInterval(trigger, 20_000);

  return () => {
    window.removeEventListener('online', trigger);
    if (intervalId) clearInterval(intervalId);
  };
}
