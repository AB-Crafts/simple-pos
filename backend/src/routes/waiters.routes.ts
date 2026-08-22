import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { listHandler, createHandler, toggleActiveHandler } from '../controllers/waiters.controller.js';

export const waitersRoutes = Router();

waitersRoutes.get('/', asyncHandler(listHandler));
waitersRoutes.post('/', asyncHandler(createHandler));
waitersRoutes.patch('/:id/toggle-active', asyncHandler(toggleActiveHandler));
