import { Router } from 'express';
import { handler } from '../lib/handler';
import { listRecipients, createRecipient, deleteRecipient } from '../controllers/recipientsController';

export const recipientRoutes = Router();
recipientRoutes.get('/', handler(listRecipients));
recipientRoutes.post('/', handler(createRecipient));
recipientRoutes.delete('/:id', handler(deleteRecipient));
