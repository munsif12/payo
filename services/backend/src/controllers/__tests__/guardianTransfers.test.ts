import request from 'supertest';
import { createApp } from '../../app';
import { createVerifiedUser } from '../../testUtils/factories';
import { Account, Institution, PendingAction, User } from '../../models';

const app = createApp();
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

const makePayo = () =>
  Institution.create({ name: 'PAYO', urduName: 'پیو', kind: 'wallet', code: 'PAYO', popular: true, domain: 'payo.app' });

async function setGuardian(payerToken: string, guardianPhone: string) {
  const res = await request(app).put('/api/v1/guardian').set(auth(payerToken))
    .send({ phone: guardianPhone, pin: '1234' });
  expect(res.status).toBe(200);
}

const send = (token: string, body: Record<string, unknown>) =>
  request(app).post('/api/v1/transfers').set(auth(token)).send(body);

const execute = (token: string, id: string, pin = '1234') =>
  request(app).post(`/api/v1/actions/${id}/execute`).set(auth(token)).send({ pin });

/** Ages a user past 60 so the senior-only money-pattern check-in applies to them. */
const makeSenior = (userId: string) =>
  User.updateOne({ _id: userId }, { dateOfBirth: new Date('1955-04-01T00:00:00.000Z') });

// A first payment to someone new only reaches the guardian at ₨20,000 or more.
const OVER_NEW_RECIPIENT_APPROVAL = 2_000_000;

test('no guardian set → no approval, no risk flags, 2-minute expiry', async () => {
  const a = await createVerifiedUser(app);
  const b = await createVerifiedUser(app);
  const payo = await makePayo();
  const res = await send(a.token, { to: { institutionId: String(payo._id), identifier: b.user.phone }, amountPaisa: 100_000 });
  expect(res.status).toBe(201);
  expect(res.body.data.approval).toBeNull();
  expect(res.body.data.riskFlags).toEqual([]);
  const ttl = new Date(res.body.data.expiresAt).getTime() - Date.now();
  expect(ttl).toBeLessThan(3 * 60 * 1000);

  const exec = await execute(a.token, res.body.data.id);
  expect(exec.status).toBe(200);
});

test('new recipient with a guardian → approval waiting, 30-minute expiry, execute 403 APPROVAL_REQUIRED', async () => {
  const a = await createVerifiedUser(app);
  const b = await createVerifiedUser(app);
  const g = await createVerifiedUser(app);
  const payo = await makePayo();
  await setGuardian(a.token, g.user.phone);

  const res = await send(a.token, { to: { institutionId: String(payo._id), identifier: b.user.phone }, amountPaisa: OVER_NEW_RECIPIENT_APPROVAL });
  expect(res.status).toBe(201);
  expect(res.body.data.approval).toMatchObject({ required: true, status: 'waiting', guardianId: g.userId });
  const ttl = new Date(res.body.data.expiresAt).getTime() - Date.now();
  expect(ttl).toBeGreaterThan(25 * 60 * 1000);

  const exec = await execute(a.token, res.body.data.id);
  expect(exec.status).toBe(403);
  expect(exec.body.code).toBe('APPROVAL_REQUIRED');
});

test('a recipient already paid before never needs approval; saved-but-never-paid still does', async () => {
  const a = await createVerifiedUser(app);
  const b = await createVerifiedUser(app);
  const c = await createVerifiedUser(app);
  const g = await createVerifiedUser(app);
  const payo = await makePayo();

  // Pay B once before the guardian exists.
  const first = await send(a.token, { to: { institutionId: String(payo._id), identifier: b.user.phone }, amountPaisa: 10_000 });
  expect((await execute(a.token, first.body.data.id)).status).toBe(200);

  // Save C as a recipient but never pay them.
  const saved = await request(app).post('/api/v1/recipients').set(auth(a.token))
    .send({ nickname: 'Cousin', institutionId: String(payo._id), identifier: c.user.phone });
  expect(saved.status).toBe(201);

  await setGuardian(a.token, g.user.phone);

  const again = await send(a.token, { to: { institutionId: String(payo._id), identifier: b.user.phone }, amountPaisa: 10_000 });
  expect(again.body.data.approval).toBeNull();
  expect((await execute(a.token, again.body.data.id)).status).toBe(200);

  const toSaved = await send(a.token, { to: { recipientId: saved.body.data.id }, amountPaisa: OVER_NEW_RECIPIENT_APPROVAL });
  expect(toSaved.body.data.approval).toMatchObject({ status: 'waiting' });
});

test('amount at or above the ceiling needs approval even for a known recipient', async () => {
  const a = await createVerifiedUser(app);
  const b = await createVerifiedUser(app);
  const g = await createVerifiedUser(app);
  const payo = await makePayo();
  await Account.updateOne({ userId: a.userId }, { balancePaisa: 100_000_000 });

  const first = await send(a.token, { to: { institutionId: String(payo._id), identifier: b.user.phone }, amountPaisa: 10_000 });
  await execute(a.token, first.body.data.id);
  await setGuardian(a.token, g.user.phone);
  await request(app).patch('/api/v1/guardian/ceiling').set(auth(a.token))
    .send({ ceilingPaisa: 5_000_000, pin: '1234' });

  const under = await send(a.token, { to: { institutionId: String(payo._id), identifier: b.user.phone }, amountPaisa: 4_999_999 });
  expect(under.body.data.approval).toBeNull();

  const over = await send(a.token, { to: { institutionId: String(payo._id), identifier: b.user.phone }, amountPaisa: 5_000_000 });
  expect(over.body.data.approval).toMatchObject({ status: 'waiting' });
});

