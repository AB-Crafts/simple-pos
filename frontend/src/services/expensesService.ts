import { apiClient } from './apiClient';
import type { Expense, PaymentMethod } from '../types';

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

export async function listExpenses(from?: number, to?: number): Promise<Expense[]> {
  const query = from != null && to != null ? `?from=${from}&to=${to}` : '';
  return apiClient.get<Expense[]>(`/expenses${query}`);
}

export async function recordExpense(input: RecordExpenseInput): Promise<Expense> {
  const { description, amount, category, paymentMethod, notes } = input;

  if (!description.trim()) throw new Error('Expense description is required');
  if (amount <= 0) throw new Error('Expense amount must be greater than zero');

  return apiClient.post<Expense>('/expenses', {
    description: description.trim(),
    amount,
    category,
    paymentMethod,
    notes: notes?.trim() || undefined,
  });
}
