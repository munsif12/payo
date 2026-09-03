import { Router } from 'express';
import { handler } from '../lib/handler';
import { listInstitutions } from '../controllers/institutionsController';

export const institutionRoutes = Router();
institutionRoutes.get('/', handler(listInstitutions));
