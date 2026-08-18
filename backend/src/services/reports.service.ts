import { pool } from '../database/pool.js';

export interface ProfitReport {
  totalSales: number;
  totalExpenses: number;
  cogs: number;
  grossProfit: number;
  netProfit: number;
}

export async function getProfitReport(from: number, to: number): Promise<ProfitReport> {
  const salesResult = await pool.query<{ total: string | null }>(
    `SELECT COALESCE(SUM(total), 0) AS total FROM sales WHERE created_at BETWEEN $1 AND $2 AND voided = FALSE`,
    [from, to]
  );
  const expensesResult = await pool.query<{ total: string | null }>(
    `SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE created_at BETWEEN $1 AND $2`,
    [from, to]
  );
  const cogsResult = await pool.query<{ total: string | null }>(
    `SELECT COALESCE(SUM(si.cost_price * si.quantity), 0) AS total
     FROM sale_items si
     JOIN sales s ON s.id = si.sale_id
     WHERE s.created_at BETWEEN $1 AND $2 AND s.voided = FALSE`,
    [from, to]
  );

  const totalSales = Number(salesResult.rows[0].total);
  const totalExpenses = Number(expensesResult.rows[0].total);
  const cogs = Number(cogsResult.rows[0].total);
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
  const result = await pool.query<{ type: string; total: string }>(
    `SELECT type, COALESCE(SUM(amount), 0) AS total FROM money_transactions
     WHERE created_at BETWEEN $1 AND $2 GROUP BY type`,
    [from, to]
  );

  const byType = Object.fromEntries(result.rows.map((r) => [r.type, Number(r.total)]));
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
