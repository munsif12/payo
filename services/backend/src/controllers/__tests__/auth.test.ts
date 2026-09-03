import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../../app';
import { User, Account, Card } from '../../models';

const app = createApp();
const PHONE = '+923001110001';

test('new user path: request-otp → verify-otp → set-pin → session; welcome balance + card', async () => {
  const r = await request(app).post('/api/v1/auth/request-otp').send({ phone: PHONE });
  expect(r.status).toBe(201);
  expect(r.body.data.demoOtp).toMatch(/^\d{6}$/);
  expect(r.body.data.isNewUser).toBe(true);

  const v = await request(app).post('/api/v1/auth/verify-otp').send({ phone: PHONE, otp: r.body.data.demoOtp });
  expect(v.status).toBe(200);
  expect(v.body.data.otpToken).toBeTruthy();
  expect(v.body.data.isNewUser).toBe(true);
  expect(v.body.data.pinSet).toBe(false);

  const sp = await request(app).post('/api/v1/auth/set-pin')
    .set('Authorization', `Bearer ${v.body.data.otpToken}`).send({ pin: '1234' });
  expect(sp.status).toBe(200);
  expect(sp.body.data.token).toBeTruthy();
  expect(sp.body.data.user.name).toBe('PAYO user');
  expect(sp.body.data.user.pinSet).toBe(true);

  const me = await request(app).get('/api/v1/me').set('Authorization', `Bearer ${sp.body.data.token}`);
  expect(me.body.data.account.balancePaisa).toBe(1_000_000);
  expect(me.body.data.card.last4).toMatch(/^\d{4}$/);
});

test('set-pin twice → 409 PIN_ALREADY_SET', async () => {
  const r = await request(app).post('/api/v1/auth/request-otp').send({ phone: PHONE });
  const v = await request(app).post('/api/v1/auth/verify-otp').send({ phone: PHONE, otp: r.body.data.demoOtp });
  await request(app).post('/api/v1/auth/set-pin').set('Authorization', `Bearer ${v.body.data.otpToken}`).send({ pin: '1234' });

  const r2 = await request(app).post('/api/v1/auth/request-otp').send({ phone: PHONE });
  expect(r2.body.data.isNewUser).toBe(false);
  const v2 = await request(app).post('/api/v1/auth/verify-otp').send({ phone: PHONE, otp: r2.body.data.demoOtp });
  const again = await request(app).post('/api/v1/auth/set-pin')
    .set('Authorization', `Bearer ${v2.body.data.otpToken}`).send({ pin: '5678' });
  expect(again.status).toBe(409);
  expect(again.body.code).toBe('PIN_ALREADY_SET');
});

test('returning user path: verify-pin with otpToken returns a session; wrong pin → 401', async () => {
  const r = await request(app).post('/api/v1/auth/request-otp').send({ phone: PHONE });
  const v = await request(app).post('/api/v1/auth/verify-otp').send({ phone: PHONE, otp: r.body.data.demoOtp });
  await request(app).post('/api/v1/auth/set-pin').set('Authorization', `Bearer ${v.body.data.otpToken}`).send({ pin: '1234' });

  const r2 = await request(app).post('/api/v1/auth/request-otp').send({ phone: PHONE });
  const v2 = await request(app).post('/api/v1/auth/verify-otp').send({ phone: PHONE, otp: r2.body.data.demoOtp });
  expect(v2.body.data.isNewUser).toBe(false);
  expect(v2.body.data.pinSet).toBe(true);

  const wrong = await request(app).post('/api/v1/auth/verify-pin')
    .set('Authorization', `Bearer ${v2.body.data.otpToken}`).send({ pin: '0000' });
  expect(wrong.status).toBe(401);
  expect(wrong.body.code).toBe('INVALID_PIN');

  const right = await request(app).post('/api/v1/auth/verify-pin')
    .set('Authorization', `Bearer ${v2.body.data.otpToken}`).send({ pin: '1234' });
  expect(right.status).toBe(200);
  expect(right.body.data.token).toBeTruthy();
});

