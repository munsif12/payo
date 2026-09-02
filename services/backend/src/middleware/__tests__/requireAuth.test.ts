import request from 'supertest';
import { createApp } from '../../app';
import { User, Account, Card } from '../../models';
import { signSession, signOtpToken } from '../../lib/tokens';

const app = createApp();

test('otp-scope token rejected by requireAuth with 401 OTP_SCOPE', async () => {
  const u = await User.create({ name: 'A', phone: '+920000000010' });
  const token = signOtpToken(u);
  const res = await request(app).get('/api/v1/me').set('Authorization', `Bearer ${token}`);
  expect(res.status).toBe(401);
  expect(res.body.code).toBe('OTP_SCOPE');
});

test('session token for a user that no longer exists → 401 SESSION_EXPIRED', async () => {
  const u = await User.create({ name: 'A', phone: '+920000000011' });
  const token = signSession(u);
  await User.deleteOne({ _id: u._id });
  const res = await request(app).get('/api/v1/me').set('Authorization', `Bearer ${token}`);
  expect(res.status).toBe(401);
  expect(res.body.code).toBe('SESSION_EXPIRED');
});

test('valid session token passes requireAuth', async () => {
  const u = await User.create({ name: 'A', phone: '+920000000012', email: 'x@x.com' });
  await Account.create({ userId: u._id, balancePaisa: 0 });
  await Card.create({ userId: u._id, pan: '4111 1111 1111 1111', cvv: '123', expiry: '09/29' });
  const token = signSession(u);
  const res = await request(app).get('/api/v1/me').set('Authorization', `Bearer ${token}`);
  expect(res.status).toBe(200);
});
