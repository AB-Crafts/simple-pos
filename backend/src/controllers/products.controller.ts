import type { Request, Response } from 'express';
import {
  listProducts,
  getProduct,
  getProductByBarcode,
  upsertProduct,
  toggleProductActive,
} from '../services/products.service.js';
import { ApiError } from '../utils/ApiError.js';

export async function listHandler(_req: Request, res: Response) {
  res.json(await listProducts());
}

export async function getHandler(req: Request, res: Response) {
  res.json(await getProduct(req.params.id));
}

export async function barcodeHandler(req: Request, res: Response) {
  const product = await getProductByBarcode(req.params.code);
  res.json(product);
}

export async function upsertHandler(req: Request, res: Response) {
  const body = req.body ?? {};
  if (!body.name || body.sellingPrice == null) {
    throw new ApiError(400, 'name and sellingPrice are required');
  }
  res.status(201).json(await upsertProduct(body));
}

export async function toggleActiveHandler(req: Request, res: Response) {
  res.json(await toggleProductActive(req.params.id));
}
