import { Router } from 'express';
import { handler } from '../lib/handler';
import { requireAuth } from '../middleware/requireAuth';
import { authRoutes } from './authRoutes';
import { actionRoutes } from './actionRoutes';
import { me } from '../controllers/authController';

export const apiRouter = Router();
apiRouter.use('/auth', authRoutes);
apiRouter.get('/me', requireAuth, handler(me));
apiRouter.use('/actions', requireAuth, actionRoutes);
