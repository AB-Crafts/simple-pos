import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getAllHandler, getHandler, setHandler } from '../controllers/settings.controller.js';

export const settingsRoutes = Router();

settingsRoutes.get('/', asyncHandler(getAllHandler));
settingsRoutes.get('/:key', asyncHandler(getHandler));
settingsRoutes.post('/', asyncHandler(setHandler));
