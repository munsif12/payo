import { Router } from 'express';
import { handler } from '../lib/handler';
import { requireAuth } from '../middleware/requireAuth';
import { signup, verifyOtp, login, verifyPin } from '../controllers/authController';

export const authRoutes = Router();
authRoutes.post('/signup', handler(signup));
authRoutes.post('/verify-otp', handler(verifyOtp));
authRoutes.post('/login', handler(login));
authRoutes.post('/verify-pin', requireAuth, handler(verifyPin));
