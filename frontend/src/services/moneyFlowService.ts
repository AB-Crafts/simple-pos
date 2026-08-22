import { apiClient } from './apiClient';
import type { MoneyTransaction } from '../types';

export async function listMoneyTransactions(from?: number, to?: number): Promise<MoneyTransaction[]> {
  const query = from != null && to != null ? `?from=${from}&to=${to}` : '';
  return apiClient.get<MoneyTransaction[]>(`/money-transactions${query}`);
}

export async function recordWithdrawal(amount: number): Promise<MoneyTransaction> {
  if (amount <= 0) throw new Error('Withdrawal amount must be greater than zero');
  return apiClient.post<MoneyTransaction>('/money-transactions/withdraw', { amount });
}
