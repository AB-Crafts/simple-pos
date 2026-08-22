import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  listHandler,
  getHandler,
  allWithItemsHandler,
  pendingCountHandler,
  createHandler,
  updateHandler,
  settleHandler,
  voidHandler,
} from '../controllers/sales.controller.js';

export const salesRoutes = Router();

salesRoutes.get('/', asyncHandler(listHandler));
salesRoutes.get('/all-with-items', asyncHandler(allWithItemsHandler));
salesRoutes.get('/pending-count', asyncHandler(pendingCountHandler));
salesRoutes.get('/:id', asyncHandler(getHandler));
salesRoutes.post('/', asyncHandler(createHandler));
salesRoutes.put('/:id', asyncHandler(updateHandler));
salesRoutes.post('/:id/settle', asyncHandler(settleHandler));
salesRoutes.post('/:id/void', asyncHandler(voidHandler));
