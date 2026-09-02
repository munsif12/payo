import { Router } from 'express';
import { handler } from '../lib/handler';
import { lookupBill, payBill, listDueBills } from '../controllers/billsController';

export const billRoutes = Router();
billRoutes.get('/due', handler(listDueBills));
billRoutes.post('/lookup', handler(lookupBill));
billRoutes.post('/pay', handler(payBill));
