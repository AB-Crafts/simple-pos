import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../database/db';
import { EXPENSE_CATEGORIES, recordExpense } from '../services/expensesService';
import { formatMoney, toPaisa } from '../utils/money';
import type { PaymentMethod } from '../types';

const emptyForm = {
  description: '',
  amount: '',
  category: EXPENSE_CATEGORIES[0] as string,
  paymentMethod: 'CASH' as PaymentMethod,
  notes: '',
};

export function ExpensesPage() {
  const expenses = useLiveQuery(
    () => db.expenses.orderBy('createdAt').reverse().limit(100).toArray(),
    []
  );
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const todayTotal = useMemo(() => {
    if (!expenses) return 0;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    return expenses
      .filter((e) => e.createdAt >= startOfDay.getTime())
      .reduce((sum, e) => sum + e.amount, 0);
  }, [expenses]);

  async function handleSave() {
    setError(null);
    try {
      await recordExpense({
        description: form.description,
        amount: toPaisa(parseFloat(form.amount || '0')),
        category: form.category,
        paymentMethod: form.paymentMethod,
        notes: form.notes,
      });
      setForm(emptyForm);
      setShowForm(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save expense');
    }
  }

  return (
    <div className="expenses-page">
      <div className="expenses-page__toolbar">
        <div className="expenses-page__today">
          <span className="expenses-page__today-label">Today's expenses</span>
          <span className="expenses-page__today-amount">{formatMoney(todayTotal)}</span>
        </div>
        <button className="primary-btn" onClick={() => setShowForm(true)}>
          + ADD EXPENSE
        </button>
      </div>

      <table className="products-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Description</th>
            <th>Category</th>
            <th>Payment</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {(expenses ?? []).map((e) => (
            <tr key={e.id}>
              <td>
                {new Date(e.createdAt).toLocaleDateString('en-PK', { day: '2-digit', month: 'short' })}
              </td>
              <td>
                {e.description}
                {e.notes && <div className="expenses-page__notes">{e.notes}</div>}
              </td>
              <td>{e.category}</td>
              <td>{e.paymentMethod}</td>
              <td>{formatMoney(e.amount)}</td>
            </tr>
          ))}
          {expenses && expenses.length === 0 && (
            <tr>
              <td colSpan={5} className="empty-hint">
                No expenses recorded yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {showForm && (
        <div className="modal-backdrop" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Add Expense</h3>

            {error && <div className="form-error">{error}</div>}

            <label>
              Description
              <input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="e.g. Electricity"
                autoFocus
              />
            </label>

            <div className="modal__row">
              <label>
                Amount (Rs.)
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </label>
              <label>
                Category
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                >
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label>
              Payment method
              <select
                value={form.paymentMethod}
                onChange={(e) => setForm({ ...form, paymentMethod: e.target.value as PaymentMethod })}
              >
                <option value="CASH">Cash</option>
                <option value="CARD">Card</option>
                <option value="CREDIT">Credit</option>
              </select>
            </label>

            <label>
              Notes (optional)
              <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </label>

            <div className="modal__actions">
              <button onClick={() => setShowForm(false)}>Cancel</button>
              <button className="primary-btn" onClick={handleSave}>
                SAVE EXPENSE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
