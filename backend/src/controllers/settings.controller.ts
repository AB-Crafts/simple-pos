import type { Request, Response } from 'express';
import { getSetting, setSetting, getAllSettings } from '../services/settings.service.js';
import { ApiError } from '../utils/ApiError.js';

export async function getAllHandler(_req: Request, res: Response) {
  res.json(await getAllSettings());
}

export async function getHandler(req: Request, res: Response) {
  const val = await getSetting(req.params.key);
  if (val === null) throw new ApiError(404, 'Setting not found');
  res.json({ key: req.params.key, value: val });
}

export async function setHandler(req: Request, res: Response) {
  const { key, value } = req.body ?? {};
  if (!key || value === undefined) throw new ApiError(400, 'key and value are required');
  await setSetting(key, String(value));
  res.json({ ok: true, key, value: String(value) });
}
