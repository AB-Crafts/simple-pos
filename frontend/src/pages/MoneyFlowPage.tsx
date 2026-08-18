import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../database/db';
import { recordWithdrawal } from '../services/moneyFlowService';
import { formatMoney, sumPaisa, toPaisa } from '../utils/money';

function startOfDay(d: Date) {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c.getTime();
}

/**
 * Money Flow tracks cash moving in and out of the business today.
 * This is NOT profit — profit needs cost of goods, which lives on the
 * Reports page. Money Flow only answers "how much cash do I have".
 */
export function MoneyFlowPage() {
  const since = useMemo(() => startOfDay(new Date()), []);

  const transactions = useLiveQuery(
    () => db.moneyTransactions.where('createdAt').aboveOrEqual(since).toArray(),
    [since]
  );

  const totals = useMemo(() => {
    const list = transactions ?? [];
    const byType = (type: string) => sumPaisa(list.filter((t) => t.type === type).map((t) => t.amount));

    const cashSales = byType('CASH_SALE');
    const cardSales = byType('CARD_SALE');
    const creditSales = byType('CREDIT_SALE');
    const expenses = byType('EXPENSE');
    const withdrawals = byType('WITHDRAWAL');

    const inflow = cashSales + cardSales + creditSales;
    const outflow = expenses + withdrawals;
    const net = inflow - outflow;

    return { cashSales, cardSales, creditSales, expenses, withdrawals, net };
  }, [transactions]);

  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');

  async function handleWithdraw() {
    const amount = toPaisa(parseFloat(withdrawAmount || '0'));
    if (amount <= 0) return;
    await recordWithdrawal(amount);
    setWithdrawAmount('');
    setShowWithdraw(false);
  }

  return (
    <div className="moneyflow-page">
      <div className="moneyflow-page__toolbar">
        <h2 className="moneyflow-page__heading">Today</h2>
        <button className="primary-btn" onClick={() => setShowWithdraw(true)}>
          + RECORD WITHDRAWAL
        </button>
      </div>

      <div className="moneyflow-card">
        <div className="moneyflow-row">
          <span>Cash Sales</span>
          <span className="moneyflow-row__in">+ {formatMoney(totals.cashSales)}</span>
        </div>
        <div className="moneyflow-row">
          <span>Card Sales</span>
          <span className="moneyflow-row__in">+ {formatMoney(totals.cardSales)}</span>
        </div>
        <div className="moneyflow-row">
          <span>Credit Sales</span>
          <span className="moneyflow-row__in">+ {formatMoney(totals.creditSales)}</span>
        </div>
        <div className="moneyflow-row">
          <span>Expenses</span>
          <span className="moneyflow-row__out">- {formatMoney(totals.expenses)}</span>
        </div>
        <div className="moneyflow-row">
          <span>Withdrawals</span>
          <span className="moneyflow-row__out">- {formatMoney(totals.withdrawals)}</span>
        </div>

        <div className="moneyflow-divider" />

        <div className="moneyflow-row moneyflow-row--net">
          <span>Net Cash Flow</span>
          <span className={totals.net >= 0 ? 'moneyflow-row__in' : 'moneyflow-row__out'}>
            {formatMoney(totals.net)}
          </span>
        </div>
      </div>

      <p className="moneyflow-page__note">
        This is cash flow, not profit. Profit accounts for cost of goods sold — see Reports.
      </p>

      {showWithdraw && (
        <div className="modal-backdrop" onClick={() => setShowWithdraw(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Record Withdrawal</h3>
            <label>
              Amount (Rs.)
              <input
                type="number"
                min={0}
                step="0.01"
                autoFocus
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
              />
            </label>
            <div className="modal__actions">
              <button onClick={() => setShowWithdraw(false)}>Cancel</button>
              <button className="primary-btn" onClick={handleWithdraw}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
