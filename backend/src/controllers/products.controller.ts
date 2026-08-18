import type { Request, Response } from 'express';
import { listProducts, getProduct, upsertProduct } from '../services/products.service.js';
import { ApiError } from '../utils/ApiError.js';

export async function listHandler(_req: Request, res: Response) {
  res.json(await listProducts());
}

export async function getHandler(req: Request, res: Response) {
  res.json(await getProduct(req.params.id));
}

export async function upsertHandler(req: Request, res: Response) {
  const body = req.body ?? {};
  if (!body.id || !body.name) throw new ApiError(400, 'id and name are required');
  res.status(201).json(await upsertProduct(body));
}
