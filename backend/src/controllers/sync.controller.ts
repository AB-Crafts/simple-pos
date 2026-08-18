import type { Request, Response } from 'express';
import { applySyncedSale, applySyncedExpense, applySyncedProduct } from '../services/sync.service.js';
import { ApiError } from '../utils/ApiError.js';

export async function syncSaleHandler(req: Request, res: Response) {
  await applySyncedSale(req.body);
  res.status(200).json({ ok: true });
}

export async function syncExpenseHandler(req: Request, res: Response) {
  await applySyncedExpense(req.body);
  res.status(200).json({ ok: true });
}

export async function syncProductHandler(req: Request, res: Response) {
  await applySyncedProduct(req.body);
  res.status(200).json({ ok: true });
}

export async function syncUnknownEntityHandler(req: Request, _res: Response) {
  throw new ApiError(400, `Unknown sync entity: ${req.params.entity}`);
}
