import { randomUUID } from 'node:crypto';
import { db } from '../database/db.js';
import { ApiError } from '../utils/ApiError.js';
import type { Waiter } from '../models/types.js';

interface WaiterRow {
  id: string;
  name: string;
  active: number;
  created_at: number;
}

function toWaiter(row: WaiterRow): Waiter {
  return {
    id: row.id,
    name: row.name,
    active: Boolean(row.active),
    createdAt: row.created_at,
  };
}

export async function listWaiters(activeOnly = false): Promise<Waiter[]> {
  const query = activeOnly
    ? 'SELECT * FROM waiters WHERE active = 1 ORDER BY name'
    : 'SELECT * FROM waiters ORDER BY name';
  const rows = db.prepare(query).all() as WaiterRow[];
  return rows.map(toWaiter);
}

export async function createWaiter(input: { id?: string; name: string; active?: boolean }): Promise<Waiter> {
  const id = input.id || randomUUID();
  const now = Date.now();
  const active = input.active === false ? 0 : 1;

  db.prepare('INSERT INTO waiters (id, name, active, created_at) VALUES (?, ?, ?, ?)').run(
    id,
    input.name.trim(),
    active,
    now
  );

  const row = db.prepare('SELECT * FROM waiters WHERE id = ?').get(id) as WaiterRow;
  return toWaiter(row);
}

export async function toggleWaiterActive(id: string): Promise<Waiter> {
  const row = db.prepare('SELECT * FROM waiters WHERE id = ?').get(id) as WaiterRow | undefined;
  if (!row) throw new ApiError(404, 'Waiter not found');

  const updatedActive = row.active ? 0 : 1;
  db.prepare('UPDATE waiters SET active = ? WHERE id = ?').run(updatedActive, id);

  const updatedRow = db.prepare('SELECT * FROM waiters WHERE id = ?').get(id) as WaiterRow;
  return toWaiter(updatedRow);
}

