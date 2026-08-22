import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { listHandler, createHandler } from '../controllers/expenses.controller.js';

export const expensesRoutes = Router();

expensesRoutes.get('/', asyncHandler(listHandler));
expensesRoutes.post('/', asyncHandler(createHandler));
