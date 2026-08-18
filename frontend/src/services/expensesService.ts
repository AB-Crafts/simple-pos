import { db } from '../database/db';
import { generateId } from '../utils/id';
import type { PaymentMethod } from '../types';

export const EXPENSE_CATEGORIES = [
  'Electricity',
  'Rent',
  'Transport',
  'Salaries',
  'Supplies',
  'Maintenance',
  'Other',
] as const;

interface RecordExpenseInput {
  description: string;
  amount: number; // paisa
  category: string;
  paymentMethod: PaymentMethod;
  notes?: string;
}

/**
 * Records a business expense entirely against the local database:
 * - writes the expense
 * - logs a negative money transaction for the Money Flow screen
 * - marks the record as PENDING sync
 *
 * Mirrors salesService.completeSale — never touches the network.
 */
export async function recordExpense(input: RecordExpenseInput) {
  const { description, amount, category, paymentMethod, notes } = input;

  if (!description.trim()) throw new Error('Expense description is required');
  if (amount <= 0) throw new Error('Expense amount must be greater than zero');

  const now = Date.now();
  const expenseId = generateId();

  await db.transaction('rw', db.expenses, db.moneyTransactions, db.syncQueue, async () => {
    await db.expenses.add({
      id: expenseId,
      description: description.trim(),
      amount,
      category,
      paymentMethod,
      notes: notes?.trim() || undefined,
      createdAt: now,
      syncStatus: 'PENDING',
    });

    await db.moneyTransactions.add({
      id: generateId(),
      type: 'EXPENSE',
      amount,
      referenceId: expenseId,
      createdAt: now,
    });

    await db.syncQueue.add({
      id: generateId(),
      entity: 'expense',
      entityId: expenseId,
      status: 'PENDING',
      attempts: 0,
      createdAt: now,
    });
  });

  return expenseId;
}
