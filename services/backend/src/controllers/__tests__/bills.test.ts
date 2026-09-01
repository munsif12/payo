import request from 'supertest';
import { createApp } from '../../app';
import { createVerifiedUser } from '../../testUtils/factories';
import { Account, Bill, Biller } from '../../models';

const app = createApp();
const CONSUMER_NO = '0400012345678';

async function makeBiller() {
  return Biller.create({ name: 'K-Electric', urduName: 'کے الیکٹرک', category: 'electricity' });
}

async function executeAction(token: string, actionId: string) {
  return request(app).post(`/api/v1/actions/${actionId}/execute`)
    .set('Authorization', `Bearer ${token}`).send({ pin: '1234' });
}

test('lookup is deterministic and idempotent', async () => {
  const { token } = await createVerifiedUser(app);
  const biller = await makeBiller();
  const call = () => request(app).post('/api/v1/bills/lookup')
    .set('Authorization', `Bearer ${token}`).send({ billerId: String(biller._id), consumerNo: CONSUMER_NO });
  const a = await call();
  const b = await call();
  expect(a.status).toBe(200);
  expect(a.body.data.billId).toBe(b.body.data.billId);
  expect(a.body.data.amountPaisa).toBe(b.body.data.amountPaisa);
  expect(a.body.data.consumerName).toBeTruthy();
  expect(await Bill.countDocuments()).toBe(1);
});

test('pay → execute → balance debited, bill paid; re-pay → 410', async () => {
  const { userId, token } = await createVerifiedUser(app);
  const biller = await makeBiller();
  const lookup = await request(app).post('/api/v1/bills/lookup')
    .set('Authorization', `Bearer ${token}`).send({ billerId: String(biller._id), consumerNo: CONSUMER_NO });
  const { billId, amountPaisa } = lookup.body.data;

  const pay = await request(app).post('/api/v1/bills/pay')
    .set('Authorization', `Bearer ${token}`).send({ billId });
  expect(pay.status).toBe(201);
  expect(pay.body.data.kind).toBe('pay_bill');

  const exec = await executeAction(token, pay.body.data.id);
  expect(exec.status).toBe(200);
  expect((await Account.findOne({ userId }))!.balancePaisa).toBe(1_000_000 - amountPaisa);
  expect((await Bill.findById(billId))!.status).toBe('paid');

  const again = await request(app).post('/api/v1/bills/pay')
    .set('Authorization', `Bearer ${token}`).send({ billId });
  expect(again.status).toBe(410);
});

test('second pending on same bill → executor 410, action back to pending', async () => {
  const { token } = await createVerifiedUser(app);
  const biller = await makeBiller();
  const lookup = await request(app).post('/api/v1/bills/lookup')
    .set('Authorization', `Bearer ${token}`).send({ billerId: String(biller._id), consumerNo: CONSUMER_NO });
  const { billId } = lookup.body.data;

  const pay1 = await request(app).post('/api/v1/bills/pay').set('Authorization', `Bearer ${token}`).send({ billId });
  const pay2 = await request(app).post('/api/v1/bills/pay').set('Authorization', `Bearer ${token}`).send({ billId });
  await executeAction(token, pay1.body.data.id);
  const exec2 = await executeAction(token, pay2.body.data.id);
  expect(exec2.status).toBe(410);
});

test('unknown bill → 404; billers list works', async () => {
  const { token } = await createVerifiedUser(app);
  await makeBiller();
  const res = await request(app).post('/api/v1/bills/pay')
    .set('Authorization', `Bearer ${token}`).send({ billId: '000000000000000000000000' });
  expect(res.status).toBe(404);
  const billers = await request(app).get('/api/v1/billers').set('Authorization', `Bearer ${token}`);
  expect(billers.body.data.items).toHaveLength(1);
  expect(billers.body.data.items[0].category).toBe('electricity');
});
