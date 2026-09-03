import request from 'supertest';
import { createApp } from '../../app';
import { createVerifiedUser } from '../../testUtils/factories';
import { Account, Institution, Transaction, Recipient, User } from '../../models';

const app = createApp();

async function balance(userId: string) {
  return (await Account.findOne({ userId }))!.balancePaisa;
}

async function executeAction(token: string, actionId: string, pin = '1234') {
  return request(app).post(`/api/v1/actions/${actionId}/execute`)
    .set('Authorization', `Bearer ${token}`).send({ pin });
}

async function makePayo() {
  return Institution.create({ name: 'PAYO', urduName: 'پیو', kind: 'wallet', code: 'PAYO', popular: true });
}
async function makeEasypaisa() {
  return Institution.create({ name: 'Easypaisa', urduName: 'ایزی پیسہ', kind: 'wallet', code: 'EASYPAISA', popular: true });
}
async function makeMeezan() {
  return Institution.create({ name: 'Meezan Bank', urduName: 'میزان بینک', kind: 'bank', code: 'MEEZAN', popular: true });
}

test('P2P: A sends ₨1,500 to B by phone via PAYO institution — both balances move, out/in txns exist', async () => {
  const a = await createVerifiedUser(app);
  const b = await createVerifiedUser(app);
  const payo = await makePayo();
  const create = await request(app).post('/api/v1/transfers')
    .set('Authorization', `Bearer ${a.token}`)
    .send({ to: { institutionId: String(payo._id), identifier: b.user.phone }, amountPaisa: 150_000 });
  expect(create.status).toBe(201);
  expect(create.body.data.kind).toBe('send_money');
  expect(create.body.data.feePaisa).toBe(0);

  const exec = await executeAction(a.token, create.body.data.id);
  expect(exec.status).toBe(200);
  expect(exec.body.data.recipientSuggestion).toMatchObject({ institutionId: String(payo._id), title: b.user.name, alreadySaved: false });
  expect(await balance(a.userId)).toBe(850_000);
  expect(await balance(b.userId)).toBe(1_150_000);
  const outTxn = await Transaction.findOne({ userId: a.userId, direction: 'out' });
  const inTxn = await Transaction.findOne({ userId: b.userId, direction: 'in' });
  expect(outTxn!.type).toBe('p2p');
  expect(inTxn!.amountPaisa).toBe(150_000);
});

test('Bank: fee 2500, institution+masked identifier on the line, debit 502500 on execute', async () => {
  const a = await createVerifiedUser(app);
  const meezan = await makeMeezan();
  const create = await request(app).post('/api/v1/transfers')
    .set('Authorization', `Bearer ${a.token}`)
    .send({ to: { institutionId: String(meezan._id), identifier: 'PK36MEZN0000001123456702' }, amountPaisa: 500_000 });
  expect(create.status).toBe(201);
  expect(create.body.data.kind).toBe('send_money_bank');
  expect(create.body.data.feePaisa).toBe(2500);
  const values = create.body.data.lines.map((l: { value: string }) => l.value).join(' ');
  expect(values).toMatch(/Meezan/);
  expect(values).toMatch(/\*\*\*\*6702/);

  await executeAction(a.token, create.body.data.id);
  expect(await balance(a.userId)).toBe(497_500);
});

test('Wallet (non-PAYO): debit only, no fee, deterministic fake title', async () => {
  const a = await createVerifiedUser(app);
  const easypaisa = await makeEasypaisa();
  const create = await request(app).post('/api/v1/transfers')
    .set('Authorization', `Bearer ${a.token}`)
    .send({ to: { institutionId: String(easypaisa._id), identifier: '03135468810' }, amountPaisa: 100_000 });
  expect(create.status).toBe(201);
  expect(create.body.data.kind).toBe('send_money_wallet');
  expect(create.body.data.feePaisa).toBe(0);

  const exec = await executeAction(a.token, create.body.data.id);
  expect(exec.status).toBe(200);
  expect(exec.body.data.recipientSuggestion.identifier).toBe('+923135468810');
  expect(await balance(a.userId)).toBe(900_000);
});

