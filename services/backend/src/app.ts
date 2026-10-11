import express from 'express';
import cors from 'cors';
import './executors';
import { apiRouter } from './routes';
import { errorHandler } from './middleware/errorHandler';
import { aiProxy } from './aiProxy';

export function createApp() {
  const app = express();
  app.use(cors());
  // Before the JSON body parser: the proxy streams the raw request through.
  app.use('/ai', aiProxy());
  app.use(express.json());
  app.get('/health', (_req, res) => res.json({ success: true, data: { service: 'payo-backend', status: 'ok' } }));
  app.use('/api/v1', apiRouter);
  app.use((_req, res) => res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Route not found' }));
  app.use(errorHandler);
  return app;
}