test('backend adds new_recipient_large; check-in gates execute even with no guardian', async () => {
  const a = await createVerifiedUser(app);
  const b = await createVerifiedUser(app);
  const payo = await makePayo();
  await makeSenior(a.userId); // the money-pattern check-in is a senior-only courtesy

  // Balance is 1,000,000 — 300,000 is 30% of it and the recipient is new.
  const res = await send(a.token, { to: { institutionId: String(payo._id), identifier: b.user.phone }, amountPaisa: 300_000 });
  expect(res.body.data.riskFlags).toEqual(['new_recipient_large']);
  expect(res.body.data.approval).toBeNull();
  const ttl = new Date(res.body.data.expiresAt).getTime() - Date.now();
  expect(ttl).toBeGreaterThan(25 * 60 * 1000);

  const blocked = await execute(a.token, res.body.data.id);
  expect(blocked.status).toBe(403);
  expect(blocked.body.code).toBe('CHECKIN_REQUIRED');

  const no = await request(app).post(`/api/v1/actions/${res.body.data.id}/check-in`)
    .set(auth(a.token)).send({ someoneAsked: false });
  expect(no.status).toBe(200);
  expect(no.body.data.checkIn).toEqual({ answered: true, someoneAsked: false });
  expect((await execute(a.token, res.body.data.id)).status).toBe(200);
});

test('pressure_language from the AI forces approval and is validated against the allow-list', async () => {
  const a = await createVerifiedUser(app);
  const b = await createVerifiedUser(app);
  const g = await createVerifiedUser(app);
  const payo = await makePayo();

  const first = await send(a.token, { to: { institutionId: String(payo._id), identifier: b.user.phone }, amountPaisa: 10_000 });
  await execute(a.token, first.body.data.id);
  await setGuardian(a.token, g.user.phone);

  const flagged = await send(a.token, {
    to: { institutionId: String(payo._id), identifier: b.user.phone },
    amountPaisa: 10_000, riskFlags: ['pressure_language'],
  });
  expect(flagged.body.data.riskFlags).toEqual(['pressure_language']);
  expect(flagged.body.data.approval).toMatchObject({ status: 'waiting' });

  const bogus = await send(a.token, {
    to: { institutionId: String(payo._id), identifier: b.user.phone },
    amountPaisa: 10_000, riskFlags: ['definitely_fine'],
  });
  expect(bogus.status).toBe(400);
  expect(bogus.body.code).toBe('VALIDATION');
});

test('check-in "yes, someone asked" cancels the action with reason scam_checkin → 410 on execute', async () => {
  const a = await createVerifiedUser(app);
  const b = await createVerifiedUser(app);
  const payo = await makePayo();
  await makeSenior(a.userId);
  const res = await send(a.token, { to: { institutionId: String(payo._id), identifier: b.user.phone }, amountPaisa: 300_000 });

  const yes = await request(app).post(`/api/v1/actions/${res.body.data.id}/check-in`)
    .set(auth(a.token)).send({ someoneAsked: true });
  expect(yes.status).toBe(200);
  expect(yes.body.data.status).toBe('cancelled');
  expect(yes.body.data.cancelReason).toBe('scam_checkin');

  const exec = await execute(a.token, res.body.data.id);
  expect(exec.status).toBe(410);
  expect(exec.body.code).toBe('ACTION_GONE');
  expect(await Account.findOne({ userId: a.userId }).then(x => x!.balancePaisa)).toBe(1_000_000);
});

test('GET /actions/:id returns the own DTO with approval/riskFlags/checkIn; another user gets 404', async () => {
  const a = await createVerifiedUser(app);
  const b = await createVerifiedUser(app);
  const g = await createVerifiedUser(app);
  const payo = await makePayo();
  await setGuardian(a.token, g.user.phone);
  const res = await send(a.token, { to: { institutionId: String(payo._id), identifier: b.user.phone }, amountPaisa: OVER_NEW_RECIPIENT_APPROVAL });

  const got = await request(app).get(`/api/v1/actions/${res.body.data.id}`).set(auth(a.token));
  expect(got.status).toBe(200);
  expect(got.body.data.approval.status).toBe('waiting');
  expect(got.body.data.riskFlags).toEqual([]);
  expect(got.body.data.checkIn).toBeNull();

  const other = await request(app).get(`/api/v1/actions/${res.body.data.id}`).set(auth(b.token));
  expect(other.status).toBe(404);
});

test('POST /actions/:id/remind is rate-limited to once a minute', async () => {
  const a = await createVerifiedUser(app);
  const b = await createVerifiedUser(app);
  const g = await createVerifiedUser(app);
  const payo = await makePayo();
  await setGuardian(a.token, g.user.phone);
  const res = await send(a.token, { to: { institutionId: String(payo._id), identifier: b.user.phone }, amountPaisa: OVER_NEW_RECIPIENT_APPROVAL });
  const id = res.body.data.id;

  const first = await request(app).post(`/api/v1/actions/${id}/remind`).set(auth(a.token)).send({});
  expect(first.status).toBe(200);
  expect(first.body.data.reminded).toBe(true);

  const second = await request(app).post(`/api/v1/actions/${id}/remind`).set(auth(a.token)).send({});
  expect(second.status).toBe(429);
  expect(second.body.code).toBe('REMIND_TOO_SOON');

  await PendingAction.updateOne({ _id: id }, { 'approval.remindedAt': new Date(Date.now() - 61_000) });
  const third = await request(app).post(`/api/v1/actions/${id}/remind`).set(auth(a.token)).send({});
  expect(third.status).toBe(200);
});