test('verify-pin with a session token just checks the pin ({ valid: true })', async () => {
  const r = await request(app).post('/api/v1/auth/request-otp').send({ phone: PHONE });
  const v = await request(app).post('/api/v1/auth/verify-otp').send({ phone: PHONE, otp: r.body.data.demoOtp });
  const sp = await request(app).post('/api/v1/auth/set-pin').set('Authorization', `Bearer ${v.body.data.otpToken}`).send({ pin: '1234' });

  const right = await request(app).post('/api/v1/auth/verify-pin')
    .set('Authorization', `Bearer ${sp.body.data.token}`).send({ pin: '1234' });
  expect(right.body.data.valid).toBe(true);
  expect(right.body.data.token).toBeUndefined();
});

test('wrong OTP 5 times → 429 OTP_LOCKED', async () => {
  const r = await request(app).post('/api/v1/auth/request-otp').send({ phone: PHONE });
  let last;
  for (let i = 0; i < 5; i++) {
    last = await request(app).post('/api/v1/auth/verify-otp').send({ phone: PHONE, otp: '000000' });
  }
  expect(last!.status).toBe(429);
  expect(last!.body.code).toBe('OTP_LOCKED');

  // even the correct code is now rejected until a fresh request-otp
  const stillLocked = await request(app).post('/api/v1/auth/verify-otp').send({ phone: PHONE, otp: r.body.data.demoOtp });
  expect(stillLocked.status).toBe(429);
});

test('protected route without token → 401', async () => {
  const res = await request(app).get('/api/v1/me');
  expect(res.status).toBe(401);
});

test('otp-scope token rejected on /me with 401 OTP_SCOPE', async () => {
  const r = await request(app).post('/api/v1/auth/request-otp').send({ phone: PHONE });
  const v = await request(app).post('/api/v1/auth/verify-otp').send({ phone: PHONE, otp: r.body.data.demoOtp });
  const res = await request(app).get('/api/v1/me').set('Authorization', `Bearer ${v.body.data.otpToken}`);
  expect(res.status).toBe(401);
  expect(res.body.code).toBe('OTP_SCOPE');
});

test('token for a user that no longer exists → 401 SESSION_EXPIRED (stale JWT after reseed)', async () => {
  const r = await request(app).post('/api/v1/auth/request-otp').send({ phone: PHONE });
  const v = await request(app).post('/api/v1/auth/verify-otp').send({ phone: PHONE, otp: r.body.data.demoOtp });
  const sp = await request(app).post('/api/v1/auth/set-pin').set('Authorization', `Bearer ${v.body.data.otpToken}`).send({ pin: '1234' });
  const token = sp.body.data.token;
  const { User } = await import('../../models');
  await User.deleteOne({ _id: sp.body.data.user.id });
  const res = await request(app).get('/api/v1/me').set('Authorization', `Bearer ${token}`);
  expect(res.status).toBe(401);
  expect(res.body.code).toBe('SESSION_EXPIRED');
});

test('set-pin with a session token → 401 OTP_SCOPE (otp-scope only)', async () => {
  const r = await request(app).post('/api/v1/auth/request-otp').send({ phone: PHONE });
  const v = await request(app).post('/api/v1/auth/verify-otp').send({ phone: PHONE, otp: r.body.data.demoOtp });
  const sp = await request(app).post('/api/v1/auth/set-pin').set('Authorization', `Bearer ${v.body.data.otpToken}`).send({ pin: '1234' });

  const again = await request(app).post('/api/v1/auth/set-pin')
    .set('Authorization', `Bearer ${sp.body.data.token}`).send({ pin: '5678' });
  expect(again.status).toBe(401);
  expect(again.body.code).toBe('OTP_SCOPE');
});

test('5 wrong PINs lock the account; 6th attempt (even the correct PIN) → 429 PIN_LOCKED', async () => {
  const r = await request(app).post('/api/v1/auth/request-otp').send({ phone: PHONE });
  const v = await request(app).post('/api/v1/auth/verify-otp').send({ phone: PHONE, otp: r.body.data.demoOtp });
  const sp = await request(app).post('/api/v1/auth/set-pin').set('Authorization', `Bearer ${v.body.data.otpToken}`).send({ pin: '1234' });
  const token = sp.body.data.token;

  let last;
  for (let i = 0; i < 5; i++) {
    last = await request(app).post('/api/v1/auth/verify-pin').set('Authorization', `Bearer ${token}`).send({ pin: '0000' });
  }
  expect(last!.status).toBe(401);
  expect(last!.body.code).toBe('INVALID_PIN');

  const locked = await request(app).post('/api/v1/auth/verify-pin').set('Authorization', `Bearer ${token}`).send({ pin: '1234' });
  expect(locked.status).toBe(429);
  expect(locked.body.code).toBe('PIN_LOCKED');
});

