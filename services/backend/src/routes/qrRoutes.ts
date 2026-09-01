import { Router } from 'express';
import { handler } from '../lib/handler';
import { myQr, resolveQr } from '../controllers/qrController';

export const qrRoutes = Router();
qrRoutes.get('/mine', handler(myQr));
qrRoutes.post('/resolve', handler(resolveQr));
