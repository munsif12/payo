import request from 'supertest';
import { createApp } from '../../app';
import { createVerifiedUser } from '../../testUtils/factories';
import { GuardianNotice, User } from '../../models';

const app = createApp();
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

const ORIGINAL_COOLING = process.env.GUARDIAN_COOLING_MS;
afterEach(() => {
  if (ORIGINAL_COOLING === undefined) delete process.env.GUARDIAN_COOLING_MS;
  else process.env.GUARDIAN_COOLING_MS = ORIGINAL_COOLING;
});

test('GET /guardian with none set → null guardian, default ceiling, coolingMs', async () => {
  process.env.GUARDIAN_COOLING_MS = '0';
  const a = await createVerifiedUser(app);
  const res = await request(app).get('/api/v1/guardian').set(auth(a.token));
  expect(res.status).toBe(200);
  expect(res.body.data.guardian).toBeNull();
  expect(res.body.data.pending).toBeNull();
  expect(res.body.data.ceilingPaisa).toBe(10_000_000);
  expect(res.body.data.coolingMs).toBe(0);
});

test('PUT /guardian sets instantly with the payer PIN and shows in GET /me', async () => {
  const a = await createVerifiedUser(app);
  const b = await createVerifiedUser(app);
  const res = await request(app).put('/api/v1/guardian').set(auth(a.token))
    .send({ phone: b.user.phone, pin: '1234' });
  expect(res.status).toBe(200);
  expect(res.body.data.guardian).toMatchObject({ phone: b.user.phone, name: b.user.name, ceilingPaisa: 10_000_000 });

  const me = await request(app).get('/api/v1/me').set(auth(a.token));
  expect(me.body.data.user.guardian).toEqual({ name: b.user.name, phone: b.user.phone });
});

test('PUT /guardian: wrong PIN → 401, unknown phone → 404 USER_NOT_FOUND, self → 400 SELF_GUARDIAN', async () => {
  const a = await createVerifiedUser(app);
  const b = await createVerifiedUser(app);

  const badPin = await request(app).put('/api/v1/guardian').set(auth(a.token))
    .send({ phone: b.user.phone, pin: '9999' });
  expect(badPin.status).toBe(401);
  expect(badPin.body.code).toBe('INVALID_PIN');

  const unknown = await request(app).put('/api/v1/guardian').set(auth(a.token))
    .send({ phone: '+923009990000', pin: '1234' });
  expect(unknown.status).toBe(404);
  expect(unknown.body.code).toBe('USER_NOT_FOUND');

  const self = await request(app).put('/api/v1/guardian').set(auth(a.token))
    .send({ phone: a.user.phone, pin: '1234' });
  expect(self.status).toBe(400);
  expect(self.body.code).toBe('SELF_GUARDIAN');
});

test('DELETE /guardian with cooling 0 removes immediately and leaves the guardian a notice', async () => {
  process.env.GUARDIAN_COOLING_MS = '0';
  const a = await createVerifiedUser(app);
  const b = await createVerifiedUser(app);
  await request(app).put('/api/v1/guardian').set(auth(a.token)).send({ phone: b.user.phone, pin: '1234' });

  const del = await request(app).delete('/api/v1/guardian').set(auth(a.token)).send({ pin: '1234' });
  expect(del.status).toBe(200);
  expect(del.body.data.guardian).toBeNull();
  expect(del.body.data.pending).toBeNull();

  const notice = await GuardianNotice.findOne({ userId: b.userId });
  expect(notice).not.toBeNull();
  expect(notice!.change).toBe('remove');
});

test('DELETE /guardian with 24h cooling schedules; old rule still applies until due, then applies lazily on read', async () => {
  process.env.GUARDIAN_COOLING_MS = String(24 * 60 * 60 * 1000);
  const a = await createVerifiedUser(app);
  const b = await createVerifiedUser(app);
  await request(app).put('/api/v1/guardian').set(auth(a.token)).send({ phone: b.user.phone, pin: '1234' });

  const del = await request(app).delete('/api/v1/guardian').set(auth(a.token)).send({ pin: '1234' });
  expect(del.status).toBe(200);
  expect(del.body.data.guardian).not.toBeNull();
  expect(del.body.data.pending.change).toBe('remove');

  const still = await request(app).get('/api/v1/guardian').set(auth(a.token));
  expect(still.body.data.guardian).not.toBeNull();

  // Make it due — lazy apply on the next read, no cron.
  await User.updateOne({ _id: a.userId }, { 'guardianPending.effectiveAt': new Date(Date.now() - 1000) });
  const after = await request(app).get('/api/v1/guardian').set(auth(a.token));
  expect(after.body.data.guardian).toBeNull();
  expect(after.body.data.pending).toBeNull();
});

