import { Router } from 'express';
import { handler } from '../lib/handler';
import { listContacts, createContact } from '../controllers/contactsController';

export const contactRoutes = Router();
contactRoutes.get('/', handler(listContacts));
contactRoutes.post('/', handler(createContact));
