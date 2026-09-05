import request from 'supertest';
import { createApp } from '../../app';
import { createVerifiedUser } from '../../testUtils/factories';
import { Biller, Institution, SavedBiller, Transaction, User } from '../../models';

const app = createApp();
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

const makePayo = () =>
  Institution.create({ name: 'PAYO', urduName: 'پیو', kind: 'wallet', code: 'PAYO', popular: true });

const kinds = (body: { data: { items: { kind: string }[] } }) => body.data.items.map(i => i.kind);

test('GET /me defaults preferences.proactiveGreeting to true; PATCH /me toggles it', async () => {
  const a = await createVerifiedUser(app);
  const me = await request(app).get('/api/v1/me').set(auth(a.token));
  expect(me.body.data.user.preferences).toEqual({ proactiveGreeting: true });
  expect(me.body.data.user.guardian).toBeUndefined();

  const patched = await request(app).patch('/api/v1/me').set(auth(a.token))
    .send({ preferences: { proactiveGreeting: false } });
  expect(patched.status).toBe(200);
  expect(patched.body.data.preferences.proactiveGreeting).toBe(false);
});

test('digest is empty when proactiveGreeting is off', async () => {
  const a = await createVerifiedUser(app);
  const b = await createVerifiedUser(app);
  const payo = await makePayo();
  const send = await request(app).post('/api/v1/transfers').set(auth(b.token))
    .send({ to: { institutionId: String(payo._id), identifier: a.user.phone }, amountPaisa: 25_000 });
  await request(app).post(`/api/v1/actions/${send.body.data.id}/execute`).set(auth(b.token)).send({ pin: '1234' });

  const on = await request(app).get('/api/v1/me/digest').set(auth(a.token));
  expect(kinds(on.body)).toContain('received');

  await request(app).patch('/api/v1/me').set(auth(a.token)).send({ preferences: { proactiveGreeting: false } });
  const off = await request(app).get('/api/v1/me/digest').set(auth(a.token));
  expect(off.status).toBe(200);
  expect(off.body.data.items).toEqual([]);
});

test('digest collects received money, a due bill, a pending request and a waiting approval', async () => {
  const me = await createVerifiedUser(app);
  const payer = await createVerifiedUser(app);
  const payee = await createVerifiedUser(app);
  const payo = await makePayo();

  // received
  const send = await request(app).post('/api/v1/transfers').set(auth(payer.token))
    .send({ to: { institutionId: String(payo._id), identifier: me.user.phone }, amountPaisa: 25_000 });
  await request(app).post(`/api/v1/actions/${send.body.data.id}/execute`).set(auth(payer.token)).send({ pin: '1234' });

  // bill due (via a saved biller)
  const biller = await Biller.create({ name: 'K-Electric', urduName: 'کے الیکٹرک', category: 'electricity' });
  await SavedBiller.create({ userId: me.userId, nickname: 'Home', billerId: biller._id, consumerNo: '0400012345678', consumerName: 'Ammi' });

  // incoming money request
  await request(app).post('/api/v1/requests').set(auth(payer.token))
    .send({ fromPhone: me.user.phone, amountPaisa: 15_000 });

  // an approval waiting on me as guardian
  await request(app).put('/api/v1/guardian').set(auth(payer.token)).send({ phone: me.user.phone, pin: '1234' });
  await request(app).post('/api/v1/transfers').set(auth(payer.token))
    .send({ to: { institutionId: String(payo._id), identifier: payee.user.phone }, amountPaisa: 40_000 });

  const res = await request(app).get('/api/v1/me/digest').set(auth(me.token));
  expect(res.status).toBe(200);
  expect(new Set(kinds(res.body))).toEqual(new Set(['received', 'bill_due', 'request', 'approval_waiting']));
  const received = res.body.data.items.find((i: { kind: string }) => i.kind === 'received');
  expect(received.amountPaisa).toBe(25_000);
  expect(res.body.data.since).toBeTruthy();
});

test('anomaly: at most one category, the largest ratio above 1.5x the previous 3-month average', async () => {
  const a = await createVerifiedUser(app);
  const now = new Date();
  const at = (monthsAgo: number, day: number) =>
    new Date(now.getFullYear(), now.getMonth() - monthsAgo, day, 12, 0, 0);
  let n = 0;
  const mk = (category: string, amountPaisa: number, createdAt: Date) => {
    n += 1;
    return {
      userId: a.userId, type: 'p2p', direction: 'out', amountPaisa, feePaisa: 0, category,
      counterparty: { name: 'Shop', detail: 'x' }, status: 'completed',
      refNo: `PAYO-AN${String(n).padStart(4, '0')}${a.userId.slice(-4)}`, createdAt,
    };
  };
  await Transaction.create([
    // food: 10,000 per month for 3 months → average 10,000; this month 100,000 → 10x
    mk('food', 10_000, at(1, 5)), mk('food', 10_000, at(2, 5)), mk('food', 10_000, at(3, 5)),
    mk('food', 100_000, at(0, 2)),
    // transport: average 10,000; this month 20,000 → 2x (smaller ratio, must lose)
    mk('transport', 10_000, at(1, 6)), mk('transport', 10_000, at(2, 6)), mk('transport', 10_000, at(3, 6)),
    mk('transport', 20_000, at(0, 3)),
    // bills: flat, no anomaly
    mk('bills', 30_000, at(1, 7)), mk('bills', 30_000, at(2, 7)), mk('bills', 30_000, at(3, 7)),
    mk('bills', 30_000, at(0, 4)),
  ]);

  const res = await request(app).get('/api/v1/me/digest').set(auth(a.token));
  const anomalies = res.body.data.items.filter((i: { kind: string }) => i.kind === 'anomaly');
  expect(anomalies).toHaveLength(1);
  expect(anomalies[0].category).toBe('food');
  expect(anomalies[0].thisMonthPaisa).toBe(100_000);
});

