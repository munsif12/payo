import { Router } from 'express';
import { handler } from '../lib/handler';
import { listBanks, resolveTitle } from '../controllers/banksController';

export const bankRoutes = Router();
bankRoutes.get('/', handler(listBanks));
bankRoutes.post('/resolve-title', handler(resolveTitle));
