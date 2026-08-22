import { randomUUID } from 'node:crypto';
import { db } from '../database/db.js';
import { ApiError } from '../utils/ApiError.js';
import type { MoneyTransaction, MoneyTransactionType } from '../models/types.js';

interface MoneyTransactionRow {
  id: string;
  type: MoneyTransactionType;
  amount: number;
  reference_id: string | null;
  created_at: number;
}

function toMoneyTransaction(row: MoneyTransactionRow): MoneyTransaction {
  return {
    id: row.id,
    type: row.type,
    amount: row.amount,
    referenceId: row.reference_id,
    createdAt: row.created_at,
  };
}

export async function listMoneyTransactions(from?: number, to?: number): Promise<MoneyTransaction[]> {
  if (from != null && to != null) {
    const rows = db.prepare(
      'SELECT * FROM money_transactions WHERE created_at BETWEEN ? AND ? ORDER BY created_at DESC'
    ).all(from, to) as MoneyTransactionRow[];
    return rows.map(toMoneyTransaction);
  }

  const rows = db.prepare('SELECT * FROM money_transactions ORDER BY created_at DESC').all() as MoneyTransactionRow[];
  return rows.map(toMoneyTransaction);
}

export async function recordWithdrawal(amount: number, createdAt?: number): Promise<MoneyTransaction> {
  if (!amount || amount <= 0) {
    throw new ApiError(400, 'Withdrawal amount must be greater than zero');
  }

  const id = randomUUID();
  const now = createdAt || Date.now();

  db.prepare(`
    INSERT INTO money_transactions (id, type, amount, reference_id, created_at)
    VALUES (?, 'WITHDRAWAL', ?, NULL, ?)
  `).run(id, amount, now);

  const row = db.prepare('SELECT * FROM money_transactions WHERE id = ?').get(id) as MoneyTransactionRow;
  return toMoneyTransaction(row);
}
