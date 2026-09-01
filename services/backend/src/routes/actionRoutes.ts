import { Router } from 'express';
import { handler } from '../lib/handler';
import { execute, cancel } from '../controllers/actionsController';

export const actionRoutes = Router();
actionRoutes.post('/:id/execute', handler(execute));
actionRoutes.post('/:id/cancel', handler(cancel));
