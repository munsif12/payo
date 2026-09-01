import { Router } from 'express';
import { handler } from '../lib/handler';
import { requireAuth } from '../middleware/requireAuth';
import { authRoutes } from './authRoutes';
import { actionRoutes } from './actionRoutes';
import { contactRoutes } from './contactRoutes';
import { bankRoutes } from './bankRoutes';
import { transferRoutes } from './transferRoutes';
import { me } from '../controllers/authController';

export const apiRouter = Router();
apiRouter.use('/auth', authRoutes);
apiRouter.get('/me', requireAuth, handler(me));
apiRouter.use('/actions', requireAuth, actionRoutes);
apiRouter.use('/contacts', requireAuth, contactRoutes);
apiRouter.use('/banks', requireAuth, bankRoutes);
apiRouter.use('/transfers', requireAuth, transferRoutes);
