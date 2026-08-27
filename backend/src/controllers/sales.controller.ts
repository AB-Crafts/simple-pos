import type { Request, Response } from 'express';
import {
  listSales,
  getSale,
  getAllSalesWithItems,
  getPendingOrdersCount,
  createOrder,
  updatePendingOrder,
  settlePendingOrder,
  recordKhataPayment,
  voidOrder,
  deleteSale,
} from '../services/sales.service.js';
import { ApiError } from '../utils/ApiError.js';

export async function listHandler(req: Request, res: Response) {
  const { from, to, status } = req.query;
  const fromNum = from ? Number(from) : undefined;
  const toNum = to ? Number(to) : undefined;
  const statusStr = status ? String(status) : undefined;
  res.json(await listSales(fromNum, toNum, statusStr));
}

export async function getHandler(req: Request, res: Response) {
  res.json(await getSale(req.params.id));
}

export async function allWithItemsHandler(_req: Request, res: Response) {
  res.json(await getAllSalesWithItems());
}

export async function pendingCountHandler(_req: Request, res: Response) {
  const count = await getPendingOrdersCount();
  res.json({ count });
}

export async function createHandler(req: Request, res: Response) {
  const body = req.body ?? {};
  if (!body.cart || !Array.isArray(body.cart) || body.cart.length === 0) {
    throw new ApiError(400, 'Cart items are required');
  }
  const result = await createOrder(body);
  res.status(201).json(result);
}

export async function updateHandler(req: Request, res: Response) {
  const body = req.body ?? {};
  if (!body.cart || !Array.isArray(body.cart) || body.cart.length === 0) {
    throw new ApiError(400, 'Cart items are required');
  }
  const result = await updatePendingOrder(req.params.id, body.cart, body.takenBy);
  res.json(result);
}

export async function settleHandler(req: Request, res: Response) {
  const body = req.body ?? {};
  if (!body.paymentMethod) {
    throw new ApiError(400, 'paymentMethod is required');
  }
  const result = await settlePendingOrder(
    req.params.id,
    body.paymentMethod,
    body.amountReceived ?? null,
    body.customerName ?? null,
    body.customerContact ?? null
  );
  res.json(result);
}

export async function recordPaymentHandler(req: Request, res: Response) {
  const body = req.body ?? {};
  if (!body.paymentMethod) {
    throw new ApiError(400, 'paymentMethod is required');
  }
  const result = await recordKhataPayment(
    req.params.id,
    body.paymentMethod,
    body.amountReceived ?? null,
    body.customerName ?? null,
    body.customerContact ?? null
  );
  res.json(result);
}

export async function voidHandler(req: Request, res: Response) {
  await voidOrder(req.params.id);
  res.json({ ok: true, message: 'Order voided' });
}

export async function deleteHandler(req: Request, res: Response) {
  const password = req.body?.password ?? req.query?.password;
  await deleteSale(req.params.id, password);
  res.json({ ok: true, message: 'Sale completely deleted' });
}

