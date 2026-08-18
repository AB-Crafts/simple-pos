import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../database/db';
import { EXPENSE_CATEGORIES, recordExpense } from '../services/expensesService';
import { formatMoney, toPaisa } from '../utils/money';
import type { PaymentMethod } from '../types';

interface ExpenseFormData {
  description: string;
  amount: string;
  category: string;
  paymentMethod: PaymentMethod;
  notes: string;
}

const emptyForm: ExpenseFormData = {
  description: '',
  amount: '',
  category: 'Supplies',
  paymentMethod: 'CASH',
  notes: '',
};

export function ExpensesPage() {
  const expenses = useLiveQuery(
    () => db.expenses.orderBy('createdAt').reverse().toArray(),
    []
  );

  const [form, setForm] = useState<ExpenseFormData>(emptyForm);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [timeframeFilter, setTimeframeFilter] = useState<'ALL' | 'TODAY' | 'WEEK' | 'MONTH'>('ALL');

  // Stats
  const { todayTotal, monthTotal, count } = useMemo(() => {
    const list = expenses ?? [];
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    let todaySum = 0;
    let monthSum = 0;

    for (const e of list) {
      if (e.createdAt >= startOfToday) todaySum += e.amount;
      if (e.createdAt >= startOfMonth) monthSum += e.amount;
    }

    return {
      todayTotal: todaySum,
      monthTotal: monthSum,
      count: list.length,
    };
  }, [expenses]);

  // Filtered expense list
  const filteredExpenses = useMemo(() => {
    let list = expenses ?? [];
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6).getTime();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (e) =>
          e.description.toLowerCase().includes(q) ||
          (e.notes && e.notes.toLowerCase().includes(q)) ||
          e.category.toLowerCase().includes(q)
      );
    }

    if (categoryFilter !== 'ALL') {
      list = list.filter((e) => e.category === categoryFilter);
    }

    if (timeframeFilter === 'TODAY') {
      list = list.filter((e) => e.createdAt >= startOfToday);
    } else if (timeframeFilter === 'WEEK') {
      list = list.filter((e) => e.createdAt >= startOfWeek);
    } else if (timeframeFilter === 'MONTH') {
      list = list.filter((e) => e.createdAt >= startOfMonth);
    }

    return list;
  }, [expenses, search, categoryFilter, timeframeFilter]);

  async function handleSave() {
    setError(null);
    if (!form.description.trim()) {
      setError('Please enter an expense description.');
      return;
    }
    const amt = parseFloat(form.amount);
    if (isNaN(amt) || amt <= 0) {
      setError('Please enter a valid expense amount.');
      return;
    }

    setSaving(true);
    try {
      await recordExpense({
        description: form.description.trim(),
        amount: toPaisa(amt),
        category: form.category,
        paymentMethod: form.paymentMethod,
        notes: form.notes.trim() || undefined,
      });

      setToast(`Expense "${form.description.trim()}" of Rs. ${amt} recorded!`);
      setForm(emptyForm);
      setShowModal(false);
    } catch (e: any) {
      setError(e instanceof Error ? e.message : 'Could not save expense');
    } finally {
      setSaving(false);
    }
  }

  function getCategoryEmoji(cat: string): string {
    switch (cat.toLowerCase()) {
      case 'supplies':
        return '🥛';
      case 'electricity':
        return '💡';
      case 'rent':
        return '🏢';
      case 'salaries':
        return '💼';
      case 'maintenance':
        return '🔧';
      case 'transport':
        return '🚚';
      default:
        return '🏷️';
    }
  }

  return (
    <div className="expenses-page-modern">
      {/* Header */}
      <div className="expenses-page__header">
        <div>
          <h2 className="expenses-title">Expenses & Outflows</h2>
          <p className="expenses-subtitle">
            Track hotel operational costs, daily raw materials, utilities, maintenance, and staff wages.
          </p>
        </div>

        <button className="btn btn-primary btn-large" onClick={() => setShowModal(true)}>
          + Record Expense
        </button>
      </div>

      {/* Summary Cards */}
      <div className="expenses-stats-row">
        <div className="expense-stat-card expense-stat-card--today">
          <span className="expense-stat-card__label">Today's Total Outflow</span>
          <span className="expense-stat-card__val text-warn">{formatMoney(todayTotal)}</span>
          <span className="expense-stat-card__sub">Expenses recorded today</span>
        </div>

        <div className="expense-stat-card">
          <span className="expense-stat-card__label">This Month's Total</span>
          <span className="expense-stat-card__val text-danger">{formatMoney(monthTotal)}</span>
          <span className="expense-stat-card__sub">Current calendar month</span>
        </div>

        <div className="expense-stat-card">
          <span className="expense-stat-card__label">Total Recorded Entries</span>
          <span className="expense-stat-card__val">{count}</span>
          <span className="expense-stat-card__sub">Historical records</span>
        </div>
      </div>

      {/* Toolbar & Filters */}
      <div className="expenses-toolbar-card">
        {/* Search */}
        <div className="expenses-search-wrap">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search description, category, notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="expenses-search-input"
          />
          {search && (
            <button className="clear-search-btn" onClick={() => setSearch('')}>
              ✕
            </button>
          )}
        </div>

        {/* Timeframe Filter Pills */}
        <div className="filter-chips-group">
          <span className="filter-label">Period:</span>
          <button
            className={`filter-chip ${timeframeFilter === 'ALL' ? 'filter-chip--active' : ''}`}
            onClick={() => setTimeframeFilter('ALL')}
          >
            All
          </button>
          <button
            className={`filter-chip ${timeframeFilter === 'TODAY' ? 'filter-chip--active' : ''}`}
            onClick={() => setTimeframeFilter('TODAY')}
          >
            Today
          </button>
          <button
            className={`filter-chip ${timeframeFilter === 'WEEK' ? 'filter-chip--active' : ''}`}
            onClick={() => setTimeframeFilter('WEEK')}
          >
            Last 7 Days
          </button>
          <button
            className={`filter-chip ${timeframeFilter === 'MONTH' ? 'filter-chip--active' : ''}`}
            onClick={() => setTimeframeFilter('MONTH')}
          >
            This Month
          </button>
        </div>

        {/* Category Dropdown Filter */}
        <div className="filter-select-wrap">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="filter-select"
          >
            <option value="ALL">All Categories</option>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {getCategoryEmoji(c)} {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="expenses-table-card">
        <table className="expenses-modern-table">
          <thead>
            <tr>
              <th>Date & Time</th>
              <th>Description</th>
              <th>Category</th>
              <th style={{ textAlign: 'center' }}>Payment</th>
              <th style={{ textAlign: 'right' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {filteredExpenses.map((e) => {
              const d = new Date(e.createdAt);
              const isToday =
                new Date().toDateString() === d.toDateString();
              return (
                <tr key={e.id}>
                  <td className="expense-date-cell">
                    <div className="expense-date-main">
                      {isToday ? 'Today' : d.toLocaleDateString('en-PK', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                    <div className="expense-date-time">
                      {d.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </td>

                  <td className="expense-desc-cell">
                    <div className="expense-desc-title">{e.description}</div>
                    {e.notes && <div className="expense-desc-notes">{e.notes}</div>}
                  </td>

                  <td>
                    <span className="expense-cat-badge">
                      {getCategoryEmoji(e.category)} {e.category}
                    </span>
                  </td>

                  <td style={{ textAlign: 'center' }}>
                    <span className="expense-payment-pill">
                      {e.paymentMethod === 'CASH' ? '💵 Cash' : e.paymentMethod === 'CARD' ? '💳 Card' : '📝 Credit'}
                    </span>
                  </td>

                  <td style={{ textAlign: 'right' }}>
                    <div className="expense-amount-val">{formatMoney(e.amount)}</div>
                  </td>
                </tr>
              );
            })}

            {filteredExpenses.length === 0 && (
              <tr>
                <td colSpan={5} className="expenses-empty-cell">
                  <div className="empty-state-wrap">
                    <span className="empty-icon">💸</span>
                    <p className="empty-title">No expenses found</p>
                    <p className="empty-desc">
                      {search || categoryFilter !== 'ALL' || timeframeFilter !== 'ALL'
                        ? 'No expenses matched the chosen filter.'
                        : 'Click "+ Record Expense" above to add your first expense entry.'}
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add Expense Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div
            className="modal-card expense-form-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h3 className="modal-title">💸 Record New Expense</h3>
                <span className="modal-subtitle">
                  Log operational costs and cash deductions from daily register.
                </span>
              </div>
              <button
                className="btn-icon"
                onClick={() => setShowModal(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="modal-body expense-modal-body">
              {error && <div className="form-error">{error}</div>}

              {/* Description */}
              <div className="form-group">
                <label className="form-label">
                  Expense Description <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Daily Milk & Chai Patti, Gas Refill, Flour & Oil"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="form-input"
                  autoFocus
                />
              </div>

              {/* Amount and Category */}
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">
                    Amount (Rs.) <span className="text-danger">*</span>
                  </label>
                  <div className="currency-input-wrap">
                    <span className="currency-prefix">Rs.</span>
                    <input
                      type="number"
                      min={0}
                      step="1"
                      placeholder="0"
                      value={form.amount}
                      onChange={(e) => setForm({ ...form, amount: e.target.value })}
                      className="form-input currency-input"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="form-select"
                  >
                    {EXPENSE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {getCategoryEmoji(c)} {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Quick Amount Chips */}
              <div className="quick-amount-row">
                <span className="quick-amount-label">Quick amount:</span>
                <div className="quick-stock-chips">
                  {[200, 500, 1000, 2000, 5000].map((val) => (
                    <button
                      key={val}
                      type="button"
                      className="chip"
                      onClick={() => setForm({ ...form, amount: String(val) })}
                    >
                      Rs. {val}
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment Method Toggle */}
              <div className="form-group">
                <label className="form-label">Paid Via</label>
                <div className="payment-method-toggle">
                  <button
                    type="button"
                    className={`method-btn ${form.paymentMethod === 'CASH' ? 'method-btn--active' : ''}`}
                    onClick={() => setForm({ ...form, paymentMethod: 'CASH' })}
                  >
                    💵 Cash
                  </button>
                  <button
                    type="button"
                    className={`method-btn ${form.paymentMethod === 'CARD' ? 'method-btn--active' : ''}`}
                    onClick={() => setForm({ ...form, paymentMethod: 'CARD' })}
                  >
                    💳 Card / Bank
                  </button>
                  <button
                    type="button"
                    className={`method-btn ${form.paymentMethod === 'CREDIT' ? 'method-btn--active' : ''}`}
                    onClick={() => setForm({ ...form, paymentMethod: 'CREDIT' })}
                  >
                    📝 Credit (Udhar)
                  </button>
                </div>
              </div>

              {/* Optional Notes */}
              <div className="form-group">
                <label className="form-label">Notes / Vendor details (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Paid to milk supplier / Bill #492"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="form-input"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setShowModal(false)}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-large"
                onClick={handleSave}
                disabled={saving || !form.description.trim() || !form.amount}
              >
                {saving ? 'Saving...' : 'Save Expense'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="toast" role="status" onAnimationEnd={() => setToast(null)}>
          {toast}
        </div>
      )}
    </div>
  );
}
