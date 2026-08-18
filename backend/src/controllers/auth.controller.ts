import type { Request, Response } from 'express';
import { register, login } from '../services/auth.service.js';
import { ApiError } from '../utils/ApiError.js';

export async function registerHandler(req: Request, res: Response) {
  const { name, email, password, role } = req.body ?? {};
  if (!name || !email || !password || !role) {
    throw new ApiError(400, 'name, email, password, and role are required');
  }
  const result = await register(name, email, password, role);
  res.status(201).json(result);
}

export async function loginHandler(req: Request, res: Response) {
  const { email, password } = req.body ?? {};
  if (!email || !password) throw new ApiError(400, 'email and password are required');
  const result = await login(email, password);
  res.json(result);
}
