import request from 'supertest';
import { createApp } from '../../app';
import { createVerifiedUser } from '../../testUtils/factories';
import { Account, Institution } from '../../models';

const app = createApp();
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

const makePayo = () =>
  Institution.create({ name: 'PAYO', urduName: 'پیو', kind: 'wallet', code: 'PAYO', popular: true, domain: 'payo.app' });

async function scenario() {
  const payer = await createVerifiedUser(app);
  const guardian = await createVerifiedUser(app, { pin: '4321' });
  const payee = await createVerifiedUser(app);
  const payo = await makePayo();
  await request(app).put('/api/v1/guardian').set(auth(payer.token))
    .send({ phone: guardian.user.phone, pin: '1234' });
  // A first payment to someone new only reaches the guardian at ₨20,000 or more, so the
  // payer needs a balance that can actually settle it once approved.
  await Account.updateOne({ userId: payer.userId }, { balancePaisa: 20_000_000 });
  const action = await request(app).post('/api/v1/transfers').set(auth(payer.token))
    .send({ to: { institutionId: String(payo._id), identifier: payee.user.phone }, amountPaisa: 2_000_000 });
  expect(action.status).toBe(201);
  return { payer, guardian, payee, actionId: action.body.data.id as string };
}

test('GET /approvals lists waiting actions for the guardian with payer details', async () => {
  const { payer, guardian } = await scenario();
  const res = await request(app).get('/api/v1/approvals').set(auth(guardian.token));
  expect(res.status).toBe(200);
  expect(res.body.data.items).toHaveLength(1);
  expect(res.body.data.items[0]).toMatchObject({
    payer: { name: payer.user.name, phone: payer.user.phone },
    amountPaisa: 2_000_000, riskFlags: [],
  });
  expect(res.body.data.items[0].summary.en).toContain('Send');
  expect(res.body.data.items[0].createdAt).toBeTruthy();
  expect(res.body.data.items[0].expiresAt).toBeTruthy();

  // The payer is not their own guardian.
  const asPayer = await request(app).get('/api/v1/approvals').set(auth(payer.token));
  expect(asPayer.body.data.items).toHaveLength(0);
});

test('guardian approves with their own PIN; the payer then still needs their own PIN to execute', async () => {
  const { payer, guardian, actionId } = await scenario();

  const wrongPin = await request(app).post(`/api/v1/approvals/${actionId}/approve`)
    .set(auth(guardian.token)).send({ pin: '1234' });
  expect(wrongPin.status).toBe(401);
  expect(wrongPin.body.code).toBe('INVALID_PIN');

  const approved = await request(app).post(`/api/v1/approvals/${actionId}/approve`)
    .set(auth(guardian.token)).send({ pin: '4321' });
  expect(approved.status).toBe(200);
  expect(approved.body.data.approval.status).toBe('approved');

  const noPin = await request(app).post(`/api/v1/actions/${actionId}/execute`)
    .set(auth(payer.token)).send({});
  expect(noPin.status).toBe(401);
  expect(noPin.body.code).toBe('INVALID_PIN');

  const exec = await request(app).post(`/api/v1/actions/${actionId}/execute`)
    .set(auth(payer.token)).send({ pin: '1234' });
  expect(exec.status).toBe(200);
  expect(await Account.findOne({ userId: payer.userId }).then(a => a!.balancePaisa)).toBe(18_000_000);
});

test('guardian declines with a reason → action cancelled, payer gets 410', async () => {
  const { payer, guardian, actionId } = await scenario();
  const declined = await request(app).post(`/api/v1/approvals/${actionId}/decline`)
    .set(auth(guardian.token)).send({ reason: 'Looks like a scam' });
  expect(declined.status).toBe(200);
  expect(declined.body.data.approval).toMatchObject({ status: 'declined', reason: 'Looks like a scam' });
  expect(declined.body.data.status).toBe('cancelled');

  const exec = await request(app).post(`/api/v1/actions/${actionId}/execute`)
    .set(auth(payer.token)).send({ pin: '1234' });
  expect(exec.status).toBe(410);
  expect(exec.body.code).toBe('ACTION_GONE');

  const list = await request(app).get('/api/v1/approvals').set(auth(guardian.token));
  expect(list.body.data.items).toHaveLength(0);
});

