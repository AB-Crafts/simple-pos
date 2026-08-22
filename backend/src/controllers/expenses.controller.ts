import type { Request, Response } from 'express';
import { listExpenses, recordExpense } from '../services/expenses.service.js';
import { ApiError } from '../utils/ApiError.js';

export async function listHandler(req: Request, res: Response) {
  const { from, to } = req.query;
  const fromNum = from ? Number(from) : undefined;
  const toNum = to ? Number(to) : undefined;
  res.json(await listExpenses(fromNum, toNum));
}

export async function createHandler(req: Request, res: Response) {
  const body = req.body ?? {};
  if (!body.description || !body.amount || !body.category || !body.paymentMethod) {
    throw new ApiError(400, 'description, amount, category, and paymentMethod are required');
  }
  const result = await recordExpense(body);
  res.status(201).json(result);
}
