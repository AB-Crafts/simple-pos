import type { Request, Response } from 'express';
import { listMoneyTransactions, recordWithdrawal } from '../services/moneyFlow.service.js';
import { ApiError } from '../utils/ApiError.js';

export async function listHandler(req: Request, res: Response) {
  const { from, to } = req.query;
  const fromNum = from ? Number(from) : undefined;
  const toNum = to ? Number(to) : undefined;
  res.json(await listMoneyTransactions(fromNum, toNum));
}

export async function withdrawHandler(req: Request, res: Response) {
  const { amount, createdAt } = req.body ?? {};
  if (!amount || amount <= 0) {
    throw new ApiError(400, 'Withdrawal amount must be greater than zero');
  }
  const result = await recordWithdrawal(amount, createdAt);
  res.status(201).json(result);
}
