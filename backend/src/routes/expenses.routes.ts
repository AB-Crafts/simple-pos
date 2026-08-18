import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { listHandler } from '../controllers/expenses.controller.js';

export const expensesRoutes = Router();

expensesRoutes.get('/', requireAuth, asyncHandler(listHandler));