test('PATCH /guardian/ceiling: lowering is instant, raising is scheduled and notifies the guardian', async () => {
  process.env.GUARDIAN_COOLING_MS = String(24 * 60 * 60 * 1000);
  const a = await createVerifiedUser(app);
  const b = await createVerifiedUser(app);
  await request(app).put('/api/v1/guardian').set(auth(a.token)).send({ phone: b.user.phone, pin: '1234' });

  const lower = await request(app).patch('/api/v1/guardian/ceiling').set(auth(a.token))
    .send({ ceilingPaisa: 2_000_000, pin: '1234' });
  expect(lower.status).toBe(200);
  expect(lower.body.data.guardian.ceilingPaisa).toBe(2_000_000);
  expect(lower.body.data.pending).toBeNull();

  const raise = await request(app).patch('/api/v1/guardian/ceiling').set(auth(a.token))
    .send({ ceilingPaisa: 50_000_000, pin: '1234' });
  expect(raise.status).toBe(200);
  expect(raise.body.data.guardian.ceilingPaisa).toBe(2_000_000);
  expect(raise.body.data.pending).toMatchObject({ change: 'raise', ceilingPaisa: 50_000_000 });
  expect(await GuardianNotice.countDocuments({ userId: b.userId, change: 'raise' })).toBe(1);

  await User.updateOne({ _id: a.userId }, { 'guardianPending.effectiveAt': new Date(Date.now() - 1000) });
  const after = await request(app).get('/api/v1/guardian').set(auth(a.token));
  expect(after.body.data.guardian.ceilingPaisa).toBe(50_000_000);
  expect(after.body.data.pending).toBeNull();
});

test('DELETE /guardian with no guardian → 404; guardian routes need auth', async () => {
  const a = await createVerifiedUser(app);
  const none = await request(app).delete('/api/v1/guardian').set(auth(a.token)).send({ pin: '1234' });
  expect(none.status).toBe(404);
  expect(none.body.code).toBe('NO_GUARDIAN');

  const noAuth = await request(app).get('/api/v1/guardian');
  expect(noAuth.status).toBe(401);
});

test('REPLACING a guardian cools off: the old guardian keeps authority until it is due', async () => {
  process.env.GUARDIAN_COOLING_MS = String(24 * 60 * 60 * 1000);
  const a = await createVerifiedUser(app);
  const first = await createVerifiedUser(app);
  const second = await createVerifiedUser(app);

  const initial = await request(app).put('/api/v1/guardian').set(auth(a.token))
    .send({ phone: first.user.phone, pin: '1234' });
  expect(initial.body.data.guardian.phone).toBe(first.user.phone);
  expect(initial.body.data.pending).toBeNull();

  const swap = await request(app).put('/api/v1/guardian').set(auth(a.token))
    .send({ phone: second.user.phone, pin: '1234' });
  expect(swap.status).toBe(200);
  expect(swap.body.data.guardian.phone).toBe(first.user.phone);
  expect(swap.body.data.pending).toMatchObject({ change: 'replace', phone: second.user.phone });
  expect(await GuardianNotice.countDocuments({ userId: first.userId, change: 'replace' })).toBe(1);

  await User.updateOne({ _id: a.userId }, { 'guardianPending.effectiveAt': new Date(Date.now() - 1000) });
  const after = await request(app).get('/api/v1/guardian').set(auth(a.token));
  expect(after.body.data.guardian.phone).toBe(second.user.phone);
  expect(after.body.data.pending).toBeNull();
});

test('with cooling 0 a replacement lands immediately', async () => {
  process.env.GUARDIAN_COOLING_MS = '0';
  const a = await createVerifiedUser(app);
  const first = await createVerifiedUser(app);
  const second = await createVerifiedUser(app);
  await request(app).put('/api/v1/guardian').set(auth(a.token)).send({ phone: first.user.phone, pin: '1234' });

  const swap = await request(app).put('/api/v1/guardian').set(auth(a.token))
    .send({ phone: second.user.phone, pin: '1234' });
  expect(swap.body.data.guardian.phone).toBe(second.user.phone);
  expect(swap.body.data.pending).toBeNull();
});

test('re-nominating the SAME guardian is tightening — instant, and it cancels a pending removal', async () => {
  process.env.GUARDIAN_COOLING_MS = String(24 * 60 * 60 * 1000);
  const a = await createVerifiedUser(app);
  const g = await createVerifiedUser(app);
  await request(app).put('/api/v1/guardian').set(auth(a.token)).send({ phone: g.user.phone, pin: '1234' });
  await request(app).delete('/api/v1/guardian').set(auth(a.token)).send({ pin: '1234' });

  const again = await request(app).put('/api/v1/guardian').set(auth(a.token))
    .send({ phone: g.user.phone, pin: '1234' });
  expect(again.body.data.guardian.phone).toBe(g.user.phone);
  expect(again.body.data.pending).toBeNull();
});
