import { Router } from 'express';
import { handler } from '../lib/handler';
import { listSavedBillers, createSavedBiller, deleteSavedBiller } from '../controllers/savedBillersController';

export const savedBillerRoutes = Router();
savedBillerRoutes.get('/', handler(listSavedBillers));
savedBillerRoutes.post('/', handler(createSavedBiller));
savedBillerRoutes.delete('/:id', handler(deleteSavedBiller));