test('?ack=1 stamps lastDigestAt so already-seen items drop out', async () => {
  const a = await createVerifiedUser(app);
  const b = await createVerifiedUser(app);
  const payo = await makePayo();
  const send = await request(app).post('/api/v1/transfers').set(auth(b.token))
    .send({ to: { institutionId: String(payo._id), identifier: a.user.phone }, amountPaisa: 25_000 });
  await request(app).post(`/api/v1/actions/${send.body.data.id}/execute`).set(auth(b.token)).send({ pin: '1234' });

  const first = await request(app).get('/api/v1/me/digest?ack=1').set(auth(a.token));
  expect(kinds(first.body)).toContain('received');
  expect((await User.findById(a.userId))!.lastDigestAt).toBeTruthy();

  const second = await request(app).get('/api/v1/me/digest').set(auth(a.token));
  expect(kinds(second.body)).not.toContain('received');
});

test('a guardian notice reaches the guardian digest', async () => {
  process.env.GUARDIAN_COOLING_MS = '0';
  const payer = await createVerifiedUser(app);
  const guardian = await createVerifiedUser(app);
  await request(app).put('/api/v1/guardian').set(auth(payer.token))
    .send({ phone: guardian.user.phone, pin: '1234' });
  await request(app).delete('/api/v1/guardian').set(auth(payer.token)).send({ pin: '1234' });

  const res = await request(app).get('/api/v1/me/digest').set(auth(guardian.token));
  const notice = res.body.data.items.find((i: { kind: string }) => i.kind === 'guardian_notice');
  expect(notice).toBeTruthy();
  expect(notice.change).toBe('remove');
  expect(notice.payer.phone).toBe(payer.user.phone);
  delete process.env.GUARDIAN_COOLING_MS;
});

test('?ack=1 stamps lastDigestAt even when the greeting setting is off', async () => {
  const a = await createVerifiedUser(app);
  await request(app).patch('/api/v1/me').set(auth(a.token)).send({ preferences: { proactiveGreeting: false } });

  const res = await request(app).get('/api/v1/me/digest?ack=1').set(auth(a.token));
  expect(res.status).toBe(200);
  expect(res.body.data.items).toEqual([]);
  expect((await User.findById(a.userId))!.lastDigestAt).toBeTruthy();
});

test('the month boundary is exclusive — a transaction at midnight on the 1st is not double-counted', async () => {
  const a = await createVerifiedUser(app);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  await Transaction.create([{
    userId: a.userId, type: 'p2p', direction: 'out', amountPaisa: 60_000, feePaisa: 0, category: 'gadgets',
    counterparty: { name: 'Shop', detail: 'x' }, status: 'completed',
    refNo: `PAYO-BND1${a.userId.slice(-4)}`, createdAt: monthStart,
  }]);

  const res = await request(app).get('/api/v1/me/digest').set(auth(a.token));
  // Counted once, in THIS month; with an inclusive baseline it would also seed a fake
  // 3-month average of 20,000 and report itself as a 3x anomaly.
  expect(res.body.data.items.filter((i: { kind: string }) => i.kind === 'anomaly')).toHaveLength(0);
});

test('a Remind raises a reminder notice in the guardian digest', async () => {
  const payer = await createVerifiedUser(app);
  const guardian = await createVerifiedUser(app);
  const payee = await createVerifiedUser(app);
  const payo = await makePayo();
  await request(app).put('/api/v1/guardian').set(auth(payer.token))
    .send({ phone: guardian.user.phone, pin: '1234' });
  const action = await request(app).post('/api/v1/transfers').set(auth(payer.token))
    .send({ to: { institutionId: String(payo._id), identifier: payee.user.phone }, amountPaisa: 40_000 });

  const before = await request(app).get('/api/v1/me/digest').set(auth(guardian.token));
  expect(before.body.data.items.filter((i: { kind: string }) => i.kind === 'guardian_notice')).toHaveLength(0);

  const reminded = await request(app).post(`/api/v1/actions/${action.body.data.id}/remind`)
    .set(auth(payer.token)).send({});
  expect(reminded.status).toBe(200);

  const after = await request(app).get('/api/v1/me/digest').set(auth(guardian.token));
  const notice = after.body.data.items.find((i: { kind: string }) => i.kind === 'guardian_notice');
  expect(notice.change).toBe('reminder');
  expect(notice.actionId).toBe(action.body.data.id);
});
