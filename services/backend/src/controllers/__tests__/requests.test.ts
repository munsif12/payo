import request from 'supertest';
import { createApp } from '../../app';
import { createVerifiedUser } from '../../testUtils/factories';
import { Account, Institution, MoneyRequest, User } from '../../models';

const app = createApp();

// Settling a request resolves the requester's PAYO identity, so the PAYO institution must
// exist (the controller 500s otherwise — a broken seed, not a user error). clearDb runs
// after every test, so re-create it before each one; upsert keeps it idempotent.
const ensurePayo = () => Institution.findOneAndUpdate(
  { code: 'PAYO' },
  { $setOnInsert: { name: 'PAYO', urduName: 'پیو', kind: 'wallet', code: 'PAYO', popular: true, domain: 'payo.app' } },
  { upsert: true, new: true },
);
beforeEach(() => ensurePayo());

async function balance(userId: string) {
  return (await Account.findOne({ userId }))!.balancePaisa;
}

test('A requests from B; directions per viewer; approve → execute settles', async () => {
  const a = await createVerifiedUser(app);
  const b = await createVerifiedUser(app);
  const create = await request(app).post('/api/v1/requests')
    .set('Authorization', `Bearer ${a.token}`)
    .send({ fromPhone: b.user.phone, amountPaisa: 70_000, note: 'lunch' });
  expect(create.status).toBe(201);
  expect(create.body.data.request.direction).toBe('outgoing');
  const reqId = create.body.data.request.id;

  const bView = await request(app).get('/api/v1/requests').set('Authorization', `Bearer ${b.token}`);
  expect(bView.body.data.items[0].direction).toBe('incoming');
  const aView = await request(app).get('/api/v1/requests').set('Authorization', `Bearer ${a.token}`);
  expect(aView.body.data.items[0].direction).toBe('outgoing');

  const approve = await request(app).post(`/api/v1/requests/${reqId}/approve`)
    .set('Authorization', `Bearer ${b.token}`);
  expect(approve.status).toBe(201);
  const exec = await request(app).post(`/api/v1/actions/${approve.body.data.id}/execute`)
    .set('Authorization', `Bearer ${b.token}`).send({ pin: '1234' });
  expect(exec.status).toBe(200);
  expect(await balance(a.userId)).toBe(1_070_000);
  expect(await balance(b.userId)).toBe(930_000);
  expect((await MoneyRequest.findById(reqId))!.status).toBe('approved');
});

test('non-payer cannot approve → 404; decline of settled → 410', async () => {
  const a = await createVerifiedUser(app);
  const b = await createVerifiedUser(app);
  const c = await createVerifiedUser(app);
  const create = await request(app).post('/api/v1/requests')
    .set('Authorization', `Bearer ${a.token}`)
    .send({ fromPhone: b.user.phone, amountPaisa: 50_000 });
  const reqId = create.body.data.request.id;

  const cApprove = await request(app).post(`/api/v1/requests/${reqId}/approve`)
    .set('Authorization', `Bearer ${c.token}`);
  expect(cApprove.status).toBe(404);

  const approve = await request(app).post(`/api/v1/requests/${reqId}/approve`)
    .set('Authorization', `Bearer ${b.token}`);
  await request(app).post(`/api/v1/actions/${approve.body.data.id}/execute`)
    .set('Authorization', `Bearer ${b.token}`).send({ pin: '1234' });

  const decline = await request(app).post(`/api/v1/requests/${reqId}/decline`)
    .set('Authorization', `Bearer ${b.token}`);
  expect(decline.status).toBe(410);
});

test('approve→execute twice settles only once', async () => {
  const a = await createVerifiedUser(app);
  const b = await createVerifiedUser(app);
  const create = await request(app).post('/api/v1/requests')
    .set('Authorization', `Bearer ${a.token}`)
    .send({ fromPhone: b.user.phone, amountPaisa: 30_000 });
  const reqId = create.body.data.request.id;
  const approve = await request(app).post(`/api/v1/requests/${reqId}/approve`)
    .set('Authorization', `Bearer ${b.token}`);
  const exec = () => request(app).post(`/api/v1/actions/${approve.body.data.id}/execute`)
    .set('Authorization', `Bearer ${b.token}`).send({ pin: '1234' });
  await exec();
  const second = await exec();
  expect(second.status).toBe(410);
  expect(await balance(a.userId)).toBe(1_030_000);
});

test('self request → 400; unknown phone → 404', async () => {
  const a = await createVerifiedUser(app);
  const self = await request(app).post('/api/v1/requests')
    .set('Authorization', `Bearer ${a.token}`)
    .send({ fromPhone: a.user.phone, amountPaisa: 1000 });
  expect(self.status).toBe(400);
  const unk = await request(app).post('/api/v1/requests')
    .set('Authorization', `Bearer ${a.token}`)
    .send({ fromPhone: '+923000000000', amountPaisa: 1000 });
  expect(unk.status).toBe(404);
});

// --- v6: settling a money request is an outgoing money path and gets the same gates ---

const makePayo = () =>
  ensurePayo();

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

const makeSenior = (userId: string) =>
  User.updateOne({ _id: userId }, { dateOfBirth: new Date('1955-04-01T00:00:00.000Z') });

