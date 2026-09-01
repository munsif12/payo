import request from 'supertest';
import { createApp } from '../../app';
import { createVerifiedUser } from '../../testUtils/factories';
import { Bank } from '../../models';

const app = createApp();
const IBAN = 'PK36MEZN0000001123456702';

async function makeBank() {
  return Bank.create({ name: 'Meezan Bank', urduName: 'میزان بینک' });
}

test('create bank contact returns 201 with bankName; invalid IBAN → 400', async () => {
  const { token } = await createVerifiedUser(app);
  const bank = await makeBank();
  const res = await request(app).post('/api/v1/contacts').set('Authorization', `Bearer ${token}`)
    .send({ name: 'Bhai Jan', urduName: 'بھائی جان', kind: 'bank', bankId: String(bank._id), iban: IBAN });
  expect(res.status).toBe(201);
  expect(res.body.data.bankName).toBe('Meezan Bank');

  const bad = await request(app).post('/api/v1/contacts').set('Authorization', `Bearer ${token}`)
    .send({ name: 'X', kind: 'bank', bankId: String(bank._id), iban: 'NOT-AN-IBAN' });
  expect(bad.status).toBe(400);
});

test('resolve-title is deterministic', async () => {
  const { token } = await createVerifiedUser(app);
  const bank = await makeBank();
  const call = () => request(app).post('/api/v1/banks/resolve-title')
    .set('Authorization', `Bearer ${token}`).send({ bankId: String(bank._id), iban: IBAN });
  const a = await call();
  const b = await call();
  expect(a.status).toBe(200);
  expect(a.body.data.accountTitle).toBeTruthy();
  expect(a.body.data.accountTitle).toBe(b.body.data.accountTitle);
});

test('payo contact with existing user phone gets linkedUserId', async () => {
  const { token } = await createVerifiedUser(app);
  const other = await createVerifiedUser(app);
  const res = await request(app).post('/api/v1/contacts').set('Authorization', `Bearer ${token}`)
    .send({ name: 'Friend', kind: 'payo', phone: other.user.phone });
  expect(res.status).toBe(201);
  expect(res.body.data.linkedUserId).toBe(other.userId);
});

test('contacts list is ownership-scoped and banks list works', async () => {
  const { token } = await createVerifiedUser(app);
  const other = await createVerifiedUser(app);
  await makeBank();
  await request(app).post('/api/v1/contacts').set('Authorization', `Bearer ${token}`)
    .send({ name: 'Mine', kind: 'payo', phone: '+923009998877' });
  const mine = await request(app).get('/api/v1/contacts').set('Authorization', `Bearer ${token}`);
  expect(mine.body.data.items).toHaveLength(1);
  const theirs = await request(app).get('/api/v1/contacts').set('Authorization', `Bearer ${other.token}`);
  expect(theirs.body.data.items).toHaveLength(0);
  const banks = await request(app).get('/api/v1/banks').set('Authorization', `Bearer ${token}`);
  expect(banks.body.data.items).toHaveLength(1);
  expect(banks.body.data.items[0].urduName).toBe('میزان بینک');
});
