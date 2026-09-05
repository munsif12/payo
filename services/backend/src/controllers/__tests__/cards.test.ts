import request from 'supertest';
import { createApp } from '../../app';
import { createVerifiedUser } from '../../testUtils/factories';
import { Card, Transaction } from '../../models';

const app = createApp();

test('cards/mine returns signup card with last4/maskedPan; freeze is instant', async () => {
  const { token } = await createVerifiedUser(app);
  const mine = await request(app).get('/api/v1/cards/mine').set('Authorization', `Bearer ${token}`);
  expect(mine.status).toBe(200);
  expect(mine.body.data.pan).toMatch(/^4111 11/);
  expect(mine.body.data.cvv).toMatch(/^\d{3}$/);
  expect(mine.body.data.frozen).toBe(false);
  expect(mine.body.data.last4).toBe(mine.body.data.pan.replace(/\s+/g, '').slice(-4));
  expect(mine.body.data.maskedPan).toBe(`•••• •••• •••• ${mine.body.data.last4}`);

  const freeze = await request(app).post('/api/v1/cards/mine/freeze')
    .set('Authorization', `Bearer ${token}`).send({ frozen: true });
  expect(freeze.status).toBe(200);
  expect(freeze.body.data.frozen).toBe(true);
});

test('freeze rejects any body other than { frozen: true }', async () => {
  const { token } = await createVerifiedUser(app);
  const withFalse = await request(app).post('/api/v1/cards/mine/freeze')
    .set('Authorization', `Bearer ${token}`).send({ frozen: false });
  expect(withFalse.status).toBe(400);
  const empty = await request(app).post('/api/v1/cards/mine/freeze')
    .set('Authorization', `Bearer ${token}`).send({});
  expect(empty.status).toBe(400);
});

test('unfreeze requires a pending action + correct PIN; wrong PIN leaves it frozen', async () => {
  const { token, userId } = await createVerifiedUser(app);
  await request(app).post('/api/v1/cards/mine/freeze')
    .set('Authorization', `Bearer ${token}`).send({ frozen: true });

  const create = await request(app).post('/api/v1/cards/mine/unfreeze')
    .set('Authorization', `Bearer ${token}`);
  expect(create.status).toBe(201);
  expect(create.body.data.kind).toBe('card_unfreeze');
  expect(create.body.data.requiresPin).toBe(true);
  expect(create.body.data.amountPaisa).toBe(0);
  expect(create.body.data.feePaisa).toBe(0);
  const actionId = create.body.data.id;

  const wrongPin = await request(app).post(`/api/v1/actions/${actionId}/execute`)
    .set('Authorization', `Bearer ${token}`).send({ pin: '0000' });
  expect(wrongPin.status).toBe(401);
  expect(wrongPin.body.code).toBe('INVALID_PIN');
  expect((await Card.findOne({ userId }))!.frozen).toBe(true);

  const rightPin = await request(app).post(`/api/v1/actions/${actionId}/execute`)
    .set('Authorization', `Bearer ${token}`).send({ pin: '1234' });
  expect(rightPin.status).toBe(200);
  expect((await Card.findOne({ userId }))!.frozen).toBe(false);
  expect(rightPin.body.data.transaction).toBeNull();
  expect(rightPin.body.data.card).toMatchObject({ frozen: false });
  expect(rightPin.body.data.card.last4).toBeTruthy();
  expect(rightPin.body.data.card.maskedPan).toMatch(/^•••• •••• •••• \d{4}$/);
});

test('unfreeze does not leak a Transaction: list/count and spending summary are unchanged', async () => {
  const { token, userId } = await createVerifiedUser(app);
  await request(app).post('/api/v1/cards/mine/freeze')
    .set('Authorization', `Bearer ${token}`).send({ frozen: true });

  const beforeCount = await Transaction.countDocuments({ userId });
  const beforeSummary = await request(app).get('/api/v1/transactions/spending-summary')
    .set('Authorization', `Bearer ${token}`);
  const beforeList = await request(app).get('/api/v1/transactions').set('Authorization', `Bearer ${token}`);

  const create = await request(app).post('/api/v1/cards/mine/unfreeze')
    .set('Authorization', `Bearer ${token}`);
  await request(app).post(`/api/v1/actions/${create.body.data.id}/execute`)
    .set('Authorization', `Bearer ${token}`).send({ pin: '1234' });

  const afterCount = await Transaction.countDocuments({ userId });
  const afterSummary = await request(app).get('/api/v1/transactions/spending-summary')
    .set('Authorization', `Bearer ${token}`);
  const afterList = await request(app).get('/api/v1/transactions').set('Authorization', `Bearer ${token}`);

  expect(afterCount).toBe(beforeCount);
  expect(afterList.body.data.items).toHaveLength(beforeList.body.data.items.length);
  expect(afterSummary.body.data).toEqual(beforeSummary.body.data);
});

test('unfreeze on an already-unfrozen card returns 409 CARD_NOT_FROZEN', async () => {
  const { token } = await createVerifiedUser(app);
  const res = await request(app).post('/api/v1/cards/mine/unfreeze')
    .set('Authorization', `Bearer ${token}`);
  expect(res.status).toBe(409);
  expect(res.body.code).toBe('CARD_NOT_FROZEN');
});
