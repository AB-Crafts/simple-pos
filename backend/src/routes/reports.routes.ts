import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { profitHandler, moneyFlowHandler, summaryHandler } from '../controllers/reports.controller.js';

export const reportsRoutes = Router();

reportsRoutes.get('/profit', asyncHandler(profitHandler));
reportsRoutes.get('/money-flow', asyncHandler(moneyFlowHandler));
reportsRoutes.get('/summary', asyncHandler(summaryHandler));