test('a correct PIN resets the wrong-attempt counter', async () => {
  const r = await request(app).post('/api/v1/auth/request-otp').send({ phone: PHONE });
  const v = await request(app).post('/api/v1/auth/verify-otp').send({ phone: PHONE, otp: r.body.data.demoOtp });
  const sp = await request(app).post('/api/v1/auth/set-pin').set('Authorization', `Bearer ${v.body.data.otpToken}`).send({ pin: '1234' });
  const token = sp.body.data.token;

  for (let i = 0; i < 3; i++) {
    await request(app).post('/api/v1/auth/verify-pin').set('Authorization', `Bearer ${token}`).send({ pin: '0000' });
  }
  const right = await request(app).post('/api/v1/auth/verify-pin').set('Authorization', `Bearer ${token}`).send({ pin: '1234' });
  expect(right.status).toBe(200);
  expect(right.body.data.valid).toBe(true);

  // counter reset by the correct PIN — a fresh run of only 4 wrong attempts must not lock yet
  let last;
  for (let i = 0; i < 4; i++) {
    last = await request(app).post('/api/v1/auth/verify-pin').set('Authorization', `Bearer ${token}`).send({ pin: '0000' });
  }
  expect(last!.status).toBe(401);
  expect(last!.body.code).toBe('INVALID_PIN');
});

test('request-otp for a new phone creates User + Account + Card, and verify-otp succeeds', async () => {
  const phone = '+923001113331';
  const r = await request(app).post('/api/v1/auth/request-otp').send({ phone });
  expect(r.status).toBe(201);
  expect(r.body.data.isNewUser).toBe(true);

  const user = await User.findOne({ phone });
  expect(user).toBeTruthy();
  expect(await Account.countDocuments({ userId: user!._id })).toBe(1);
  expect(await Card.countDocuments({ userId: user!._id })).toBe(1);

  const v = await request(app).post('/api/v1/auth/verify-otp').send({ phone, otp: r.body.data.demoOtp });
  expect(v.status).toBe(200);
  expect(v.body.data.otpToken).toBeTruthy();
});

test('a stale non-sparse unique index on email no longer blocks emailless signups after syncIndexes (regression)', async () => {
  // Simulate a legacy deployment where `email` still carries a plain unique index from
  // an old schema version — every emailless user has email:undefined, so a non-sparse
  // unique index treats them as duplicates of each other. (The test harness's own
  // beforeAll already built the current sparse index, so drop it first to get a clean
  // "before migration" state.)
  await mongoose.connection.collection('users').dropIndex('email_1');
  await mongoose.connection.collection('users').createIndex({ email: 1 }, { unique: true, name: 'email_1' });

  // This is the startup/seed migration step under test: syncIndexes drops the stale
  // index and rebuilds it per the current (sparse) schema. Without the model's
  // `sparse: true`, this line would just recreate the same blocking index and the
  // assertions below would fail.
  await User.syncIndexes();

  const phoneA = '+923001112221';
  const phoneB = '+923001112222';
  const a = await request(app).post('/api/v1/auth/request-otp').send({ phone: phoneA });
  const b = await request(app).post('/api/v1/auth/request-otp').send({ phone: phoneB });
  expect(a.status).toBe(201);
  expect(b.status).toBe(201);
  expect(await User.countDocuments({ phone: { $in: [phoneA, phoneB] } })).toBe(2);
});

test('concurrent request-otp for the same new phone does not 500 (create-race safe)', async () => {
  const phone = '+923001119999';
  const [a, b] = await Promise.all([
    request(app).post('/api/v1/auth/request-otp').send({ phone }),
    request(app).post('/api/v1/auth/request-otp').send({ phone }),
  ]);
  expect(a.status).toBe(201);
  expect(b.status).toBe(201);
  const { User } = await import('../../models');
  expect(await User.countDocuments({ phone })).toBe(1);
});
