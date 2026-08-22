import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  listHandler,
  getHandler,
  barcodeHandler,
  upsertHandler,
  toggleActiveHandler,
} from '../controllers/products.controller.js';

export const productsRoutes = Router();

productsRoutes.get('/', asyncHandler(listHandler));
productsRoutes.get('/barcode/:code', asyncHandler(barcodeHandler));
productsRoutes.get('/:id', asyncHandler(getHandler));
productsRoutes.post('/', asyncHandler(upsertHandler));
productsRoutes.patch('/:id/toggle-active', asyncHandler(toggleActiveHandler));
