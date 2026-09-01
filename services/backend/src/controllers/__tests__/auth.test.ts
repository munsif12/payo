import request from 'supertest';
import { createApp } from '../../app';

const app = createApp();
const signupBody = { name: 'Ammi Jaan', urduName: 'امی', email: 'ammi@payo.demo', phone: '+923001110001', pin: '1234' };

test('signup → verify-otp → me flow', async () => {
  const s = await request(app).post('/api/v1/auth/signup').send(signupBody);
  expect(s.status).toBe(201);
  expect(s.body.data.demoOtp).toMatch(/^\d{6}$/);

  const v = await request(app).post('/api/v1/auth/verify-otp')
    .send({ userId: s.body.data.userId, otp: s.body.data.demoOtp });
  expect(v.body.data.token).toBeTruthy();

  const me = await request(app).get('/api/v1/me').set('Authorization', `Bearer ${v.body.data.token}`);
  expect(me.body.data.account.balancePaisa).toBe(1_000_000);
  expect(me.body.data.card.last4).toMatch(/^\d{4}$/);
});

test('login with wrong pin → 401 INVALID_CREDENTIALS', async () => {
  const s = await request(app).post('/api/v1/auth/signup').send(signupBody);
  await request(app).post('/api/v1/auth/verify-otp').send({ userId: s.body.data.userId, otp: s.body.data.demoOtp });
  const bad = await request(app).post('/api/v1/auth/login').send({ email: signupBody.email, pin: '9999' });
  expect(bad.status).toBe(401);
  expect(bad.body.code).toBe('INVALID_CREDENTIALS');
  const good = await request(app).post('/api/v1/auth/login').send({ email: signupBody.email, pin: '1234' });
  expect(good.body.data.token).toBeTruthy();
});

test('verify-pin gates on correct pin', async () => {
  const s = await request(app).post('/api/v1/auth/signup').send(signupBody);
  const v = await request(app).post('/api/v1/auth/verify-otp').send({ userId: s.body.data.userId, otp: s.body.data.demoOtp });
  const token = v.body.data.token;
  const wrong = await request(app).post('/api/v1/auth/verify-pin').set('Authorization', `Bearer ${token}`).send({ pin: '0000' });
  expect(wrong.status).toBe(401);
  const right = await request(app).post('/api/v1/auth/verify-pin').set('Authorization', `Bearer ${token}`).send({ pin: '1234' });
  expect(right.body.data.valid).toBe(true);
});

test('protected route without token → 401', async () => {
  const res = await request(app).get('/api/v1/me');
  expect(res.status).toBe(401);
});
