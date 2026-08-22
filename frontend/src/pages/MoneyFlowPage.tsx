import { useEffect, useMemo, useState } from 'react';
import { listMoneyTransactions, recordWithdrawal } from '../services/moneyFlowService';
import { listExpenses } from '../services/expensesService';
import { formatMoney, toPaisa } from '../utils/money';
import type { Expense, MoneyTransaction } from '../types';

export function MoneyFlowPage() {
  const [transactions, setTransactions] = useState<MoneyTransaction[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [txs, exps] = await Promise.all([
        listMoneyTransactions(),
        listExpenses(),
      ]);
      setTransactions(txs);
      setExpenses(exps);
    } catch (err) {
      console.error('Failed to load money flow:', err);
    } finally {
      setLoading(false);
    }
  }

  // Expense lookup by ID for rich descriptions
  const expenseMap = useMemo(() => {
    const map = new Map<string, Expense>();
    for (const e of expenses ?? []) {
      map.set(e.id, e);
    }
    return map;
  }, [expenses]);

  // Today's summary metrics
  const { cashIn, cashOut, netCash, totalSalesCount } = useMemo(() => {
    const list = transactions ?? [];
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    let inSum = 0;
    let outSum = 0;
    let salesCount = 0;

    for (const t of list) {
      if (t.createdAt >= startOfToday) {
        if (t.type === 'CASH_SALE' || t.type === 'CARD_SALE') {
          inSum += t.amount;
          salesCount++;
        } else if (t.type === 'EXPENSE' || t.type === 'WITHDRAWAL') {
          outSum += t.amount;
        }
      }
    }

    return {
      cashIn: inSum,
      cashOut: outSum,
      netCash: inSum - outSum,
      totalSalesCount: salesCount,
    };
  }, [transactions]);

  async function handleWithdraw(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const amt = parseFloat(withdrawAmount);
    if (isNaN(amt) || amt <= 0) {
      setError('Please enter a valid withdrawal amount.');
      return;
    }

    setSaving(true);
    try {
      await recordWithdrawal(toPaisa(amt));
      setToast(`Cash withdrawal of Rs. ${amt} recorded!`);
      setWithdrawAmount('');
      await loadData();
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Could not record withdrawal');
    } finally {
      setSaving(false);
    }
  }

  function getTransactionIcon(type: MoneyTransaction['type']): string {
    switch (type) {
      case 'CASH_SALE':
        return '💵';
      case 'CARD_SALE':
        return '💳';
      case 'CREDIT_SALE':
        return '📝';
      case 'EXPENSE':
        return '💸';
      case 'WITHDRAWAL':
        return '🏦';
      default:
        return '💰';
    }
  }

  return (
    <div className="money-flow-page-modern">
      {/* Header */}
      <div className="money-page__header">
        <div>
          <h2 className="money-title">Cash Register & Money Flow</h2>
          <p className="money-subtitle">
            Live ledger of cash in/out, register balance, bank deposits, and owner withdrawals.
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="money-stats-row">
        <div className="money-stat-card money-stat-card--in">
          <span className="money-stat-card__label">Today's Inflow (Sales)</span>
          <span className="money-stat-card__val text-success">+{formatMoney(cashIn)}</span>
          <span className="money-stat-card__sub">{totalSalesCount} customer orders paid</span>
        </div>

        <div className="money-stat-card money-stat-card--out">
          <span className="money-stat-card__label">Today's Outflow</span>
          <span className="money-stat-card__val text-danger">-{formatMoney(cashOut)}</span>
          <span className="money-stat-card__sub">Expenses & withdrawals</span>
        </div>

        <div className="money-stat-card money-stat-card--net">
          <span className="money-stat-card__label">Net Cash Balance</span>
          <span
            className={`money-stat-card__val ${
              netCash >= 0 ? 'text-success' : 'text-danger'
            }`}
          >
            {formatMoney(netCash)}
          </span>
          <span className="money-stat-card__sub">Estimated register cash</span>
        </div>
      </div>

      <div className="money-flow-grid">
        {/* Left Column: Withdrawal Form */}
        <div className="money-card-section">
          <div className="section-card">
            <h3 className="section-card__title">🏦 Cash Withdrawal / Deposit</h3>
            <p className="section-card__desc">
              Record cash taken out of the drawer for owner use, bank deposit, or change.
            </p>

            {error && <div className="form-error">{error}</div>}

            <form onSubmit={handleWithdraw} className="withdraw-form">
              <div className="form-group">
                <label className="form-label">Withdrawal Amount (Rs.)</label>
                <div className="currency-input-wrap">
                  <span className="currency-prefix">Rs.</span>
                  <input
                    type="number"
                    min={0}
                    step="1"
                    placeholder="0"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    className="form-input currency-input"
                  />
                </div>
              </div>

              {/* Quick Withdrawal Chips */}
              <div className="quick-amount-row">
                <span className="quick-amount-label">Quick amount:</span>
                <div className="quick-stock-chips">
                  {[500, 1000, 2000, 5000, 10000].map((val) => (
                    <button
                      key={val}
                      type="button"
                      className="chip"
                      onClick={() => setWithdrawAmount(String(val))}
                    >
                      Rs. {val}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-large btn-full-width"
                disabled={saving || !withdrawAmount}
              >
                {saving ? 'Recording...' : 'Record Cash Withdrawal'}
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Transaction Ledger */}
        <div className="money-card-section">
          <div className="section-card">
            <h3 className="section-card__title">📜 Live Cash Register Ledger</h3>
            <p className="section-card__desc">
              All inflows and outflows logged in real time.
            </p>

            <div className="ledger-table-wrap">
              <table className="ledger-modern-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Type & Description</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => {
                    const d = new Date(tx.createdAt);
                    const isInflow =
                      tx.type === 'CASH_SALE' || tx.type === 'CARD_SALE';
                    const expDetail =
                      tx.type === 'EXPENSE' && tx.referenceId
                        ? expenseMap.get(tx.referenceId)
                        : null;

                    return (
                      <tr key={tx.id}>
                        <td className="ledger-time-cell">
                          <div className="ledger-time-main">
                            {d.toLocaleTimeString('en-PK', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                          <div className="ledger-time-date">
                            {d.toLocaleDateString('en-PK', {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </div>
                        </td>

                        <td className="ledger-type-cell">
                          <div className="ledger-type-badge-wrap">
                            <span className="ledger-icon">
                              {getTransactionIcon(tx.type)}
                            </span>
                            <span className="ledger-type-name">
                              {tx.type.replace('_', ' ')}
                            </span>
                          </div>
                          {expDetail && (
                            <div className="ledger-exp-detail">
                              {expDetail.description} ({expDetail.category})
                            </div>
                          )}
                        </td>

                        <td style={{ textAlign: 'right' }}>
                          <span
                            className={`ledger-amount ${
                              isInflow
                                ? 'ledger-amount--in'
                                : 'ledger-amount--out'
                            }`}
                          >
                            {isInflow ? '+' : '-'}
                            {formatMoney(tx.amount)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}

                  {transactions.length === 0 && (
                    <tr>
                      <td colSpan={3} className="ledger-empty-cell">
                        <div className="empty-state-wrap">
                          <span className="empty-icon">💰</span>
                          <p className="empty-title">{loading ? 'Loading ledger...' : 'No transactions yet'}</p>
                          <p className="empty-desc">
                            Completed sales and recorded expenses will appear here automatically.
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className="toast" role="status" onAnimationEnd={() => setToast(null)}>
          {toast}
        </div>
      )}
    </div>
  );
}
