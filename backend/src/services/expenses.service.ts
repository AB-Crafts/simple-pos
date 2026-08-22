import { randomUUID } from 'node:crypto';
import { db } from '../database/db.js';
import { ApiError } from '../utils/ApiError.js';
import type { Expense, PaymentMethod } from '../models/types.js';

interface ExpenseRow {
  id: string;
  description: string;
  amount: number;
  category: string;
  payment_method: PaymentMethod;
  notes: string | null;
  created_at: number;
}

function toExpense(row: ExpenseRow): Expense {
  return {
    id: row.id,
    description: row.description,
    amount: row.amount,
    category: row.category,
    paymentMethod: row.payment_method,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

export async function listExpenses(from?: number, to?: number): Promise<Expense[]> {
  if (from != null && to != null) {
    const rows = db.prepare(
      'SELECT * FROM expenses WHERE created_at BETWEEN ? AND ? ORDER BY created_at DESC'
    ).all(from, to) as ExpenseRow[];
    return rows.map(toExpense);
  }

  const rows = db.prepare('SELECT * FROM expenses ORDER BY created_at DESC').all() as ExpenseRow[];
  return rows.map(toExpense);
}

export async function recordExpense(input: {
  description: string;
  amount: number;
  category: string;
  paymentMethod: PaymentMethod;
  notes?: string;
  createdAt?: number;
}): Promise<Expense> {
  const { description, amount, category, paymentMethod, notes, createdAt } = input;

  if (!description || !description.trim()) {
    throw new ApiError(400, 'Expense description is required');
  }
  if (!amount || amount <= 0) {
    throw new ApiError(400, 'Expense amount must be greater than zero');
  }

  const expenseId = randomUUID();
  const now = createdAt || Date.now();

  const executeTransaction = db.transaction(() => {
    db.prepare(`
      INSERT INTO expenses (id, description, amount, category, payment_method, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(expenseId, description.trim(), amount, category, paymentMethod, notes?.trim() || null, now);

    db.prepare(`
      INSERT INTO money_transactions (id, type, amount, reference_id, created_at)
      VALUES (?, 'EXPENSE', ?, ?, ?)
    `).run(randomUUID(), amount, expenseId, now);
  });

  executeTransaction();

  const row = db.prepare('SELECT * FROM expenses WHERE id = ?').get(expenseId) as ExpenseRow;
  return toExpense(row);
}
