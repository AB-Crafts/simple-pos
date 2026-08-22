import { useEffect, useMemo, useState } from 'react';
import { apiClient } from '../services/apiClient';
import { formatMoney } from '../utils/money';

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

interface ReportData {
  from: number;
  to: number;
  totalSales: number;
  totalExpenses: number;
  cogs: number;
  grossProfit: number;
  netProfit: number;
  totalOrders: number;
  paidOrders: number;
  pendingOrders: number;
  dineInOrders: number;
  takeawayOrders: number;
  cashSales: number;
  cardSales: number;
  creditSales: number;
  deptBreakdown: {
    chaiRevenue: number;
    chaiQty: number;
    parhataRevenue: number;
    parhataQty: number;
    generalRevenue: number;
    generalQty: number;
  };
}

const defaultReport: ReportData = {
  from: 0,
  to: 0,
  totalSales: 0,
  totalExpenses: 0,
  cogs: 0,
  grossProfit: 0,
  netProfit: 0,
  totalOrders: 0,
  paidOrders: 0,
  pendingOrders: 0,
  dineInOrders: 0,
  takeawayOrders: 0,
  cashSales: 0,
  cardSales: 0,
  creditSales: 0,
  deptBreakdown: {
    chaiRevenue: 0,
    chaiQty: 0,
    parhataRevenue: 0,
    parhataQty: 0,
    generalRevenue: 0,
    generalQty: 0,
  },
};

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

  const [report, setReport] = useState<ReportData>(defaultReport);

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
      const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday, 0, 0, 0, 0).getTime();
      return {
        from: mon,
        to: endOfToday,
        label: `This Week (${formatDateDisplay(new Date(mon))} – Today)`,
      };
    }

    if (preset === 'last_week') {
      const dayOfWeek = now.getDay();
      const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const lastMon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday - 7, 0, 0, 0, 0).getTime();
      const lastSun = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday - 1, 23, 59, 59, 999).getTime();
      return {
        from: lastMon,
        to: lastSun,
        label: `Last Week (${formatDateDisplay(new Date(lastMon))} – ${formatDateDisplay(new Date(lastSun))})`,
      };
    }

    if (preset === 'last_7_days') {
      const start7 = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0).getTime();
      return {
        from: start7,
        to: endOfToday,
        label: `Last 7 Days (${formatDateDisplay(new Date(start7))} – Today)`,
      };
    }

    if (preset === 'this_month') {
      const startM = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0).getTime();
      return {
        from: startM,
        to: endOfToday,
        label: `This Month (${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()})`,
      };
    }

    if (preset === 'last_month') {
      const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
      const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
      const daysInPrev = getDaysInMonth(prevYear, prevMonth);
      const startLM = new Date(prevYear, prevMonth, 1, 0, 0, 0, 0).getTime();
      const endLM = new Date(prevYear, prevMonth, daysInPrev, 23, 59, 59, 999).getTime();
      return {
        from: startLM,
        to: endLM,
        label: `Last Month (${MONTH_NAMES[prevMonth]} ${prevYear})`,
      };
    }

    if (preset === 'last_30_days') {
      const start30 = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29, 0, 0, 0, 0).getTime();
      return {
        from: start30,
        to: endOfToday,
        label: `Last 30 Days (${formatDateDisplay(new Date(start30))} – Today)`,
      };
    }

    if (preset === 'this_year') {
      const startY = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0).getTime();
      return {
        from: startY,
        to: endOfToday,
        label: `This Year (${now.getFullYear()})`,
      };
    }

    if (preset === 'specific_day') {
      const maxDays = getDaysInMonth(singleYear, singleMonth);
      const day = Math.min(singleDay, maxDays);
      const start = new Date(singleYear, singleMonth, day, 0, 0, 0, 0).getTime();
      const end = new Date(singleYear, singleMonth, day, 23, 59, 59, 999).getTime();
      return {
        from: start,
        to: end,
        label: `Single Day: ${formatDateDisplay(new Date(start))}`,
      };
    }

    if (preset === 'specific_month') {
      const daysCount = getDaysInMonth(monthYear, monthMonth);
      const start = new Date(monthYear, monthMonth, 1, 0, 0, 0, 0).getTime();
      const end = new Date(monthYear, monthMonth, daysCount, 23, 59, 59, 999).getTime();
      return {
        from: start,
        to: end,
        label: `Month: ${MONTH_NAMES[monthMonth]} ${monthYear}`,
      };
    }

    // custom_range
    const fromMaxDays = getDaysInMonth(fromYear, fromMonth);
    const validFromDay = Math.min(fromDay, fromMaxDays);
    const toMaxDays = getDaysInMonth(toYear, toMonth);
    const validToDay = Math.min(toDay, toMaxDays);

    let start = new Date(fromYear, fromMonth, validFromDay, 0, 0, 0, 0).getTime();
    let end = new Date(toYear, toMonth, validToDay, 23, 59, 59, 999).getTime();

    if (start > end) {
      const temp = start;
      start = end;
      end = temp;
    }

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

  useEffect(() => {
    let mounted = true;

    async function fetchReport() {
      try {
        const data = await apiClient.get<ReportData>(`/reports/summary?from=${from}&to=${to}`);
        if (mounted) setReport(data);
      } catch (err) {
        console.error('Failed to load report summary:', err);
      }
    }

    fetchReport();
    return () => {
      mounted = false;
    };
  }, [from, to]);

  const netMargin = report.totalSales > 0 ? Math.round((report.netProfit / report.totalSales) * 100) : 0;
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
            <div className="custom-panel-title">🗓️ Select Exact Month & Year:</div>
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

        {/* 3. Custom Date Range (From – To) Dropdown Selectors */}
        {preset === 'custom_range' && (
          <div className="custom-dropdowns-panel">
            <div className="custom-range-two-col">
              {/* From Date */}
              <div className="range-column">
                <div className="range-col-title">🟢 From Date:</div>
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

              {/* To Date */}
              <div className="range-column">
                <div className="range-col-title">🔴 To Date:</div>
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

        {/* Selected Period Confirmation Banner */}
        <div className="selected-period-banner">
          <div className="period-badge-text">
            <span>📊 Showing:</span> <strong>{label}</strong>
          </div>
          <div className="period-order-count">
            {report.totalOrders} Total Orders ({report.paidOrders} Settled, {report.pendingOrders} Active)
          </div>
        </div>
      </div>

      {/* Primary Financial Metric Summary Cards */}
      <div className="reports-metric-cards-grid">
        <div className="metric-card metric-card--sales">
          <span className="metric-card__title">Total Gross Sales</span>
          <span className="metric-card__val">{formatMoney(report.totalSales)}</span>
          <span className="metric-card__sub">{report.totalOrders} total sales transactions</span>
        </div>

        <div className="metric-card metric-card--cogs">
          <span className="metric-card__title">Cost of Goods (COGS)</span>
          <span className="metric-card__val">{formatMoney(report.cogs)}</span>
          <span className="metric-card__sub">Product purchase costs</span>
        </div>

        <div className="metric-card metric-card--gross">
          <span className="metric-card__title">Gross Profit</span>
          <span className="metric-card__val text-success">{formatMoney(report.grossProfit)}</span>
          <span className="metric-card__sub">Sales − Cost of Goods</span>
        </div>

        <div className="metric-card metric-card--expenses">
          <span className="metric-card__title">Total Expenses</span>
          <span className="metric-card__val text-danger">{formatMoney(report.totalExpenses)}</span>
          <span className="metric-card__sub">Recorded operational costs</span>
        </div>

        <div className={`metric-card metric-card--net ${report.netProfit >= 0 ? 'metric-card--net-pos' : 'metric-card--net-neg'}`}>
          <span className="metric-card__title">Net Profit</span>
          <span className="metric-card__val">{formatMoney(report.netProfit)}</span>
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
                <strong className="dept-item-val">{formatMoney(report.deptBreakdown.chaiRevenue)}</strong>
              </div>
              <div className="dept-item-sub">
                {report.deptBreakdown.chaiQty} cups / items sold
                {report.totalSales > 0 && ` · ${Math.round((report.deptBreakdown.chaiRevenue / report.totalSales) * 100)}% of sales`}
              </div>
            </div>

            <div className="dept-breakdown-item">
              <div className="dept-item-header">
                <span className="dept-item-name">🫓 Parhata Department</span>
                <strong className="dept-item-val">{formatMoney(report.deptBreakdown.parhataRevenue)}</strong>
              </div>
              <div className="dept-item-sub">
                {report.deptBreakdown.parhataQty} parhatas / items sold
                {report.totalSales > 0 && ` · ${Math.round((report.deptBreakdown.parhataRevenue / report.totalSales) * 100)}% of sales`}
              </div>
            </div>

            <div className="dept-breakdown-item">
              <div className="dept-item-header">
                <span className="dept-item-name">📦 General Menu Items</span>
                <strong className="dept-item-val">{formatMoney(report.deptBreakdown.generalRevenue)}</strong>
              </div>
              <div className="dept-item-sub">
                {report.deptBreakdown.generalQty} items sold
                {report.totalSales > 0 && ` · ${Math.round((report.deptBreakdown.generalRevenue / report.totalSales) * 100)}% of sales`}
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
              <strong>{report.dineInOrders} orders</strong>
            </div>
            <div className="channel-row">
              <span>🥡 Takeaway Orders</span>
              <strong>{report.takeawayOrders} orders</strong>
            </div>
            <div className="channel-divider" />
            <div className="channel-row">
              <span>💵 Cash Collected</span>
              <strong>{formatMoney(report.cashSales)}</strong>
            </div>
            <div className="channel-row">
              <span>💳 Card Payments</span>
              <strong>{formatMoney(report.cardSales)}</strong>
            </div>
            <div className="channel-row">
              <span>📝 Credit (Udhar)</span>
              <strong>{formatMoney(report.creditSales)}</strong>
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
