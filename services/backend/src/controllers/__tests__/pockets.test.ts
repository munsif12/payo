import request from 'supertest';
import { createApp } from '../../app';
import { createVerifiedUser } from '../../testUtils/factories';
import { Account, Pocket } from '../../models';

const app = createApp();

async function makePocket(token: string) {
  const res = await request(app).post('/api/v1/pockets')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Umrah Fund', urduName: 'عمرہ فنڈ', emoji: '🕋', goalPaisa: 50_000_000 });
  return res.body.data;
}

test('deposit requires PIN (v5) — executes with the PIN: main debited, pocket credited', async () => {
  const { userId, token } = await createVerifiedUser(app);
  const pocket = await makePocket(token);
  const dep = await request(app).post(`/api/v1/pockets/${pocket.id}/deposit`)
    .set('Authorization', `Bearer ${token}`).send({ amountPaisa: 200_000 });
  expect(dep.status).toBe(201);
  expect(dep.body.data.requiresPin).toBe(true);

  const exec = await request(app).post(`/api/v1/actions/${dep.body.data.id}/execute`)
    .set('Authorization', `Bearer ${token}`).send({ pin: '1234' });
  expect(exec.status).toBe(200);
  expect((await Account.findOne({ userId }))!.balancePaisa).toBe(800_000);
  expect((await Pocket.findById(pocket.id))!.balancePaisa).toBe(200_000);
});

test('withdraw more than pocket holds → 400 INSUFFICIENT_POCKET_FUNDS', async () => {
  const { userId, token } = await createVerifiedUser(app);
  const pocket = await makePocket(token);
  const wd = await request(app).post(`/api/v1/pockets/${pocket.id}/withdraw`)
    .set('Authorization', `Bearer ${token}`).send({ amountPaisa: 100_000 });
  const exec = await request(app).post(`/api/v1/actions/${wd.body.data.id}/execute`)
    .set('Authorization', `Bearer ${token}`).send({ pin: '1234' });
  expect(exec.status).toBe(400);
  expect(exec.body.code).toBe('INSUFFICIENT_POCKET_FUNDS');
  expect((await Account.findOne({ userId }))!.balancePaisa).toBe(1_000_000);
});

test('withdraw round-trips money back to main', async () => {
  const { userId, token } = await createVerifiedUser(app);
  const pocket = await makePocket(token);
  const dep = await request(app).post(`/api/v1/pockets/${pocket.id}/deposit`)
    .set('Authorization', `Bearer ${token}`).send({ amountPaisa: 300_000 });
  await request(app).post(`/api/v1/actions/${dep.body.data.id}/execute`)
    .set('Authorization', `Bearer ${token}`).send({ pin: '1234' });
  const wd = await request(app).post(`/api/v1/pockets/${pocket.id}/withdraw`)
    .set('Authorization', `Bearer ${token}`).send({ amountPaisa: 100_000 });
  await request(app).post(`/api/v1/actions/${wd.body.data.id}/execute`)
    .set('Authorization', `Bearer ${token}`).send({ pin: '1234' });
  expect((await Account.findOne({ userId }))!.balancePaisa).toBe(800_000);
  expect((await Pocket.findById(pocket.id))!.balancePaisa).toBe(200_000);
});

test("other user's pocket → 404; list shows own pockets", async () => {
  const { token } = await createVerifiedUser(app);
  const other = await createVerifiedUser(app);
  const pocket = await makePocket(token);
  const res = await request(app).post(`/api/v1/pockets/${pocket.id}/deposit`)
    .set('Authorization', `Bearer ${other.token}`).send({ amountPaisa: 1000 });
  expect(res.status).toBe(404);
  const list = await request(app).get('/api/v1/pockets').set('Authorization', `Bearer ${token}`);
  expect(list.body.data.items).toHaveLength(1);
  expect(list.body.data.items[0].urduName).toBe('عمرہ فنڈ');
});