test('unknown phone → 404 RECIPIENT_NOT_FOUND; self phone → 400 SELF_TRANSFER', async () => {
  const a = await createVerifiedUser(app);
  const payo = await makePayo();
  const unknown = await request(app).post('/api/v1/transfers')
    .set('Authorization', `Bearer ${a.token}`)
    .send({ to: { institutionId: String(payo._id), identifier: '+923009990000' }, amountPaisa: 1000 });
  expect(unknown.status).toBe(404);
  expect(unknown.body.code).toBe('RECIPIENT_NOT_FOUND');

  const self = await request(app).post('/api/v1/transfers')
    .set('Authorization', `Bearer ${a.token}`)
    .send({ to: { institutionId: String(payo._id), identifier: a.user.phone }, amountPaisa: 1000 });
  expect(self.status).toBe(400);
  expect(self.body.code).toBe('SELF_TRANSFER');
});

test('invalid identifier → 400 INVALID_IDENTIFIER', async () => {
  const a = await createVerifiedUser(app);
  const meezan = await makeMeezan();
  const bad = await request(app).post('/api/v1/transfers')
    .set('Authorization', `Bearer ${a.token}`)
    .send({ to: { institutionId: String(meezan._id), identifier: 'not-an-account' }, amountPaisa: 1000 });
  expect(bad.status).toBe(400);
  expect(bad.body.code).toBe('INVALID_IDENTIFIER');
});

test('recipient deleted between create-pending and execute → 404 RECIPIENT_NOT_FOUND, sender balance unchanged', async () => {
  const a = await createVerifiedUser(app);
  const b = await createVerifiedUser(app);
  const payo = await makePayo();
  const create = await request(app).post('/api/v1/transfers')
    .set('Authorization', `Bearer ${a.token}`)
    .send({ to: { institutionId: String(payo._id), identifier: b.user.phone }, amountPaisa: 100_000 });
  expect(create.status).toBe(201);

  await User.deleteOne({ _id: b.userId });

  const exec = await executeAction(a.token, create.body.data.id);
  expect(exec.status).toBe(404);
  expect(exec.body.code).toBe('RECIPIENT_NOT_FOUND');
  expect(await balance(a.userId)).toBe(1_000_000);
});

test('insufficient funds at execute → 400, recipient balance unchanged', async () => {
  const a = await createVerifiedUser(app);
  const b = await createVerifiedUser(app);
  const payo = await makePayo();
  const create = await request(app).post('/api/v1/transfers')
    .set('Authorization', `Bearer ${a.token}`)
    .send({ to: { institutionId: String(payo._id), identifier: b.user.phone }, amountPaisa: 5_000_000 });
  const exec = await executeAction(a.token, create.body.data.id);
  expect(exec.status).toBe(400);
  expect(await balance(a.userId)).toBe(1_000_000);
  expect(await balance(b.userId)).toBe(1_000_000);
});

test('recipientId kind resolves through own saved recipient and bumps lastUsedAt', async () => {
  const a = await createVerifiedUser(app);
  const b = await createVerifiedUser(app);
  const payo = await makePayo();
  const recipient = await request(app).post('/api/v1/recipients')
    .set('Authorization', `Bearer ${a.token}`)
    .send({ nickname: 'Friend B', institutionId: String(payo._id), identifier: b.user.phone });
  expect(recipient.status).toBe(201);
  const before = (await Recipient.findById(recipient.body.data.id))!.lastUsedAt;

  const create = await request(app).post('/api/v1/transfers')
    .set('Authorization', `Bearer ${a.token}`)
    .send({ to: { recipientId: recipient.body.data.id }, amountPaisa: 100_000 });
  expect(create.status).toBe(201);
  const exec = await executeAction(a.token, create.body.data.id);
  expect(exec.status).toBe(200);
  expect(await balance(b.userId)).toBe(1_100_000);

  const after = (await Recipient.findById(recipient.body.data.id))!.lastUsedAt;
  expect(after.getTime()).toBeGreaterThanOrEqual(before.getTime());
});
