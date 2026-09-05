import { Router } from 'express';
import { handler } from '../lib/handler';
import { listTransactions, spendingSummary, getTransaction } from '../controllers/transactionsController';

export const transactionRoutes = Router();
transactionRoutes.get('/', handler(listTransactions));
transactionRoutes.get('/spending-summary', handler(spendingSummary));
transactionRoutes.get('/:id', handler(getTransaction));
