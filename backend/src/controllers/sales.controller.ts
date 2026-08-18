import type { Request, Response } from 'express';
import { listSales } from '../services/sales.service.js';

export async function listHandler(req: Request, res: Response) {
  const { from, to } = req.query;
  const fromNum = from ? Number(from) : undefined;
  const toNum = to ? Number(to) : undefined;
  res.json(await listSales(fromNum, toNum));
}
