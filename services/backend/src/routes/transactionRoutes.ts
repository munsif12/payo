import { Router } from 'express';
import { handler } from '../lib/handler';
import { listTransactions, spendingSummary } from '../controllers/transactionsController';

export const transactionRoutes = Router();
transactionRoutes.get('/', handler(listTransactions));
transactionRoutes.get('/spending-summary', handler(spendingSummary));
