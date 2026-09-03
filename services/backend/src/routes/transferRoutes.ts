import { Router } from 'express';
import { handler } from '../lib/handler';
import { createTransfer, resolveTransfer } from '../controllers/transfersController';

export const transferRoutes = Router();
transferRoutes.post('/resolve', handler(resolveTransfer));
transferRoutes.post('/', handler(createTransfer));
