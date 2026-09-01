import { Router } from 'express';
import { handler } from '../lib/handler';
import { createTransfer } from '../controllers/transfersController';

export const transferRoutes = Router();
transferRoutes.post('/', handler(createTransfer));
