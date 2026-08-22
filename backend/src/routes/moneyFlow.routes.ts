import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { listHandler, withdrawHandler } from '../controllers/moneyFlow.controller.js';

export const moneyFlowRoutes = Router();

moneyFlowRoutes.get('/', asyncHandler(listHandler));
moneyFlowRoutes.post('/withdraw', asyncHandler(withdrawHandler));
