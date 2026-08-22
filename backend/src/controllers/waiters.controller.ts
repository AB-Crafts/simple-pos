import type { Request, Response } from 'express';
import { listWaiters, createWaiter, toggleWaiterActive } from '../services/waiters.service.js';
import { ApiError } from '../utils/ApiError.js';

export async function listHandler(req: Request, res: Response) {
  const activeOnly = req.query.active === 'true';
  res.json(await listWaiters(activeOnly));
}

export async function createHandler(req: Request, res: Response) {
  const body = req.body ?? {};
  if (!body.name || !body.name.trim()) {
    throw new ApiError(400, 'Waiter name is required');
  }
  res.status(201).json(await createWaiter(body));
}

export async function toggleActiveHandler(req: Request, res: Response) {
  res.json(await toggleWaiterActive(req.params.id));
}
