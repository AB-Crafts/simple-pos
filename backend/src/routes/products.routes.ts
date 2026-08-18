import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { listHandler, getHandler, upsertHandler } from '../controllers/products.controller.js';

export const productsRoutes = Router();

// Reading the catalog is needed by any device running the POS — cashiers included.
productsRoutes.get('/', asyncHandler(listHandler));
productsRoutes.get('/:id', asyncHandler(getHandler));

// Creating/editing products is a manager+ action, matching spec §20's future roles.
productsRoutes.post('/', requireAuth, requireRole('OWNER', 'MANAGER'), asyncHandler(upsertHandler));
