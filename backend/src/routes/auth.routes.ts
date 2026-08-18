import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { registerHandler, loginHandler } from '../controllers/auth.controller.js';

export const authRoutes = Router();

authRoutes.post('/register', asyncHandler(registerHandler));
authRoutes.post('/login', asyncHandler(loginHandler));
