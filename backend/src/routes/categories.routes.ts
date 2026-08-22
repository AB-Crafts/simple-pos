import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { listHandler, createHandler } from '../controllers/categories.controller.js';

export const categoriesRoutes = Router();

categoriesRoutes.get('/', asyncHandler(listHandler));
categoriesRoutes.post('/', asyncHandler(createHandler));
