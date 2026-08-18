import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../database/db';
import { formatMoney, sumPaisa } from '../utils/money';

type RangeKey = 'today' | 'week' | 'month' | 'custom';

function getRange(key: RangeKey, customFrom: string, customTo: string): { from: number; to: number } {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (key === 'today') {
    return { from: startOfToday.getTime(), to: Date.now() };
  }
  if (key === 'week') {
    const from = new Date(startOfToday);
    from.setDate(from.getDate() - 6); // last 7 days inclusive of today
    return { from: from.getTime(), to: Date.now() };
  }
  if (key === 'month') {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: from.getTime(), to: Date.now() };
  }
  // custom
  const from = customFrom ? new Date(customFrom).getTime() : startOfToday.getTime();
  const toDate = customTo ? new Date(customTo) : now;
  toDate.setHours(23, 59, 59, 999);
  return { from, to: toDate.getTime() };
}

export function ReportsPage() {
  const [range, setRange] = useState<RangeKey>('today');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const { from, to } = useMemo(() => getRange(range, customFrom, customTo), [range, customFrom, customTo]);

  const sales = useLiveQuery(
    () =>
      db.sales
        .where('createdAt')
        .between(from, to, true, true)
        .and((s) => !s.voided)
        .toArray(),
    [from, to]
  );

  const expenses = useLiveQuery(
    () => db.expenses.where('createdAt').between(from, to, true, true).toArray(),
    [from, to]
  );

  const saleIds = useMemo(() => (sales ?? []).map((s) => s.id), [sales]);

  const saleItems = useLiveQuery(async () => {
    if (saleIds.length === 0) return [];
    return db.saleItems.where('saleId').anyOf(saleIds).toArray();
  }, [saleIds]);

  const totals = useMemo(() => {
    const totalSales = sumPaisa((sales ?? []).map((s) => s.total));
    const totalExpenses = sumPaisa((expenses ?? []).map((e) => e.amount));

    return { totalSales, totalExpenses };
  }, [sales, expenses]);

  // Uses the cost-price snapshot stored on each sale item at the time of
  // sale (not the product's current cost price), so past reports never
  // shift if a product's cost is edited later.
  const cogs = useMemo(() => {
    const items = saleItems ?? [];
    return sumPaisa(items.map((i) => i.costPrice * i.quantity));
  }, [saleItems]);

  const grossProfit = totals.totalSales - (cogs ?? 0);
  const netProfit = grossProfit - totals.totalExpenses;

  return (
    <div className="reports-page">
      <div className="reports-page__tabs">
        <button
          className={`reports-tab ${range === 'today' ? 'reports-tab--active' : ''}`}
          onClick={() => setRange('today')}
        >
          TODAY
        </button>
        <button
          className={`reports-tab ${range === 'week' ? 'reports-tab--active' : ''}`}
          onClick={() => setRange('week')}
        >
          THIS WEEK
        </button>
        <button
          className={`reports-tab ${range === 'month' ? 'reports-tab--active' : ''}`}
          onClick={() => setRange('month')}
        >
          THIS MONTH
        </button>
        <button
          className={`reports-tab ${range === 'custom' ? 'reports-tab--active' : ''}`}
          onClick={() => setRange('custom')}
        >
          CUSTOM DATE
        </button>
      </div>

      {range === 'custom' && (
        <div className="reports-page__custom-range">
          <label>
            From
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
          </label>
          <label>
            To
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
          </label>
        </div>
      )}

      <div className="report-card">
        <div className="report-row">
          <span>Total Sales</span>
          <span className="report-row__value">{formatMoney(totals.totalSales)}</span>
        </div>
        <div className="report-row">
          <span>Total Expenses</span>
          <span className="report-row__value">{formatMoney(totals.totalExpenses)}</span>
        </div>
        <div className="report-row">
          <span>Cost of Goods</span>
          <span className="report-row__value">{formatMoney(cogs ?? 0)}</span>
        </div>

        <div className="moneyflow-divider" />

        <div className="report-row">
          <span>Gross Profit</span>
          <span className="report-row__value">{formatMoney(grossProfit)}</span>
        </div>
        <div className="report-row report-row--net">
          <span>Net Profit</span>
          <span className="report-row__value">{formatMoney(netProfit)}</span>
        </div>
      </div>

      <p className="reports-page__note">
        Gross Profit = Sales − Cost of Goods. Net Profit = Gross Profit − Expenses.
      </p>
    </div>
  );
}
