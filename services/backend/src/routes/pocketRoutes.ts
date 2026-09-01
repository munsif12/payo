import { Router } from 'express';
import { handler } from '../lib/handler';
import { listPockets, createPocket, depositPocket, withdrawPocket } from '../controllers/pocketsController';

export const pocketRoutes = Router();
pocketRoutes.get('/', handler(listPockets));
pocketRoutes.post('/', handler(createPocket));
pocketRoutes.post('/:id/deposit', handler(depositPocket));
pocketRoutes.post('/:id/withdraw', handler(withdrawPocket));
