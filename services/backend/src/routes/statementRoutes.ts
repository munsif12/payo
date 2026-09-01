import { Router } from 'express';
import { handler } from '../lib/handler';
import { generateStatement, listStatements, statementPdf } from '../controllers/statementsController';

export const statementRoutes = Router();
statementRoutes.get('/', handler(listStatements));
statementRoutes.post('/', handler(generateStatement));
statementRoutes.get('/:id/pdf', handler(statementPdf));
