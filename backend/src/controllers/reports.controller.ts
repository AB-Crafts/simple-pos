import type { Request, Response } from 'express';
import { getProfitReport, getMoneyFlowReport } from '../services/reports.service.js';
import { ApiError } from '../utils/ApiError.js';

function parseRange(req: Request): { from: number; to: number } {
  const { from, to } = req.query;
  if (!from || !to) throw new ApiError(400, 'from and to query params (epoch millis) are required');
  return { from: Number(from), to: Number(to) };
}

export async function profitHandler(req: Request, res: Response) {
  const { from, to } = parseRange(req);
  res.json(await getProfitReport(from, to));
}

export async function moneyFlowHandler(req: Request, res: Response) {
  const { from, to } = parseRange(req);
  res.json(await getMoneyFlowReport(from, to));
}
