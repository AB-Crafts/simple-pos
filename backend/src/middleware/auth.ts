import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ApiError } from '../utils/ApiError.js';
import type { UserRole } from '../models/types.js';

export interface AuthTokenPayload {
  sub: string; // user id
  role: UserRole;
  email: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthTokenPayload;
    }
  }
}

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not set. Copy backend/.env.example to backend/.env.');
  return secret;
}

export function signToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, getSecret(), { expiresIn: '12h' });
}

/**
 * Verifies the Authorization: Bearer <token> header and attaches the
 * decoded user to req.user. Use on any route that needs to know who's
 * calling. Kept deliberately simple (V1 per spec §20) — a single
 * shared-secret JWT, no refresh tokens or sessions yet.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new ApiError(401, 'Missing or invalid Authorization header');
  }

  try {
    const decoded = jwt.verify(header.slice('Bearer '.length), getSecret()) as AuthTokenPayload;
    req.user = decoded;
    next();
  } catch {
    throw new ApiError(401, 'Invalid or expired token');
  }
}

/** Restricts a route to specific roles. Use after requireAuth. */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw new ApiError(401, 'Not authenticated');
    if (!roles.includes(req.user.role)) throw new ApiError(403, 'Insufficient permissions');
    next();
  };
}
