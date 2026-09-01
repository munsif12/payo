import request from 'supertest';
import { createApp } from '../app';
import { runSeed } from '../seed/seed';
import { Biller } from '../models';

const app = createApp();

test('demo-world end-to-end smoke through the public API', async () => {
  await runSeed();

  // login as Ammi
  const login = await request(app).post('/api/v1/auth/login')
    .send({ email: 'ammi@payo.demo', pin: '1234' });
  const token = login.body.data.token;
  const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);

  // balance
  const me = await auth(request(app).get('/api/v1/me'));
  expect(me.body.data.account.balancePaisa).toBe(8_450_000);

  // K-Electric bill lookup → pay → execute with PIN
  const kElectric = (await Biller.findOne({ name: 'K-Electric' }))!;
  const lookup = await auth(request(app).post('/api/v1/bills/lookup'))
    .send({ billerId: String(kElectric._id), consumerNo: '0400012345678' });
  expect(lookup.body.data.amountPaisa).toBe(432_000);
  const pay = await auth(request(app).post('/api/v1/bills/pay')).send({ billId: lookup.body.data.billId });
  const payExec = await auth(request(app).post(`/api/v1/actions/${pay.body.data.id}/execute`)).send({ pin: '1234' });
  expect(payExec.status).toBe(200);

  const afterBill = await auth(request(app).get('/api/v1/me'));
  expect(afterBill.body.data.account.balancePaisa).toBe(8_450_000 - 432_000);

  // send ₨1,500 to Bilal
  const transfer = await auth(request(app).post('/api/v1/transfers'))
    .send({ to: { kind: 'payo', phone: '+923001110002' }, amountPaisa: 150_000 });
  const tExec = await auth(request(app).post(`/api/v1/actions/${transfer.body.data.id}/execute`)).send({ pin: '1234' });
  expect(tExec.status).toBe(200);

  const afterSend = await auth(request(app).get('/api/v1/me'));
  expect(afterSend.body.data.account.balancePaisa).toBe(8_450_000 - 432_000 - 150_000);

  const bilalLogin = await request(app).post('/api/v1/auth/login')
    .send({ email: 'bilal@payo.demo', pin: '1234' });
  const bilalMe = await request(app).get('/api/v1/me')
    .set('Authorization', `Bearer ${bilalLogin.body.data.token}`);
  expect(bilalMe.body.data.account.balancePaisa).toBe(6_230_000 + 150_000);

  // statement for the current month (bill + transfer just made activity)
  const now = new Date();
  const stmt = await auth(request(app).post('/api/v1/statements'))
    .send({ year: now.getFullYear(), month: now.getMonth() + 1 });
  expect(stmt.status).toBe(201);
  const pdf = await auth(request(app).get(`/api/v1/statements/${stmt.body.data.statementId}/pdf`));
  expect(pdf.status).toBe(200);
  expect(pdf.headers['content-type']).toContain('application/pdf');

  // the two fresh txns are first in the list
  const txns = await auth(request(app).get('/api/v1/transactions'));
  const [first, second] = txns.body.data.items;
  expect(first.type).toBe('p2p');
  expect(first.amountPaisa).toBe(150_000);
  expect(second.type).toBe('bill');
  expect(second.amountPaisa).toBe(432_000);
}, 120_000);
