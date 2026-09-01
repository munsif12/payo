import { Router } from 'express';
import { handler } from '../lib/handler';
import { lookupBill, payBill } from '../controllers/billsController';

export const billRoutes = Router();
billRoutes.post('/lookup', handler(lookupBill));
billRoutes.post('/pay', handler(payBill));
