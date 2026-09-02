import { Router } from 'express';
import { handler } from '../lib/handler';
import { requireOtpOrSession } from '../middleware/requireAuth';
import { requestOtp, verifyOtp, setPin, verifyPin } from '../controllers/authController';

export const authRoutes = Router();
authRoutes.post('/request-otp', handler(requestOtp));
authRoutes.post('/verify-otp', handler(verifyOtp));
authRoutes.post('/set-pin', requireOtpOrSession, handler(setPin));
authRoutes.post('/verify-pin', requireOtpOrSession, handler(verifyPin));
