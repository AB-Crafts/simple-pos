import { db } from '../database/db';
import { generateId } from '../utils/id';

/**
 * Records an owner/manager cash withdrawal from the till (e.g. taking cash
 * out for personal use, a bank deposit, etc.). This only affects Money
 * Flow — it is not an expense and does not touch the Reports P&L.
 */
export async function recordWithdrawal(amount: number) {
  if (amount <= 0) throw new Error('Withdrawal amount must be greater than zero');

  await db.moneyTransactions.add({
    id: generateId(),
    type: 'WITHDRAWAL',
    amount,
    referenceId: null,
    createdAt: Date.now(),
  });
}
