import { randomUUID } from 'node:crypto';
import { pool } from '../database/pool.js';
import type { Expense } from '../models/types.js';

interface ExpenseRow {
  id: string;
  description: string;
  amount: string;
  category: string;
  payment_method: Expense['paymentMethod'];
  notes: string | null;
  created_at: string;
}

function toExpense(row: ExpenseRow): Expense {
  return {
    id: row.id,
    description: row.description,
    amount: Number(row.amount),
    category: row.category,
    paymentMethod: row.payment_method,
    notes: row.notes,
    createdAt: Number(row.created_at),
  };
}

export async function listExpenses(from?: number, to?: number): Promise<Expense[]> {
  if (from != null && to != null) {
    const result = await pool.query<ExpenseRow>(
      'SELECT * FROM expenses WHERE created_at BETWEEN $1 AND $2 ORDER BY created_at DESC',
      [from, to]
    );
    return result.rows.map(toExpense);
  }
  const result = await pool.query<ExpenseRow>('SELECT * FROM expenses ORDER BY created_at DESC LIMIT 200');
  return result.rows.map(toExpense);
}

/** Idempotent upsert keyed on the expense's own id — safe to re-send from a retried sync. */
export async function upsertSyncedExpense(expense: Expense): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query('SELECT id FROM expenses WHERE id = $1', [expense.id]);
    if (!existing.rowCount) {
      await client.query(
        `INSERT INTO expenses (id, description, amount, category, payment_method, notes, created_at, synced_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          expense.id,
          expense.description,
          expense.amount,
          expense.category,
          expense.paymentMethod,
          expense.notes ?? null,
          expense.createdAt,
          Date.now(),
        ]
      );

      await client.query(
        `INSERT INTO money_transactions (id, type, amount, reference_id, created_at)
         VALUES ($1, 'EXPENSE', $2, $3, $4)`,
        [randomUUID(), expense.amount, expense.id, expense.createdAt]
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
