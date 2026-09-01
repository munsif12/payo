import request from 'supertest';
import { createApp } from '../../app';
import { createVerifiedUser } from '../../testUtils/factories';
import { Account, Bank, Transaction } from '../../models';

const app = createApp();

async function balance(userId: string) {
  return (await Account.findOne({ userId }))!.balancePaisa;
}

async function executeAction(token: string, actionId: string, pin = '1234') {
  return request(app).post(`/api/v1/actions/${actionId}/execute`)
    .set('Authorization', `Bearer ${token}`).send({ pin });
}

test('P2P: A sends ₨1,500 to B by phone — both balances move, out/in txns exist', async () => {
  const a = await createVerifiedUser(app);
  const b = await createVerifiedUser(app);
  const create = await request(app).post('/api/v1/transfers')
    .set('Authorization', `Bearer ${a.token}`)
    .send({ to: { kind: 'payo', phone: b.user.phone }, amountPaisa: 150_000 });
  expect(create.status).toBe(201);
  expect(create.body.data.kind).toBe('send_money');
  expect(create.body.data.feePaisa).toBe(0);

  const exec = await executeAction(a.token, create.body.data.id);
  expect(exec.status).toBe(200);
  expect(await balance(a.userId)).toBe(850_000);
  expect(await balance(b.userId)).toBe(1_150_000);
  const outTxn = await Transaction.findOne({ userId: a.userId, direction: 'out' });
  const inTxn = await Transaction.findOne({ userId: b.userId, direction: 'in' });
  expect(outTxn!.type).toBe('p2p');
  expect(inTxn!.amountPaisa).toBe(150_000);
});

test('Bank: fee 2500, accountTitle line, debit 502500 on execute', async () => {
  const a = await createVerifiedUser(app);
  const bank = await Bank.create({ name: 'Meezan Bank', urduName: 'میزان بینک' });
  const create = await request(app).post('/api/v1/transfers')
    .set('Authorization', `Bearer ${a.token}`)
    .send({ to: { kind: 'bank', bankId: String(bank._id), iban: 'PK36MEZN0000001123456702' }, amountPaisa: 500_000 });
  expect(create.status).toBe(201);
  expect(create.body.data.kind).toBe('send_money_bank');
  expect(create.body.data.feePaisa).toBe(2500);
  const values = create.body.data.lines.map((l: { value: string }) => l.value).join(' ');
  expect(values).toMatch(/Meezan/);

  await executeAction(a.token, create.body.data.id);
  expect(await balance(a.userId)).toBe(497_500);
});

test('unknown phone → 404 RECIPIENT_NOT_FOUND; self phone → 400 SELF_TRANSFER', async () => {
  const a = await createVerifiedUser(app);
  const unknown = await request(app).post('/api/v1/transfers')
    .set('Authorization', `Bearer ${a.token}`)
    .send({ to: { kind: 'payo', phone: '+923009990000' }, amountPaisa: 1000 });
  expect(unknown.status).toBe(404);
  expect(unknown.body.code).toBe('RECIPIENT_NOT_FOUND');

  const self = await request(app).post('/api/v1/transfers')
    .set('Authorization', `Bearer ${a.token}`)
    .send({ to: { kind: 'payo', phone: a.user.phone }, amountPaisa: 1000 });
  expect(self.status).toBe(400);
  expect(self.body.code).toBe('SELF_TRANSFER');
});

test('insufficient funds at execute → 400, recipient balance unchanged', async () => {
  const a = await createVerifiedUser(app);
  const b = await createVerifiedUser(app);
  const create = await request(app).post('/api/v1/transfers')
    .set('Authorization', `Bearer ${a.token}`)
    .send({ to: { kind: 'payo', phone: b.user.phone }, amountPaisa: 5_000_000 });
  const exec = await executeAction(a.token, create.body.data.id);
  expect(exec.status).toBe(400);
  expect(await balance(a.userId)).toBe(1_000_000);
  expect(await balance(b.userId)).toBe(1_000_000);
});

test('contact kind resolves through own contact', async () => {
  const a = await createVerifiedUser(app);
  const b = await createVerifiedUser(app);
  const contact = await request(app).post('/api/v1/contacts')
    .set('Authorization', `Bearer ${a.token}`)
    .send({ name: 'Friend B', kind: 'payo', phone: b.user.phone });
  const create = await request(app).post('/api/v1/transfers')
    .set('Authorization', `Bearer ${a.token}`)
    .send({ to: { kind: 'contact', contactId: contact.body.data.id }, amountPaisa: 100_000 });
  expect(create.status).toBe(201);
  await executeAction(a.token, create.body.data.id);
  expect(await balance(b.userId)).toBe(1_100_000);
});
