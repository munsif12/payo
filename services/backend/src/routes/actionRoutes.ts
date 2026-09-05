import { Router } from 'express';
import { handler } from '../lib/handler';
import { execute, cancel, getAction, checkIn, remind } from '../controllers/actionsController';

export const actionRoutes = Router();
actionRoutes.get('/:id', handler(getAction));
actionRoutes.post('/:id/execute', handler(execute));
actionRoutes.post('/:id/cancel', handler(cancel));
actionRoutes.post('/:id/check-in', handler(checkIn));
actionRoutes.post('/:id/remind', handler(remind));
