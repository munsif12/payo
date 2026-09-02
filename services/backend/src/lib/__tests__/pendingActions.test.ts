import request from 'supertest';
import { createApp } from '../../app';
import { createVerifiedUser } from '../../testUtils/factories';
import { createPendingAction, registerExecutor } from '../pendingActions';
import { postTransaction } from '../money';
import { Account, PendingAction, User } from '../../models';

const app = createApp();
registerExecutor('test_debit', async (session, action) =>
  postTransaction(session, {
    userId: String(action.userId), type: 'p2p', direction: 'out',
    amountPaisa: action.amountPaisa, feePaisa: action.feePaisa,
    counterparty: { name: 'T', detail: 't' }, category: 'transfer',
  }));

async function makeAction(userId: string, amountPaisa = 100_000) {
  return createPendingAction({
    userId, kind: 'test_debit', payload: {}, amountPaisa, feePaisa: 0,
    summary: { en: 's', ur: 'س' }, lines: [],
  });
}

test('execute happy path: PIN → txn → balance debited → action completed', async () => {
  const { userId, token } = await createVerifiedUser(app);
  const a = await makeAction(userId);
  const res = await request(app).post(`/api/v1/actions/${a._id}/execute`)
    .set('Authorization', `Bearer ${token}`).send({ pin: '1234' });
  expect(res.status).toBe(200);
  expect(res.body.data.transaction.refNo).toMatch(/^PAYO-/);
  expect((await Account.findOne({ userId }))!.balancePaisa).toBe(900_000);
  expect((await PendingAction.findById(a._id))!.status).toBe('completed');
});

test('wrong PIN → 401, action still pending, balance untouched', async () => {
  const { userId, token } = await createVerifiedUser(app);
  const a = await makeAction(userId);
  const res = await request(app).post(`/api/v1/actions/${a._id}/execute`)
    .set('Authorization', `Bearer ${token}`).send({ pin: '0000' });
  expect(res.status).toBe(401);
  expect((await PendingAction.findById(a._id))!.status).toBe('pending');
  expect((await Account.findOne({ userId }))!.balancePaisa).toBe(1_000_000);
});

test('double execute: second call → 410, only one debit', async () => {
  const { userId, token } = await createVerifiedUser(app);
  const a = await makeAction(userId);
  const call = () => request(app).post(`/api/v1/actions/${a._id}/execute`)
    .set('Authorization', `Bearer ${token}`).send({ pin: '1234' });
  await call();
  const second = await call();
  expect(second.status).toBe(410);
  expect((await Account.findOne({ userId }))!.balancePaisa).toBe(900_000);
});

test('expired action → 410', async () => {
  const { userId, token } = await createVerifiedUser(app);
  const a = await makeAction(userId);
  await PendingAction.updateOne({ _id: a._id }, { expiresAt: new Date(Date.now() - 1000) });
  const res = await request(app).post(`/api/v1/actions/${a._id}/execute`)
    .set('Authorization', `Bearer ${token}`).send({ pin: '1234' });
  expect(res.status).toBe(410);
});

test("cannot execute another user's action → 404", async () => {
  const { userId } = await createVerifiedUser(app);
  const other = await createVerifiedUser(app);
  const a = await makeAction(userId);
  const res = await request(app).post(`/api/v1/actions/${a._id}/execute`)
    .set('Authorization', `Bearer ${other.token}`).send({ pin: '1234' });
  expect(res.status).toBe(404);
});

test('pinHash unset on the user → 401 INVALID_PIN, not 500', async () => {
  const { userId, token } = await createVerifiedUser(app);
  await User.updateOne({ _id: userId }, { $unset: { pinHash: 1 } });
  const a = await makeAction(userId);
  const res = await request(app).post(`/api/v1/actions/${a._id}/execute`)
    .set('Authorization', `Bearer ${token}`).send({ pin: '1234' });
  expect(res.status).toBe(401);
  expect(res.body.code).toBe('INVALID_PIN');
});

test('PIN lockout (5 wrong verify-pin attempts) also blocks /actions/:id/execute → 429', async () => {
  const { userId, token } = await createVerifiedUser(app);
  for (let i = 0; i < 5; i++) {
    await request(app).post('/api/v1/auth/verify-pin').set('Authorization', `Bearer ${token}`).send({ pin: '0000' });
  }
  const a = await makeAction(userId);
  const res = await request(app).post(`/api/v1/actions/${a._id}/execute`)
    .set('Authorization', `Bearer ${token}`).send({ pin: '1234' }); // correct PIN, still locked
  expect(res.status).toBe(429);
  expect(res.body.code).toBe('PIN_LOCKED');
});

test('cancel then execute → 410; insufficient funds → action returns to pending', async () => {
  const { userId, token } = await createVerifiedUser(app);
  const a = await makeAction(userId);
  await request(app).post(`/api/v1/actions/${a._id}/cancel`).set('Authorization', `Bearer ${token}`);
  const res = await request(app).post(`/api/v1/actions/${a._id}/execute`)
    .set('Authorization', `Bearer ${token}`).send({ pin: '1234' });
  expect(res.status).toBe(410);

  const big = await makeAction(userId, 5_000_000);
  const fail = await request(app).post(`/api/v1/actions/${big._id}/execute`)
    .set('Authorization', `Bearer ${token}`).send({ pin: '1234' });
  expect(fail.status).toBe(400);
  expect((await PendingAction.findById(big._id))!.status).toBe('pending');
});
