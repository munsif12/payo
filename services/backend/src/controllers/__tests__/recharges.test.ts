import request from 'supertest';
import { createApp } from '../../app';
import { createVerifiedUser } from '../../testUtils/factories';
import { Account, Telco } from '../../models';

const app = createApp();

async function makeTelco() {
  return Telco.create({ name: 'Jazz', urduName: 'جاز' });
}

test('happy path recharge executes and debits', async () => {
  const { userId, token } = await createVerifiedUser(app);
  const telco = await makeTelco();
  const create = await request(app).post('/api/v1/recharges')
    .set('Authorization', `Bearer ${token}`)
    .send({ telcoId: String(telco._id), phone: '+923001234567', amountPaisa: 50_000 });
  expect(create.status).toBe(201);
  expect(create.body.data.kind).toBe('recharge');

  const exec = await request(app).post(`/api/v1/actions/${create.body.data.id}/execute`)
    .set('Authorization', `Bearer ${token}`).send({ pin: '1234' });
  expect(exec.status).toBe(200);
  expect(exec.body.data.transaction.type).toBe('recharge');
  expect((await Account.findOne({ userId }))!.balancePaisa).toBe(950_000);
});

test('below-min amount → 400 VALIDATION', async () => {
  const { token } = await createVerifiedUser(app);
  const telco = await makeTelco();
  const res = await request(app).post('/api/v1/recharges')
    .set('Authorization', `Bearer ${token}`)
    .send({ telcoId: String(telco._id), phone: '+923001234567', amountPaisa: 4000 });
  expect(res.status).toBe(400);
  expect(res.body.code).toBe('VALIDATION');
});

test('unknown telco → 404; telcos list works', async () => {
  const { token } = await createVerifiedUser(app);
  await makeTelco();
  const res = await request(app).post('/api/v1/recharges')
    .set('Authorization', `Bearer ${token}`)
    .send({ telcoId: '000000000000000000000000', phone: '+923001234567', amountPaisa: 50_000 });
  expect(res.status).toBe(404);
  const telcos = await request(app).get('/api/v1/telcos').set('Authorization', `Bearer ${token}`);
  expect(telcos.body.data.items).toHaveLength(1);
});
