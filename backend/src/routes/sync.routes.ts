import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  syncSaleHandler,
  syncExpenseHandler,
  syncProductHandler,
  syncUnknownEntityHandler,
} from '../controllers/sync.controller.js';

export const syncRoutes = Router();

/**
 * One endpoint per entity type, matching the frontend syncService's
 * POST /sync/:entity calls. Each entity's upsert is independently
 * idempotent (keyed on the record's own id), so a device can safely
 * retry a sync after a dropped connection without double-counting a sale.
 */
syncRoutes.post('/sale', asyncHandler(syncSaleHandler));
syncRoutes.post('/expense', asyncHandler(syncExpenseHandler));
syncRoutes.post('/product', asyncHandler(syncProductHandler));
syncRoutes.post('/:entity', asyncHandler(syncUnknownEntityHandler));