test('a non-guardian cannot see, approve or decline the action', async () => {
  const { payer, actionId } = await scenario();
  const stranger = await createVerifiedUser(app);

  const approve = await request(app).post(`/api/v1/approvals/${actionId}/approve`)
    .set(auth(stranger.token)).send({ pin: '1234' });
  expect(approve.status).toBe(404);

  const decline = await request(app).post(`/api/v1/approvals/${actionId}/decline`)
    .set(auth(stranger.token)).send({});
  expect(decline.status).toBe(404);

  // Even the payer cannot self-approve.
  const selfApprove = await request(app).post(`/api/v1/approvals/${actionId}/approve`)
    .set(auth(payer.token)).send({ pin: '1234' });
  expect(selfApprove.status).toBe(404);
});

test('approving twice → 410; a bad id → 404', async () => {
  const { guardian, actionId } = await scenario();
  await request(app).post(`/api/v1/approvals/${actionId}/approve`).set(auth(guardian.token)).send({ pin: '4321' });
  const again = await request(app).post(`/api/v1/approvals/${actionId}/approve`)
    .set(auth(guardian.token)).send({ pin: '4321' });
  expect(again.status).toBe(410);

  const bad = await request(app).post('/api/v1/approvals/not-an-id/approve')
    .set(auth(guardian.token)).send({ pin: '4321' });
  expect(bad.status).toBe(404);
});

test('approve/decline return the approvals list-item shape, not the raw action payload', async () => {
  const { payer, guardian, actionId } = await scenario();
  const res = await request(app).post(`/api/v1/approvals/${actionId}/approve`)
    .set(auth(guardian.token)).send({ pin: '4321' });
  expect(res.status).toBe(200);
  expect(Object.keys(res.body.data).sort()).toEqual(
    ['amountPaisa', 'approval', 'createdAt', 'expiresAt', 'feePaisa', 'id', 'kind', 'payer', 'riskFlags', 'status', 'summary'],
  );
  expect(res.body.data.payer).toMatchObject({ name: payer.user.name, phone: payer.user.phone });
  expect(res.body.data.approval.status).toBe('approved');
  // The payload, lines and the payer's own PIN requirement are not the guardian's business.
  expect(res.body.data.lines).toBeUndefined();
});

test('a guardian who has since been removed cannot approve or decline', async () => {
  process.env.GUARDIAN_COOLING_MS = '0';
  const { payer, guardian, actionId } = await scenario();
  await request(app).delete('/api/v1/guardian').set(auth(payer.token)).send({ pin: '1234' });

  const approve = await request(app).post(`/api/v1/approvals/${actionId}/approve`)
    .set(auth(guardian.token)).send({ pin: '4321' });
  expect(approve.status).toBe(404);
  const decline = await request(app).post(`/api/v1/approvals/${actionId}/decline`)
    .set(auth(guardian.token)).send({});
  expect(decline.status).toBe(404);
  const list = await request(app).get('/api/v1/approvals').set(auth(guardian.token));
  expect(list.body.data.items).toHaveLength(0);
  delete process.env.GUARDIAN_COOLING_MS;
});

test('a guardian replaced before deciding loses authority; the new one gains it', async () => {
  process.env.GUARDIAN_COOLING_MS = '0';
  const { payer, guardian, actionId } = await scenario();
  const replacement = await createVerifiedUser(app, { pin: '5678' });
  await request(app).put('/api/v1/guardian').set(auth(payer.token))
    .send({ phone: replacement.user.phone, pin: '1234' });

  const old = await request(app).post(`/api/v1/approvals/${actionId}/approve`)
    .set(auth(guardian.token)).send({ pin: '4321' });
  expect(old.status).toBe(404);

  const fresh = await request(app).post(`/api/v1/approvals/${actionId}/approve`)
    .set(auth(replacement.token)).send({ pin: '5678' });
  expect(fresh.status).toBe(200);
  delete process.env.GUARDIAN_COOLING_MS;
});
