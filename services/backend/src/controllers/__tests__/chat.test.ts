import request from 'supertest';
import { createApp } from '../../app';
import { createVerifiedUser } from '../../testUtils/factories';

const app = createApp();

test('session create/list; message round-trip with cards; title from first user message', async () => {
  const { token } = await createVerifiedUser(app);
  const s = await request(app).post('/api/v1/chat/sessions').set('Authorization', `Bearer ${token}`).send({});
  expect(s.status).toBe(201);
  const sessionId = s.body.data.id;

  const card = { kind: 'balance', balancePaisa: 123 };
  const m1 = await request(app).post(`/api/v1/chat/sessions/${sessionId}/messages`)
    .set('Authorization', `Bearer ${token}`)
    .send({ role: 'user', text: 'بلال کو 1500 بھیجو' });
  expect(m1.status).toBe(201);
  await request(app).post(`/api/v1/chat/sessions/${sessionId}/messages`)
    .set('Authorization', `Bearer ${token}`)
    .send({ role: 'assistant', text: 'ٹھیک ہے', cards: [card] });

  const list = await request(app).get('/api/v1/chat/sessions').set('Authorization', `Bearer ${token}`);
  expect(list.body.data.items[0].title).toBe('بلال کو 1500 بھیجو');

  const msgs = await request(app).get(`/api/v1/chat/sessions/${sessionId}/messages`)
    .set('Authorization', `Bearer ${token}`);
  expect(msgs.body.data.items).toHaveLength(2);
  expect(msgs.body.data.items[0].role).toBe('user');
  expect(msgs.body.data.items[1].cards[0]).toEqual(card);
});

test('cross-user access → 404', async () => {
  const a = await createVerifiedUser(app);
  const b = await createVerifiedUser(app);
  const s = await request(app).post('/api/v1/chat/sessions').set('Authorization', `Bearer ${a.token}`).send({});
  const res = await request(app).get(`/api/v1/chat/sessions/${s.body.data.id}/messages`)
    .set('Authorization', `Bearer ${b.token}`);
  expect(res.status).toBe(404);
});
