import request from 'supertest';
import { createApp } from '../app';

test('GET /health returns standard success shape', async () => {
  const res = await request(createApp()).get('/health');
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ success: true, data: { service: 'payo-backend', status: 'ok' } });
});

test('unknown route returns standard error shape', async () => {
  const res = await request(createApp()).get('/nope');
  expect(res.status).toBe(404);
  expect(res.body).toEqual({ success: false, code: 'NOT_FOUND', message: 'Route not found' });
});
