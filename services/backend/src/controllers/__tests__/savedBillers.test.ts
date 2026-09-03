import request from 'supertest';
import { createApp } from '../../app';
import { createVerifiedUser } from '../../testUtils/factories';
import { Biller, Bill } from '../../models';

const app = createApp();
const CONSUMER_NO = '0400012345678';

async function makeBiller() {
  return Biller.create({ name: 'K-Electric', urduName: 'کے الیکٹرک', category: 'electricity' });
}

test('POST /saved-billers does the lookup, stores consumerName, 409 on duplicate', async () => {
  const { token } = await createVerifiedUser(app);
  const biller = await makeBiller();

  const created = await request(app).post('/api/v1/saved-billers')
    .set('Authorization', `Bearer ${token}`)
    .send({ nickname: 'Home electricity', billerId: String(biller._id), consumerNo: CONSUMER_NO });
  expect(created.status).toBe(201);
  expect(created.body.data.consumerName).toBeTruthy();
  expect(created.body.data.biller.name).toBe('K-Electric');
  expect(await Bill.countDocuments({ consumerNo: CONSUMER_NO })).toBe(1);

  const dup = await request(app).post('/api/v1/saved-billers')
    .set('Authorization', `Bearer ${token}`)
    .send({ nickname: 'Again', billerId: String(biller._id), consumerNo: CONSUMER_NO });
  expect(dup.status).toBe(409);
  expect(dup.body.code).toBe('ALREADY_SAVED');
});

test('GET /saved-billers is ownership-scoped; DELETE removes it', async () => {
  const { token } = await createVerifiedUser(app);
  const other = await createVerifiedUser(app);
  const biller = await makeBiller();

  const created = await request(app).post('/api/v1/saved-billers')
    .set('Authorization', `Bearer ${token}`)
    .send({ nickname: 'Home electricity', billerId: String(biller._id), consumerNo: CONSUMER_NO });

  const mine = await request(app).get('/api/v1/saved-billers').set('Authorization', `Bearer ${token}`);
  expect(mine.body.data.items).toHaveLength(1);
  const theirs = await request(app).get('/api/v1/saved-billers').set('Authorization', `Bearer ${other.token}`);
  expect(theirs.body.data.items).toHaveLength(0);

  const del = await request(app).delete(`/api/v1/saved-billers/${created.body.data.id}`).set('Authorization', `Bearer ${token}`);
  expect(del.status).toBe(200);
  const after = await request(app).get('/api/v1/saved-billers').set('Authorization', `Bearer ${token}`);
  expect(after.body.data.items).toHaveLength(0);
});

test('GET /bills/due refreshes and includes saved billers due bills', async () => {
  const { token } = await createVerifiedUser(app);
  const biller = await makeBiller();
  await request(app).post('/api/v1/saved-billers')
    .set('Authorization', `Bearer ${token}`)
    .send({ nickname: 'Home electricity', billerId: String(biller._id), consumerNo: CONSUMER_NO });

  const due = await request(app).get('/api/v1/bills/due').set('Authorization', `Bearer ${token}`);
  expect(due.status).toBe(200);
  expect(due.body.data.items).toHaveLength(1);
  expect(due.body.data.items[0].consumerNo).toBe(CONSUMER_NO);

  // idempotent — calling again does not create a second due bill for the same saved biller
  const dueAgain = await request(app).get('/api/v1/bills/due').set('Authorization', `Bearer ${token}`);
  expect(dueAgain.body.data.items).toHaveLength(1);
});

test('execute response adds billerSuggestion for pay_bill', async () => {
  const { token } = await createVerifiedUser(app);
  const biller = await makeBiller();
  const lookup = await request(app).post('/api/v1/bills/lookup')
    .set('Authorization', `Bearer ${token}`).send({ billerId: String(biller._id), consumerNo: CONSUMER_NO });
  const pay = await request(app).post('/api/v1/bills/pay')
    .set('Authorization', `Bearer ${token}`).send({ billId: lookup.body.data.billId });
  const exec = await request(app).post(`/api/v1/actions/${pay.body.data.id}/execute`)
    .set('Authorization', `Bearer ${token}`).send({ pin: '1234' });
  expect(exec.status).toBe(200);
  expect(exec.body.data.billerSuggestion).toMatchObject({
    billerId: String(biller._id), consumerNo: CONSUMER_NO, alreadySaved: false,
  });
});

test('saved-billers list skips an item whose Biller was deleted (never a partial shape)', async () => {
  const { token } = await createVerifiedUser(app);
  const biller = await makeBiller();
  const created = await request(app).post('/api/v1/saved-billers')
    .set('Authorization', `Bearer ${token}`)
    .send({ nickname: 'Home electricity', billerId: String(biller._id), consumerNo: CONSUMER_NO });
  expect(created.status).toBe(201);

  await Biller.deleteOne({ _id: biller._id });

  const list = await request(app).get('/api/v1/saved-billers').set('Authorization', `Bearer ${token}`);
  expect(list.status).toBe(200);
  expect(list.body.data.items).toHaveLength(0);
});
