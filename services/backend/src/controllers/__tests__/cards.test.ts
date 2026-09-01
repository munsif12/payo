import request from 'supertest';
import { createApp } from '../../app';
import { createVerifiedUser } from '../../testUtils/factories';

const app = createApp();

test('cards/mine returns signup card; freeze round-trips', async () => {
  const { token } = await createVerifiedUser(app);
  const mine = await request(app).get('/api/v1/cards/mine').set('Authorization', `Bearer ${token}`);
  expect(mine.status).toBe(200);
  expect(mine.body.data.pan).toMatch(/^4111 11/);
  expect(mine.body.data.cvv).toMatch(/^\d{3}$/);
  expect(mine.body.data.frozen).toBe(false);

  const freeze = await request(app).post('/api/v1/cards/mine/freeze')
    .set('Authorization', `Bearer ${token}`).send({ frozen: true });
  expect(freeze.body.data.frozen).toBe(true);
  const unfreeze = await request(app).post('/api/v1/cards/mine/freeze')
    .set('Authorization', `Bearer ${token}`).send({ frozen: false });
  expect(unfreeze.body.data.frozen).toBe(false);
});
