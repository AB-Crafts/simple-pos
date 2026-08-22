import type { Request, Response } from 'express';
import { listCategories, createCategory } from '../services/categories.service.js';
import { ApiError } from '../utils/ApiError.js';

export async function listHandler(_req: Request, res: Response) {
  res.json(await listCategories());
}

export async function createHandler(req: Request, res: Response) {
  const body = req.body ?? {};
  if (!body.name) throw new ApiError(400, 'name is required');
  res.status(201).json(await createCategory(body));
}
