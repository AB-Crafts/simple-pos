import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../database/db';
import { recordWithdrawal } from '../services/moneyFlowService';
import { formatMoney, sumPaisa, toPaisa } from '../utils/money';

type TimeframeKey = 'today' | 'yesterday' | 'week' | 'month';

function getTimeframeBounds(key: TimeframeKey): { from: number; to: number; label: string } {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();

  if (key === 'today') {
    return {
      from: startOfToday,
      to: endOfToday,
      label: "Today's Cash Flow",
    };
  }

  if (key === 'yesterday') {
    const yStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0).getTime();
    const yEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999).getTime();
    return {
      from: yStart,
      to: yEnd,
      label: "Yesterday's Cash Flow",
    };
  }

  if (key === 'week') {
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0).getTime();
    return {
      from: weekStart,
      to: endOfToday,
      label: 'Last 7 Days Cash Flow',
    };
  }

  // month
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0).getTime();
  return {
    from: monthStart,
    to: endOfToday,
    label: 'This Month Cash Flow',
  };
}

export function MoneyFlowPage() {
  const [timeframe, setTimeframe] = useState<TimeframeKey>('today');
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [savingWithdraw, setSavingWithdraw] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const { from, to, label } = useMemo(() => getTimeframeBounds(timeframe), [timeframe]);

  const transactions = useLiveQuery(
    () =>
      db.moneyTransactions
        .where('createdAt')
        .between(from, to, true, true)
        .reverse()
        .toArray(),
    [from, to]
  );

  const totals = useMemo(() => {
    const list = transactions ?? [];
    const byType = (type: string) =>
      sumPaisa(list.filter((t) => t.type === type).map((t) => t.amount));

    const cashSales = byType('CASH_SALE');
    const cardSales = byType('CARD_SALE');
    const creditSales = byType('CREDIT_SALE');
    const expenses = byType('EXPENSE');
    const withdrawals = byType('WITHDRAWAL');

    const totalInflow = cashSales + cardSales + creditSales;
    const totalOutflow = expenses + withdrawals;
    const netBalance = totalInflow - totalOutflow;

    // Estimated Cash in Till (Physical cash movement)
    const netCashInDrawer = cashSales - expenses - withdrawals;

    return {
      cashSales,
      cardSales,
      creditSales,
      expenses,
      withdrawals,
      totalInflow,
      totalOutflow,
      netBalance,
      netCashInDrawer,
      count: list.length,
    };
  }, [transactions]);

  async function handleWithdraw() {
    const amt = parseFloat(withdrawAmount || '0');
    if (isNaN(amt) || amt <= 0) {
      alert('Please enter a valid withdrawal amount.');
      return;
    }

    setSavingWithdraw(true);
    try {
      await recordWithdrawal(toPaisa(amt));
      setToast(`Recorded cash withdrawal of Rs. ${amt}`);
      setWithdrawAmount('');
      setShowWithdrawModal(false);
    } catch (err: any) {
      alert(err.message || 'Failed to record withdrawal');
    } finally {
      setSavingWithdraw(false);
    }
  }

  function formatTxnType(type: string): { label: string; isPositive: boolean; icon: string } {
    switch (type) {
      case 'CASH_SALE':
        return { label: 'Cash Sale', isPositive: true, icon: '💵' };
      case 'CARD_SALE':
        return { label: 'Card Sale', isPositive: true, icon: '💳' };
      case 'CREDIT_SALE':
        return { label: 'Credit Sale (Udhar)', isPositive: true, icon: '📝' };
      case 'EXPENSE':
        return { label: 'Expense Outflow', isPositive: false, icon: '💸' };
      case 'WITHDRAWAL':
        return { label: 'Cash Withdrawal', isPositive: false, icon: '🏦' };
      default:
        return { label: type, isPositive: true, icon: '💰' };
    }
  }

  return (
    <div className="moneyflow-page-modern">
      {/* Page Header */}
      <div className="moneyflow-page__header">
        <div>
          <h2 className="moneyflow-title">Money Flow & Cash Drawer</h2>
          <p className="moneyflow-subtitle">
            Real-time monitoring of cash entering (sales) and exiting (expenses & withdrawals) the business.
          </p>
        </div>

        <button
          className="btn btn-primary btn-large"
          onClick={() => setShowWithdrawModal(true)}
        >
          + Record Cash Withdrawal
        </button>
      </div>

      {/* Timeframe Filter Bar */}
      <div className="moneyflow-filter-card">
        <div className="filter-chips-group">
          <span className="filter-label">📅 Period:</span>
          <button
            className={`filter-chip ${timeframe === 'today' ? 'filter-chip--active' : ''}`}
            onClick={() => setTimeframe('today')}
          >
            Today
          </button>
          <button
            className={`filter-chip ${timeframe === 'yesterday' ? 'filter-chip--active' : ''}`}
            onClick={() => setTimeframe('yesterday')}
          >
            Yesterday
          </button>
          <button
            className={`filter-chip ${timeframe === 'week' ? 'filter-chip--active' : ''}`}
            onClick={() => setTimeframe('week')}
          >
            Last 7 Days
          </button>
          <button
            className={`filter-chip ${timeframe === 'month' ? 'filter-chip--active' : ''}`}
            onClick={() => setTimeframe('month')}
          >
            This Month
          </button>
        </div>

        <div className="moneyflow-period-tag">
          <strong>{label}</strong> ({totals.count} cash events)
        </div>
      </div>

      {/* Primary 3 Metric Summary Cards */}
      <div className="moneyflow-metric-grid">
        <div className="flow-card flow-card--inflow">
          <div className="flow-card__top">
            <span className="flow-card__badge">🟢 Total Inflow (Money In)</span>
            <span className="flow-card__icon">📥</span>
          </div>
          <div className="flow-card__val text-success">
            + {formatMoney(totals.totalInflow)}
          </div>
          <div className="flow-card__breakdown">
            <span>Cash: <strong>{formatMoney(totals.cashSales)}</strong></span>
            <span>Card: <strong>{formatMoney(totals.cardSales)}</strong></span>
            <span>Credit: <strong>{formatMoney(totals.creditSales)}</strong></span>
          </div>
        </div>

        <div className="flow-card flow-card--outflow">
          <div className="flow-card__top">
            <span className="flow-card__badge flow-card__badge--red">🔴 Total Outflow (Money Out)</span>
            <span className="flow-card__icon">📤</span>
          </div>
          <div className="flow-card__val text-danger">
            - {formatMoney(totals.totalOutflow)}
          </div>
          <div className="flow-card__breakdown">
            <span>Expenses: <strong>{formatMoney(totals.expenses)}</strong></span>
            <span>Withdrawals: <strong>{formatMoney(totals.withdrawals)}</strong></span>
          </div>
        </div>

        <div className={`flow-card ${totals.netBalance >= 0 ? 'flow-card--net-pos' : 'flow-card--net-neg'}`}>
          <div className="flow-card__top">
            <span className="flow-card__badge flow-card__badge--neutral">⚖️ Net Money Balance</span>
            <span className="flow-card__icon">💼</span>
          </div>
          <div className="flow-card__val">
            {totals.netBalance >= 0 ? `+ ${formatMoney(totals.netBalance)}` : `- ${formatMoney(Math.abs(totals.netBalance))}`}
          </div>
          <div className="flow-card__sub">
            Total Inflows minus Total Outflows
          </div>
        </div>
      </div>

      {/* Inflow vs Outflow Detailed Breakdown Cards */}
      <div className="moneyflow-breakdown-grid">
        {/* Inflow Details */}
        <div className="breakdown-card">
          <h3 className="breakdown-card__title">
            <span>📥</span> Incoming Channels (Money In)
          </h3>
          <div className="breakdown-list">
            <div className="breakdown-row">
              <div className="breakdown-row__left">
                <span className="row-icon">💵</span>
                <div>
                  <strong>Cash Sales</strong>
                  <span className="row-desc">Direct physical cash collected</span>
                </div>
              </div>
              <span className="row-amount text-success">
                + {formatMoney(totals.cashSales)}
              </span>
            </div>

            <div className="breakdown-row">
              <div className="breakdown-row__left">
                <span className="row-icon">💳</span>
                <div>
                  <strong>Card / Online Sales</strong>
                  <span className="row-desc">Bank & electronic payments</span>
                </div>
              </div>
              <span className="row-amount text-success">
                + {formatMoney(totals.cardSales)}
              </span>
            </div>

            <div className="breakdown-row">
              <div className="breakdown-row__left">
                <span className="row-icon">📝</span>
                <div>
                  <strong>Credit Sales (Udhar)</strong>
                  <span className="row-desc">Pending receivable orders</span>
                </div>
              </div>
              <span className="row-amount text-muted">
                + {formatMoney(totals.creditSales)}
              </span>
            </div>

            <div className="breakdown-total-row">
              <span>Total Inflow</span>
              <strong className="text-success">+ {formatMoney(totals.totalInflow)}</strong>
            </div>
          </div>
        </div>

        {/* Outflow Details */}
        <div className="breakdown-card">
          <h3 className="breakdown-card__title">
            <span>📤</span> Outgoing Deductions (Money Out)
          </h3>
          <div className="breakdown-list">
            <div className="breakdown-row">
              <div className="breakdown-row__left">
                <span className="row-icon">💸</span>
                <div>
                  <strong>Operational Expenses</strong>
                  <span className="row-desc">Supplies, daily wages, utilities</span>
                </div>
              </div>
              <span className="row-amount text-danger">
                - {formatMoney(totals.expenses)}
              </span>
            </div>

            <div className="breakdown-row">
              <div className="breakdown-row__left">
                <span className="row-icon">🏦</span>
                <div>
                  <strong>Cash Withdrawals</strong>
                  <span className="row-desc">Owner drawings / till deposits</span>
                </div>
              </div>
              <span className="row-amount text-danger">
                - {formatMoney(totals.withdrawals)}
              </span>
            </div>

            <div className="breakdown-total-row">
              <span>Total Outflow</span>
              <strong className="text-danger">- {formatMoney(totals.totalOutflow)}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Cash Flow Log Table */}
      <div className="moneyflow-history-card">
        <div className="history-header">
          <h3 className="history-title">⏱️ Money Flow Activity Log</h3>
          <span className="history-subtitle">Showing recent money movements for {label}</span>
        </div>

        <table className="moneyflow-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Transaction Type</th>
              <th>Direction</th>
              <th style={{ textAlign: 'right' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {(transactions ?? []).map((t) => {
              const info = formatTxnType(t.type);
              const d = new Date(t.createdAt);
              return (
                <tr key={t.id}>
                  <td className="mf-time-cell">
                    <div className="mf-time-main">
                      {d.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className="mf-time-sub">
                      {d.toLocaleDateString('en-PK', { month: 'short', day: 'numeric' })}
                    </div>
                  </td>

                  <td>
                    <span className="mf-type-badge">
                      {info.icon} {info.label}
                    </span>
                  </td>

                  <td>
                    <span className={`direction-pill ${info.isPositive ? 'direction-pill--in' : 'direction-pill--out'}`}>
                      {info.isPositive ? '📥 Inflow' : '📤 Outflow'}
                    </span>
                  </td>

                  <td style={{ textAlign: 'right' }}>
                    <span className={`mf-amount-text ${info.isPositive ? 'text-success' : 'text-danger'}`}>
                      {info.isPositive ? `+ ${formatMoney(t.amount)}` : `- ${formatMoney(t.amount)}`}
                    </span>
                  </td>
                </tr>
              );
            })}

            {transactions && transactions.length === 0 && (
              <tr>
                <td colSpan={4} className="mf-empty-cell">
                  <div className="empty-state-wrap">
                    <span className="empty-icon">💼</span>
                    <p className="empty-title">No money flow transactions</p>
                    <p className="empty-desc">
                      Transactions recorded from sales, expenses, and withdrawals will appear here in real time.
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Record Withdrawal Modal */}
      {showWithdrawModal && (
        <div className="modal-overlay" onClick={() => setShowWithdrawModal(false)}>
          <div
            className="modal-card withdraw-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h3 className="modal-title">🏦 Record Cash Withdrawal</h3>
                <span className="modal-subtitle">
                  Remove cash from the register for owner drawings or bank deposit.
                </span>
              </div>
              <button
                className="btn-icon"
                onClick={() => setShowWithdrawModal(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="modal-body withdraw-modal-body">
              <div className="form-group">
                <label className="form-label">
                  Withdrawal Amount (Rs.) <span className="text-danger">*</span>
                </label>
                <div className="currency-input-wrap">
                  <span className="currency-prefix">Rs.</span>
                  <input
                    type="number"
                    min={0}
                    step="1"
                    placeholder="0"
                    autoFocus
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    className="form-input currency-input"
                  />
                </div>
              </div>

              {/* Quick Amount Chips */}
              <div className="quick-amount-row">
                <span className="quick-amount-label">Quick select:</span>
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

              <div className="moneyflow-modal-tip">
                💡 This will deduct cash from the till register balance. For hotel purchasing costs (e.g. milk, gas), please use the <strong>Expenses</strong> section instead.
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setShowWithdrawModal(false)}
                disabled={savingWithdraw}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-large"
                onClick={handleWithdraw}
                disabled={savingWithdraw || !withdrawAmount}
              >
                {savingWithdraw ? 'Saving...' : 'Confirm Withdrawal'}
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
