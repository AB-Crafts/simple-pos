import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { profitHandler, moneyFlowHandler } from '../controllers/reports.controller.js';

export const reportsRoutes = Router();

reportsRoutes.get('/profit', requireAuth, asyncHandler(profitHandler));
reportsRoutes.get('/money-flow', requireAuth, asyncHandler(moneyFlowHandler));
