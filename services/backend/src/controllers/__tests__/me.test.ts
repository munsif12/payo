import request from 'supertest';
import { createApp } from '../../app';
import { createVerifiedUser } from '../../testUtils/factories';

const app = createApp();

test('PATCH /me updates name, urduName and language', async () => {
  const { token } = await createVerifiedUser(app);

  const res = await request(app).patch('/api/v1/me')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Bilal Ahmed', urduName: 'بلال احمد', language: 'ur' });

  expect(res.status).toBe(200);
  expect(res.body.data.name).toBe('Bilal Ahmed');
  expect(res.body.data.urduName).toBe('بلال احمد');
  expect(res.body.data.language).toBe('ur');

  const me = await request(app).get('/api/v1/me').set('Authorization', `Bearer ${token}`);
  expect(me.body.data.user.name).toBe('Bilal Ahmed');
  expect(me.body.data.user.language).toBe('ur');
});

test('PATCH /me is partial — omitted fields are unchanged', async () => {
  const { token } = await createVerifiedUser(app);
  await request(app).patch('/api/v1/me').set('Authorization', `Bearer ${token}`).send({ name: 'Sara Khan' });
  const res = await request(app).patch('/api/v1/me').set('Authorization', `Bearer ${token}`).send({ language: 'en' });
  expect(res.body.data.name).toBe('Sara Khan');
  expect(res.body.data.language).toBe('en');
});

test('PATCH /me without a token → 401', async () => {
  const res = await request(app).patch('/api/v1/me').send({ name: 'X' });
  expect(res.status).toBe(401);
});
