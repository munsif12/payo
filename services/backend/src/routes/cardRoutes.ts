import { Router } from 'express';
import { handler } from '../lib/handler';
import { myCard, freezeCard, unfreezeCard } from '../controllers/cardsController';

export const cardRoutes = Router();
cardRoutes.get('/mine', handler(myCard));
cardRoutes.post('/mine/freeze', handler(freezeCard));
cardRoutes.post('/mine/unfreeze', handler(unfreezeCard));