async function requestFrom(requesterToken: string, payerPhone: string, amountPaisa: number) {
  const create = await request(app).post('/api/v1/requests').set(auth(requesterToken))
    .send({ fromPhone: payerPhone, amountPaisa });
  expect(create.status).toBe(201);
  return create.body.data.request.id as string;
}

test('settlement to a never-paid requester with a guardian → approval waiting, 30-min expiry', async () => {
  await makePayo();
  const requester = await createVerifiedUser(app);
  const payer = await createVerifiedUser(app);
  const guardian = await createVerifiedUser(app);
  await request(app).put('/api/v1/guardian').set(auth(payer.token))
    .send({ phone: guardian.user.phone, pin: '1234' });

  // A first payment to someone new reaches the guardian at ₨20,000 or more.
  const reqId = await requestFrom(requester.token, payer.user.phone, 2_000_000);
  const approve = await request(app).post(`/api/v1/requests/${reqId}/approve`).set(auth(payer.token));
  expect(approve.status).toBe(201);
  expect(approve.body.data.approval).toMatchObject({ status: 'waiting', guardianId: guardian.userId });
  expect(new Date(approve.body.data.expiresAt).getTime() - Date.now()).toBeGreaterThan(25 * 60 * 1000);

  const exec = await request(app).post(`/api/v1/actions/${approve.body.data.id}/execute`)
    .set(auth(payer.token)).send({ pin: '1234' });
  expect(exec.status).toBe(403);
  expect(exec.body.code).toBe('APPROVAL_REQUIRED');
  expect(await balance(payer.userId)).toBe(1_000_000);
});

test('settlement over the ceiling waits even for an already-paid requester', async () => {
  const payo = await makePayo();
  const requester = await createVerifiedUser(app);
  const payer = await createVerifiedUser(app);
  const guardian = await createVerifiedUser(app);

  // Pay the requester once through the normal transfer path so they are no longer new.
  const seed = await request(app).post('/api/v1/transfers').set(auth(payer.token))
    .send({ to: { institutionId: String(payo._id), identifier: requester.user.phone }, amountPaisa: 10_000 });
  expect((await request(app).post(`/api/v1/actions/${seed.body.data.id}/execute`)
    .set(auth(payer.token)).send({ pin: '1234' })).status).toBe(200);

  await request(app).put('/api/v1/guardian').set(auth(payer.token))
    .send({ phone: guardian.user.phone, pin: '1234' });
  await request(app).patch('/api/v1/guardian/ceiling').set(auth(payer.token))
    .send({ ceilingPaisa: 20_000, pin: '1234' });

  const under = await request(app).post(`/api/v1/requests/${await requestFrom(requester.token, payer.user.phone, 19_999)}/approve`)
    .set(auth(payer.token));
  expect(under.body.data.approval).toBeNull();

  const over = await request(app).post(`/api/v1/requests/${await requestFrom(requester.token, payer.user.phone, 20_000)}/approve`)
    .set(auth(payer.token));
  expect(over.body.data.approval).toMatchObject({ status: 'waiting' });
});

test('a large settlement to a new requester is check-in gated even with no guardian', async () => {
  await makePayo();
  const requester = await createVerifiedUser(app);
  const payer = await createVerifiedUser(app);
  await makeSenior(payer.userId); // the money-pattern check-in is a senior-only courtesy
  const reqId = await requestFrom(requester.token, payer.user.phone, 300_000);
  const approve = await request(app).post(`/api/v1/requests/${reqId}/approve`).set(auth(payer.token));
  expect(approve.body.data.riskFlags).toEqual(['new_recipient_large']);

  const blocked = await request(app).post(`/api/v1/actions/${approve.body.data.id}/execute`)
    .set(auth(payer.token)).send({ pin: '1234' });
  expect(blocked.status).toBe(403);
  expect(blocked.body.code).toBe('CHECKIN_REQUIRED');

  await request(app).post(`/api/v1/actions/${approve.body.data.id}/check-in`)
    .set(auth(payer.token)).send({ someoneAsked: false });
  const exec = await request(app).post(`/api/v1/actions/${approve.body.data.id}/execute`)
    .set(auth(payer.token)).send({ pin: '1234' });
  expect(exec.status).toBe(200);
  expect(await balance(payer.userId)).toBe(700_000);
});

test('a completed settlement makes the requester a known recipient for later transfers', async () => {
  const payo = await makePayo();
  const requester = await createVerifiedUser(app);
  const payer = await createVerifiedUser(app);
  const guardian = await createVerifiedUser(app);

  const reqId = await requestFrom(requester.token, payer.user.phone, 20_000);
  const approve = await request(app).post(`/api/v1/requests/${reqId}/approve`).set(auth(payer.token));
  expect((await request(app).post(`/api/v1/actions/${approve.body.data.id}/execute`)
    .set(auth(payer.token)).send({ pin: '1234' })).status).toBe(200);

  await request(app).put('/api/v1/guardian').set(auth(payer.token))
    .send({ phone: guardian.user.phone, pin: '1234' });
  const later = await request(app).post('/api/v1/transfers').set(auth(payer.token))
    .send({ to: { institutionId: String(payo._id), identifier: requester.user.phone }, amountPaisa: 5_000 });
  expect(later.body.data.approval).toBeNull();
});
