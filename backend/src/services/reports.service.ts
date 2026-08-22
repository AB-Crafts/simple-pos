import { db } from '../database/db.js';

export interface ProfitReport {
  totalSales: number;
  totalExpenses: number;
  cogs: number;
  grossProfit: number;
  netProfit: number;
}

export async function getProfitReport(from: number, to: number): Promise<ProfitReport> {
  const salesRow = db.prepare(
    'SELECT COALESCE(SUM(total), 0) AS total FROM sales WHERE created_at BETWEEN ? AND ? AND voided = 0'
  ).get(from, to) as { total: number };

  const expensesRow = db.prepare(
    'SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE created_at BETWEEN ? AND ?'
  ).get(from, to) as { total: number };

  const cogsRow = db.prepare(`
    SELECT COALESCE(SUM(si.cost_price * si.quantity), 0) AS total
    FROM sale_items si
    JOIN sales s ON s.id = si.sale_id
    WHERE s.created_at BETWEEN ? AND ? AND s.voided = 0
  `).get(from, to) as { total: number };

  const totalSales = salesRow.total;
  const totalExpenses = expensesRow.total;
  const cogs = cogsRow.total;
  const grossProfit = totalSales - cogs;
  const netProfit = grossProfit - totalExpenses;

  return { totalSales, totalExpenses, cogs, grossProfit, netProfit };
}

export interface MoneyFlowReport {
  cashSales: number;
  cardSales: number;
  creditSales: number;
  expenses: number;
  withdrawals: number;
  netCashFlow: number;
}

export async function getMoneyFlowReport(from: number, to: number): Promise<MoneyFlowReport> {
  const rows = db.prepare(`
    SELECT type, COALESCE(SUM(amount), 0) AS total
    FROM money_transactions
    WHERE created_at BETWEEN ? AND ?
    GROUP BY type
  `).all(from, to) as { type: string; total: number }[];

  const byType = Object.fromEntries(rows.map((r) => [r.type, r.total]));
  const cashSales = byType.CASH_SALE ?? 0;
  const cardSales = byType.CARD_SALE ?? 0;
  const creditSales = byType.CREDIT_SALE ?? 0;
  const expenses = byType.EXPENSE ?? 0;
  const withdrawals = byType.WITHDRAWAL ?? 0;

  return {
    cashSales,
    cardSales,
    creditSales,
    expenses,
    withdrawals,
    netCashFlow: cashSales + cardSales - expenses - withdrawals,
  };
}

export interface ReportSummary {
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

export async function getReportSummary(from: number, to: number): Promise<ReportSummary> {
  const profit = await getProfitReport(from, to);

  const orderStats = db.prepare(`
    SELECT
      COUNT(*) AS total_orders,
      SUM(CASE WHEN status = 'PAID' THEN 1 ELSE 0 END) AS paid_orders,
      SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) AS pending_orders,
      SUM(CASE WHEN order_type = 'DINE_IN' THEN 1 ELSE 0 END) AS dine_in_orders,
      SUM(CASE WHEN order_type = 'TAKE_AWAY' THEN 1 ELSE 0 END) AS takeaway_orders,
      COALESCE(SUM(CASE WHEN payment_method = 'CASH' AND status = 'PAID' THEN total ELSE 0 END), 0) AS cash_sales,
      COALESCE(SUM(CASE WHEN payment_method = 'CARD' AND status = 'PAID' THEN total ELSE 0 END), 0) AS card_sales,
      COALESCE(SUM(CASE WHEN payment_method = 'CREDIT' THEN total ELSE 0 END), 0) AS credit_sales
    FROM sales
    WHERE created_at BETWEEN ? AND ? AND voided = 0
  `).get(from, to) as any;

  const deptRows = db.prepare(`
    SELECT
      si.department,
      COALESCE(SUM(si.total), 0) AS revenue,
      COALESCE(SUM(si.quantity), 0) AS qty
    FROM sale_items si
    JOIN sales s ON s.id = si.sale_id
    WHERE s.created_at BETWEEN ? AND ? AND s.voided = 0
    GROUP BY si.department
  `).all(from, to) as { department: string | null; revenue: number; qty: number }[];

  let chaiRevenue = 0;
  let chaiQty = 0;
  let parhataRevenue = 0;
  let parhataQty = 0;
  let generalRevenue = 0;
  let generalQty = 0;

  for (const row of deptRows) {
    if (row.department === 'CHAI') {
      chaiRevenue += row.revenue;
      chaiQty += row.qty;
    } else if (row.department === 'PARHATA') {
      parhataRevenue += row.revenue;
      parhataQty += row.qty;
    } else {
      generalRevenue += row.revenue;
      generalQty += row.qty;
    }
  }

  return {
    from,
    to,
    totalSales: profit.totalSales,
    totalExpenses: profit.totalExpenses,
    cogs: profit.cogs,
    grossProfit: profit.grossProfit,
    netProfit: profit.netProfit,
    totalOrders: orderStats?.total_orders ?? 0,
    paidOrders: orderStats?.paid_orders ?? 0,
    pendingOrders: orderStats?.pending_orders ?? 0,
    dineInOrders: orderStats?.dine_in_orders ?? 0,
    takeawayOrders: orderStats?.takeaway_orders ?? 0,
    cashSales: orderStats?.cash_sales ?? 0,
    cardSales: orderStats?.card_sales ?? 0,
    creditSales: orderStats?.credit_sales ?? 0,
    deptBreakdown: {
      chaiRevenue,
      chaiQty,
      parhataRevenue,
      parhataQty,
      generalRevenue,
      generalQty,
    },
  };
}
