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

test('GET /me exposes dateOfBirth and a computed age; PATCH /me sets it', async () => {
  const { token } = await createVerifiedUser(app);

  const before = await request(app).get('/api/v1/me').set('Authorization', `Bearer ${token}`);
  expect(before.body.data.user.dateOfBirth).toBeUndefined();
  expect(before.body.data.user.age).toBeUndefined();

  const patched = await request(app).patch('/api/v1/me')
    .set('Authorization', `Bearer ${token}`).send({ dateOfBirth: '1961-03-15' });
  expect(patched.status).toBe(200);
  expect(patched.body.data.dateOfBirth).toBe('1961-03-15');
  expect(patched.body.data.age).toBeGreaterThanOrEqual(60);

  const me = await request(app).get('/api/v1/me').set('Authorization', `Bearer ${token}`);
  expect(me.body.data.user.dateOfBirth).toBe('1961-03-15');
  expect(me.body.data.user.age).toBe(patched.body.data.age);
});

test('PATCH /me rejects a date of birth under 18, a future date and a non-date', async () => {
  const { token } = await createVerifiedUser(app);
  const patch = (dateOfBirth: string) => request(app).patch('/api/v1/me')
    .set('Authorization', `Bearer ${token}`).send({ dateOfBirth });

  const now = new Date();
  const tooYoung = new Date(now.getFullYear() - 17, now.getMonth(), now.getDate());
  const under = await patch(tooYoung.toISOString().slice(0, 10));
  expect(under.status).toBe(400);
  expect(under.body.code).toBe('VALIDATION');

  const future = await patch(new Date(now.getFullYear() + 1, 0, 1).toISOString().slice(0, 10));
  expect(future.status).toBe(400);

  const nonsense = await patch('not-a-date');
  expect(nonsense.status).toBe(400);
});

test('exactly 18 today is accepted', async () => {
  const { token } = await createVerifiedUser(app);
  const now = new Date();
  const eighteen = new Date(now.getFullYear() - 18, now.getMonth(), now.getDate());
  const res = await request(app).patch('/api/v1/me')
    .set('Authorization', `Bearer ${token}`).send({ dateOfBirth: eighteen.toISOString().slice(0, 10) });
  expect(res.status).toBe(200);
  expect(res.body.data.age).toBe(18);
});
