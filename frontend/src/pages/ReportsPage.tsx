import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../database/db';
import { formatMoney, sumPaisa } from '../utils/money';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

type PresetKey =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'last_week'
  | 'last_7_days'
  | 'this_month'
  | 'last_month'
  | 'last_30_days'
  | 'this_year'
  | 'specific_day'
  | 'specific_month'
  | 'custom_range';

function getDaysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function formatDateDisplay(d: Date): string {
  return d.toLocaleDateString('en-PK', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function ReportsPage() {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  const currentDay = today.getDate();

  // Preset selection
  const [preset, setPreset] = useState<PresetKey>('today');

  // Specific single day dropdowns
  const [singleYear, setSingleYear] = useState<number>(currentYear);
  const [singleMonth, setSingleMonth] = useState<number>(currentMonth);
  const [singleDay, setSingleDay] = useState<number>(currentDay);

  // Specific month dropdowns
  const [monthYear, setMonthYear] = useState<number>(currentYear);
  const [monthMonth, setMonthMonth] = useState<number>(currentMonth);

  // Custom date range dropdowns (From & To)
  const [fromYear, setFromYear] = useState<number>(currentYear);
  const [fromMonth, setFromMonth] = useState<number>(currentMonth);
  const [fromDay, setFromDay] = useState<number>(1);

  const [toYear, setToYear] = useState<number>(currentYear);
  const [toMonth, setToMonth] = useState<number>(currentMonth);
  const [toDay, setToDay] = useState<number>(currentDay);

  // Calculate milliseconds range [from, to]
  const { from, to, label } = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();

    if (preset === 'today') {
      return {
        from: startOfToday,
        to: endOfToday,
        label: `Today (${formatDateDisplay(now)})`,
      };
    }

    if (preset === 'yesterday') {
      const yStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0).getTime();
      const yEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999).getTime();
      return {
        from: yStart,
        to: yEnd,
        label: `Yesterday (${formatDateDisplay(new Date(yStart))})`,
      };
    }

    if (preset === 'this_week') {
      const dayOfWeek = now.getDay(); // 0 = Sun, 1 = Mon ...
      const diffToMonday = (dayOfWeek + 6) % 7; // Monday as start of week
      const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday, 0, 0, 0, 0);
      return {
        from: startOfWeek.getTime(),
        to: endOfToday,
        label: `This Week (${formatDateDisplay(startOfWeek)} – Today)`,
      };
    }

    if (preset === 'last_week') {
      const dayOfWeek = now.getDay();
      const diffToMonday = (dayOfWeek + 6) % 7;
      const startOfLastWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday - 7, 0, 0, 0, 0);
      const endOfLastWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday - 1, 23, 59, 59, 999);
      return {
        from: startOfLastWeek.getTime(),
        to: endOfLastWeek.getTime(),
        label: `Last Week (${formatDateDisplay(startOfLastWeek)} – ${formatDateDisplay(endOfLastWeek)})`,
      };
    }

    if (preset === 'last_7_days') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0);
      return {
        from: start.getTime(),
        to: endOfToday,
        label: `Last 7 Days (${formatDateDisplay(start)} – Today)`,
      };
    }

    if (preset === 'this_month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      return {
        from: startOfMonth.getTime(),
        to: endOfToday,
        label: `This Month (${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()})`,
      };
    }

    if (preset === 'last_month') {
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      const days = getDaysInMonth(startOfLastMonth.getFullYear(), startOfLastMonth.getMonth());
      const endOfLastMonth = new Date(startOfLastMonth.getFullYear(), startOfLastMonth.getMonth(), days, 23, 59, 59, 999);
      return {
        from: startOfLastMonth.getTime(),
        to: endOfLastMonth.getTime(),
        label: `Last Month (${MONTH_NAMES[startOfLastMonth.getMonth()]} ${startOfLastMonth.getFullYear()})`,
      };
    }

    if (preset === 'last_30_days') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29, 0, 0, 0, 0);
      return {
        from: start.getTime(),
        to: endOfToday,
        label: `Last 30 Days (${formatDateDisplay(start)} – Today)`,
      };
    }

    if (preset === 'this_year') {
      const startOfYear = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      return {
        from: startOfYear.getTime(),
        to: endOfToday,
        label: `Year ${now.getFullYear()} (${formatDateDisplay(startOfYear)} – Today)`,
      };
    }

    if (preset === 'specific_day') {
      const maxDays = getDaysInMonth(singleYear, singleMonth);
      const validDay = Math.min(singleDay, maxDays);
      const start = new Date(singleYear, singleMonth, validDay, 0, 0, 0, 0).getTime();
      const end = new Date(singleYear, singleMonth, validDay, 23, 59, 59, 999).getTime();
      return {
        from: start,
        to: end,
        label: `Day: ${formatDateDisplay(new Date(start))}`,
      };
    }

    if (preset === 'specific_month') {
      const days = getDaysInMonth(monthYear, monthMonth);
      const start = new Date(monthYear, monthMonth, 1, 0, 0, 0, 0).getTime();
      const end = new Date(monthYear, monthMonth, days, 23, 59, 59, 999).getTime();
      return {
        from: start,
        to: end,
        label: `Month: ${MONTH_NAMES[monthMonth]} ${monthYear}`,
      };
    }

    // custom_range
    const maxFromDays = getDaysInMonth(fromYear, fromMonth);
    const validFromDay = Math.min(fromDay, maxFromDays);
    const start = new Date(fromYear, fromMonth, validFromDay, 0, 0, 0, 0).getTime();

    const maxToDays = getDaysInMonth(toYear, toMonth);
    const validToDay = Math.min(toDay, maxToDays);
    const end = new Date(toYear, toMonth, validToDay, 23, 59, 59, 999).getTime();

    return {
      from: start,
      to: end,
      label: `Custom Range: ${formatDateDisplay(new Date(start))} – ${formatDateDisplay(new Date(end))}`,
    };
  }, [
    preset,
    singleYear,
    singleMonth,
    singleDay,
    monthYear,
    monthMonth,
    fromYear,
    fromMonth,
    fromDay,
    toYear,
    toMonth,
    toDay,
  ]);

  // Query sales & expenses in the selected date range
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

  // Aggregate metrics
  const totals = useMemo(() => {
    const validSales = sales ?? [];
    const validExpenses = expenses ?? [];
    const totalSales = sumPaisa(validSales.map((s) => s.total));
    const totalExpenses = sumPaisa(validExpenses.map((e) => e.amount));
    const totalOrders = validSales.length;
    const paidOrders = validSales.filter((s) => s.status === 'PAID').length;
    const pendingOrders = validSales.filter((s) => s.status === 'PENDING').length;
    const dineInOrders = validSales.filter((s) => s.orderType === 'DINE_IN').length;
    const takeawayOrders = validSales.filter((s) => s.orderType === 'TAKE_AWAY').length;

    // Payment methods breakdown
    const cashSales = sumPaisa(validSales.filter((s) => s.paymentMethod === 'CASH').map((s) => s.total));
    const cardSales = sumPaisa(validSales.filter((s) => s.paymentMethod === 'CARD').map((s) => s.total));
    const creditSales = sumPaisa(validSales.filter((s) => s.paymentMethod === 'CREDIT').map((s) => s.total));

    return {
      totalSales,
      totalExpenses,
      totalOrders,
      paidOrders,
      pendingOrders,
      dineInOrders,
      takeawayOrders,
      cashSales,
      cardSales,
      creditSales,
    };
  }, [sales, expenses]);

  // COGS and department revenue breakdown
  const { cogs, deptBreakdown } = useMemo(() => {
    const items = saleItems ?? [];
    const cogsTotal = sumPaisa(items.map((i) => (i.costPrice || 0) * i.quantity));

    let chaiRevenue = 0;
    let chaiQty = 0;
    let parhataRevenue = 0;
    let parhataQty = 0;
    let generalRevenue = 0;
    let generalQty = 0;

    for (const item of items) {
      const dept = item.department;
      if (dept === 'CHAI') {
        chaiRevenue += item.total;
        chaiQty += item.quantity;
      } else if (dept === 'PARHATA') {
        parhataRevenue += item.total;
        parhataQty += item.quantity;
      } else {
        generalRevenue += item.total;
        generalQty += item.quantity;
      }
    }

    return {
      cogs: cogsTotal,
      deptBreakdown: {
        chaiRevenue,
        chaiQty,
        parhataRevenue,
        parhataQty,
        generalRevenue,
        generalQty,
      },
    };
  }, [saleItems]);

  const grossProfit = totals.totalSales - cogs;
  const netProfit = grossProfit - totals.totalExpenses;
  const netMargin = totals.totalSales > 0 ? Math.round((netProfit / totals.totalSales) * 100) : 0;

  // Year options list
  const yearOptions = [currentYear + 1, currentYear, currentYear - 1, currentYear - 2];

  return (
    <div className="reports-page-modern">
      {/* Header */}
      <div className="reports-header">
        <div>
          <h2 className="reports-title">Business & Financial Reports</h2>
          <p className="reports-subtitle">
            Analyze hotel sales, gross & net profits, expenses, departmental revenue, and order trends.
          </p>
        </div>
      </div>

      {/* Date Filter Selection Card with Dropdowns */}
      <div className="reports-date-picker-card">
        <div className="date-picker-top-row">
          <div className="preset-dropdown-group">
            <label className="date-picker-label">
              <span>📅</span> Select Report Period:
            </label>
            <select
              value={preset}
              onChange={(e) => setPreset(e.target.value as PresetKey)}
              className="reports-preset-select"
            >
              <optgroup label="⚡ Quick Presets">
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="this_week">This Week (Mon – Today)</option>
                <option value="last_week">Last Week (Mon – Sun)</option>
                <option value="last_7_days">Last 7 Days</option>
                <option value="this_month">This Month ({MONTH_NAMES[currentMonth]})</option>
                <option value="last_month">Last Month ({MONTH_NAMES[(currentMonth + 11) % 12]})</option>
                <option value="last_30_days">Last 30 Days</option>
                <option value="this_year">This Year ({currentYear})</option>
              </optgroup>
              <optgroup label="🗓️ Custom Dropdown Pickers">
                <option value="specific_day">Pick Specific Single Day</option>
                <option value="specific_month">Pick Specific Month & Year</option>
                <option value="custom_range">Pick Custom Date Range (From / To)</option>
              </optgroup>
            </select>
          </div>

          {/* Quick preset pill buttons for 1-click access */}
          <div className="quick-preset-pills">
            <button
              type="button"
              className={`pill-btn ${preset === 'today' ? 'pill-btn--active' : ''}`}
              onClick={() => setPreset('today')}
            >
              Today
            </button>
            <button
              type="button"
              className={`pill-btn ${preset === 'yesterday' ? 'pill-btn--active' : ''}`}
              onClick={() => setPreset('yesterday')}
            >
              Yesterday
            </button>
            <button
              type="button"
              className={`pill-btn ${preset === 'last_7_days' ? 'pill-btn--active' : ''}`}
              onClick={() => setPreset('last_7_days')}
            >
              Last 7 Days
            </button>
            <button
              type="button"
              className={`pill-btn ${preset === 'this_month' ? 'pill-btn--active' : ''}`}
              onClick={() => setPreset('this_month')}
            >
              This Month
            </button>
          </div>
        </div>

        {/* 1. Specific Single Day Dropdown Selectors */}
        {preset === 'specific_day' && (
          <div className="custom-dropdowns-panel">
            <div className="custom-panel-title">🗓️ Select Exact Day:</div>
            <div className="dropdowns-row">
              <div className="dropdown-field">
                <label>Day</label>
                <select
                  value={singleDay}
                  onChange={(e) => setSingleDay(parseInt(e.target.value, 10))}
                  className="form-select date-select"
                >
                  {Array.from({ length: getDaysInMonth(singleYear, singleMonth) }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div className="dropdown-field">
                <label>Month</label>
                <select
                  value={singleMonth}
                  onChange={(e) => setSingleMonth(parseInt(e.target.value, 10))}
                  className="form-select date-select"
                >
                  {MONTH_NAMES.map((m, idx) => (
                    <option key={m} value={idx}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div className="dropdown-field">
                <label>Year</label>
                <select
                  value={singleYear}
                  onChange={(e) => setSingleYear(parseInt(e.target.value, 10))}
                  className="form-select date-select"
                >
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* 2. Specific Month Dropdown Selectors */}
        {preset === 'specific_month' && (
          <div className="custom-dropdowns-panel">
            <div className="custom-panel-title">🗓️ Select Month & Year:</div>
            <div className="dropdowns-row">
              <div className="dropdown-field">
                <label>Month</label>
                <select
                  value={monthMonth}
                  onChange={(e) => setMonthMonth(parseInt(e.target.value, 10))}
                  className="form-select date-select"
                >
                  {MONTH_NAMES.map((m, idx) => (
                    <option key={m} value={idx}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div className="dropdown-field">
                <label>Year</label>
                <select
                  value={monthYear}
                  onChange={(e) => setMonthYear(parseInt(e.target.value, 10))}
                  className="form-select date-select"
                >
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* 3. Custom Date Range Dropdowns (From / To) */}
        {preset === 'custom_range' && (
          <div className="custom-dropdowns-panel">
            <div className="custom-panel-title">🗓️ Select Date Range (From & To):</div>
            <div className="custom-range-grid">
              {/* FROM */}
              <div className="range-box">
                <div className="range-box-title">Start Date (From):</div>
                <div className="dropdowns-row">
                  <div className="dropdown-field">
                    <label>Day</label>
                    <select
                      value={fromDay}
                      onChange={(e) => setFromDay(parseInt(e.target.value, 10))}
                      className="form-select date-select"
                    >
                      {Array.from({ length: getDaysInMonth(fromYear, fromMonth) }, (_, i) => i + 1).map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="dropdown-field">
                    <label>Month</label>
                    <select
                      value={fromMonth}
                      onChange={(e) => setFromMonth(parseInt(e.target.value, 10))}
                      className="form-select date-select"
                    >
                      {MONTH_NAMES.map((m, idx) => (
                        <option key={m} value={idx}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="dropdown-field">
                    <label>Year</label>
                    <select
                      value={fromYear}
                      onChange={(e) => setFromYear(parseInt(e.target.value, 10))}
                      className="form-select date-select"
                    >
                      {yearOptions.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* TO */}
              <div className="range-box">
                <div className="range-box-title">End Date (To):</div>
                <div className="dropdowns-row">
                  <div className="dropdown-field">
                    <label>Day</label>
                    <select
                      value={toDay}
                      onChange={(e) => setToDay(parseInt(e.target.value, 10))}
                      className="form-select date-select"
                    >
                      {Array.from({ length: getDaysInMonth(toYear, toMonth) }, (_, i) => i + 1).map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="dropdown-field">
                    <label>Month</label>
                    <select
                      value={toMonth}
                      onChange={(e) => setToMonth(parseInt(e.target.value, 10))}
                      className="form-select date-select"
                    >
                      {MONTH_NAMES.map((m, idx) => (
                        <option key={m} value={idx}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="dropdown-field">
                    <label>Year</label>
                    <select
                      value={toYear}
                      onChange={(e) => setToYear(parseInt(e.target.value, 10))}
                      className="form-select date-select"
                    >
                      {yearOptions.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Active Period Display Banner */}
        <div className="active-period-banner">
          <div className="period-badge-text">
            <span>📊 Showing:</span> <strong>{label}</strong>
          </div>
          <div className="period-order-count">
            {totals.totalOrders} Total Orders ({totals.paidOrders} Settled, {totals.pendingOrders} Active)
          </div>
        </div>
      </div>

      {/* Primary Financial Metric Summary Cards */}
      <div className="reports-metric-cards-grid">
        <div className="metric-card metric-card--sales">
          <span className="metric-card__title">Total Gross Sales</span>
          <span className="metric-card__val">{formatMoney(totals.totalSales)}</span>
          <span className="metric-card__sub">{totals.totalOrders} total sales transactions</span>
        </div>

        <div className="metric-card metric-card--cogs">
          <span className="metric-card__title">Cost of Goods (COGS)</span>
          <span className="metric-card__val">{formatMoney(cogs)}</span>
          <span className="metric-card__sub">Product purchase costs</span>
        </div>

        <div className="metric-card metric-card--gross">
          <span className="metric-card__title">Gross Profit</span>
          <span className="metric-card__val text-success">{formatMoney(grossProfit)}</span>
          <span className="metric-card__sub">Sales − Cost of Goods</span>
        </div>

        <div className="metric-card metric-card--expenses">
          <span className="metric-card__title">Total Expenses</span>
          <span className="metric-card__val text-danger">{formatMoney(totals.totalExpenses)}</span>
          <span className="metric-card__sub">{expenses?.length ?? 0} expense records</span>
        </div>

        <div className={`metric-card metric-card--net ${netProfit >= 0 ? 'metric-card--net-pos' : 'metric-card--net-neg'}`}>
          <span className="metric-card__title">Net Profit</span>
          <span className="metric-card__val">{formatMoney(netProfit)}</span>
          <span className="metric-card__sub">
            {netMargin}% Net Margin (Gross Profit − Expenses)
          </span>
        </div>
      </div>

      {/* Detailed Analysis Section */}
      <div className="reports-analysis-grid">
        {/* Department Revenue Breakdown */}
        <div className="analysis-card">
          <h3 className="analysis-card__title">☕ Department Revenue Breakdown</h3>
          <div className="dept-breakdown-list">
            <div className="dept-breakdown-item">
              <div className="dept-item-header">
                <span className="dept-item-name">☕ Chai Department</span>
                <strong className="dept-item-val">{formatMoney(deptBreakdown.chaiRevenue)}</strong>
              </div>
              <div className="dept-item-sub">
                {deptBreakdown.chaiQty} cups / items sold
                {totals.totalSales > 0 && ` · ${Math.round((deptBreakdown.chaiRevenue / totals.totalSales) * 100)}% of sales`}
              </div>
            </div>

            <div className="dept-breakdown-item">
              <div className="dept-item-header">
                <span className="dept-item-name">🫓 Parhata Department</span>
                <strong className="dept-item-val">{formatMoney(deptBreakdown.parhataRevenue)}</strong>
              </div>
              <div className="dept-item-sub">
                {deptBreakdown.parhataQty} parhatas / items sold
                {totals.totalSales > 0 && ` · ${Math.round((deptBreakdown.parhataRevenue / totals.totalSales) * 100)}% of sales`}
              </div>
            </div>

            <div className="dept-breakdown-item">
              <div className="dept-item-header">
                <span className="dept-item-name">📦 General Menu Items</span>
                <strong className="dept-item-val">{formatMoney(deptBreakdown.generalRevenue)}</strong>
              </div>
              <div className="dept-item-sub">
                {deptBreakdown.generalQty} items sold
                {totals.totalSales > 0 && ` · ${Math.round((deptBreakdown.generalRevenue / totals.totalSales) * 100)}% of sales`}
              </div>
            </div>
          </div>
        </div>

        {/* Order Types & Payment Methods Breakdown */}
        <div className="analysis-card">
          <h3 className="analysis-card__title">💳 Payment & Order Channels</h3>
          <div className="channel-breakdown-list">
            <div className="channel-row">
              <span>🍽️ Dine-In Orders</span>
              <strong>{totals.dineInOrders} orders</strong>
            </div>
            <div className="channel-row">
              <span>🥡 Takeaway Orders</span>
              <strong>{totals.takeawayOrders} orders</strong>
            </div>
            <div className="channel-divider" />
            <div className="channel-row">
              <span>💵 Cash Collected</span>
              <strong>{formatMoney(totals.cashSales)}</strong>
            </div>
            <div className="channel-row">
              <span>💳 Card Payments</span>
              <strong>{formatMoney(totals.cardSales)}</strong>
            </div>
            <div className="channel-row">
              <span>📝 Credit (Udhar)</span>
              <strong>{formatMoney(totals.creditSales)}</strong>
            </div>
          </div>
        </div>
      </div>

      <p className="reports-page__note">
        💡 <strong>Accounting note:</strong> Gross Profit = Total Sales − Cost of Goods (COGS). Net Profit = Gross Profit − Recorded Expenses.
      </p>
    </div>
  );
}
