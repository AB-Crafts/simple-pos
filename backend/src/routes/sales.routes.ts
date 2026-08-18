import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { listHandler } from '../controllers/sales.controller.js';

export const salesRoutes = Router();

// Sales history is business-sensitive — requires a logged-in device/user.
salesRoutes.get('/', requireAuth, asyncHandler(listHandler));
