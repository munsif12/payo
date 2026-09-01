import request from 'supertest';
import { createApp } from '../../app';
import { createVerifiedUser } from '../../testUtils/factories';
import { Account, MoneyRequest } from '../../models';

const app = createApp();

async function balance(userId: string) {
  return (await Account.findOne({ userId }))!.balancePaisa;
}

test('A requests from B; directions per viewer; approve → execute settles', async () => {
  const a = await createVerifiedUser(app);
  const b = await createVerifiedUser(app);
  const create = await request(app).post('/api/v1/requests')
    .set('Authorization', `Bearer ${a.token}`)
    .send({ fromPhone: b.user.phone, amountPaisa: 70_000, note: 'lunch' });
  expect(create.status).toBe(201);
  expect(create.body.data.request.direction).toBe('outgoing');
  const reqId = create.body.data.request.id;

  const bView = await request(app).get('/api/v1/requests').set('Authorization', `Bearer ${b.token}`);
  expect(bView.body.data.items[0].direction).toBe('incoming');
  const aView = await request(app).get('/api/v1/requests').set('Authorization', `Bearer ${a.token}`);
  expect(aView.body.data.items[0].direction).toBe('outgoing');

  const approve = await request(app).post(`/api/v1/requests/${reqId}/approve`)
    .set('Authorization', `Bearer ${b.token}`);
  expect(approve.status).toBe(201);
  const exec = await request(app).post(`/api/v1/actions/${approve.body.data.id}/execute`)
    .set('Authorization', `Bearer ${b.token}`).send({ pin: '1234' });
  expect(exec.status).toBe(200);
  expect(await balance(a.userId)).toBe(1_070_000);
  expect(await balance(b.userId)).toBe(930_000);
  expect((await MoneyRequest.findById(reqId))!.status).toBe('approved');
});

test('non-payer cannot approve → 404; decline of settled → 410', async () => {
  const a = await createVerifiedUser(app);
  const b = await createVerifiedUser(app);
  const c = await createVerifiedUser(app);
  const create = await request(app).post('/api/v1/requests')
    .set('Authorization', `Bearer ${a.token}`)
    .send({ fromPhone: b.user.phone, amountPaisa: 50_000 });
  const reqId = create.body.data.request.id;

  const cApprove = await request(app).post(`/api/v1/requests/${reqId}/approve`)
    .set('Authorization', `Bearer ${c.token}`);
  expect(cApprove.status).toBe(404);

  const approve = await request(app).post(`/api/v1/requests/${reqId}/approve`)
    .set('Authorization', `Bearer ${b.token}`);
  await request(app).post(`/api/v1/actions/${approve.body.data.id}/execute`)
    .set('Authorization', `Bearer ${b.token}`).send({ pin: '1234' });

  const decline = await request(app).post(`/api/v1/requests/${reqId}/decline`)
    .set('Authorization', `Bearer ${b.token}`);
  expect(decline.status).toBe(410);
});

test('approve→execute twice settles only once', async () => {
  const a = await createVerifiedUser(app);
  const b = await createVerifiedUser(app);
  const create = await request(app).post('/api/v1/requests')
    .set('Authorization', `Bearer ${a.token}`)
    .send({ fromPhone: b.user.phone, amountPaisa: 30_000 });
  const reqId = create.body.data.request.id;
  const approve = await request(app).post(`/api/v1/requests/${reqId}/approve`)
    .set('Authorization', `Bearer ${b.token}`);
  const exec = () => request(app).post(`/api/v1/actions/${approve.body.data.id}/execute`)
    .set('Authorization', `Bearer ${b.token}`).send({ pin: '1234' });
  await exec();
  const second = await exec();
  expect(second.status).toBe(410);
  expect(await balance(a.userId)).toBe(1_030_000);
});

test('self request → 400; unknown phone → 404', async () => {
  const a = await createVerifiedUser(app);
  const self = await request(app).post('/api/v1/requests')
    .set('Authorization', `Bearer ${a.token}`)
    .send({ fromPhone: a.user.phone, amountPaisa: 1000 });
  expect(self.status).toBe(400);
  const unk = await request(app).post('/api/v1/requests')
    .set('Authorization', `Bearer ${a.token}`)
    .send({ fromPhone: '+923000000000', amountPaisa: 1000 });
  expect(unk.status).toBe(404);
});
