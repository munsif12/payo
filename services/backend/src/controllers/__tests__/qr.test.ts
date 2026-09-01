import request from 'supertest';
import { createApp } from '../../app';
import { createVerifiedUser } from '../../testUtils/factories';

const app = createApp();

test('mine → resolve round-trip returns owner', async () => {
  const me = await createVerifiedUser(app);
  const other = await createVerifiedUser(app);
  const mine = await request(app).get('/api/v1/qr/mine').set('Authorization', `Bearer ${me.token}`);
  expect(mine.status).toBe(200);
  const resolved = await request(app).post('/api/v1/qr/resolve')
    .set('Authorization', `Bearer ${other.token}`).send({ payload: mine.body.data.payload });
  expect(resolved.status).toBe(200);
  expect(resolved.body.data.user.phone).toBe(me.user.phone);
  expect(resolved.body.data.user.name).toBe(me.user.name);
});

test('tampered payload → 400 INVALID_QR', async () => {
  const me = await createVerifiedUser(app);
  const mine = await request(app).get('/api/v1/qr/mine').set('Authorization', `Bearer ${me.token}`);
  const p: string = mine.body.data.payload;
  const tampered = p.slice(0, -1) + (p.endsWith('a') ? 'b' : 'a');
  const res = await request(app).post('/api/v1/qr/resolve')
    .set('Authorization', `Bearer ${me.token}`).send({ payload: tampered });
  expect(res.status).toBe(400);
  expect(res.body.code).toBe('INVALID_QR');
});
