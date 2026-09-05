import request from 'supertest';
import { createApp } from '../../app';
import { createVerifiedUser } from '../../testUtils/factories';
import { Institution, Recipient } from '../../models';

const app = createApp();

async function seedInstitutions() {
  return Institution.create([
    { name: 'PAYO', urduName: 'پیو', kind: 'wallet', code: 'PAYO', popular: true, domain: 'payo.app' },
    { name: 'Easypaisa', urduName: 'ایزی پیسہ', kind: 'wallet', code: 'EASYPAISA', popular: true, domain: 'easypaisa.com.pk' },
    { name: 'Meezan Bank', urduName: 'میزان بینک', kind: 'bank', code: 'MEEZAN', popular: true, domain: 'meezanbank.com' },
    { name: 'Sindh Bank', urduName: 'سندھ بینک', kind: 'bank', code: 'SINDHBANK', popular: false, domain: 'sindhbank.com.pk' },
  ]);
}

test('GET /institutions returns popular first then alphabetical, and q filters', async () => {
  const { token } = await createVerifiedUser(app);
  await seedInstitutions();

  const all = await request(app).get('/api/v1/institutions').set('Authorization', `Bearer ${token}`);
  expect(all.status).toBe(200);
  expect(all.body.data.items).toHaveLength(4);
  expect(all.body.data.items[0].popular).toBe(true);
  expect(all.body.data.items[0].domain).toBeTruthy();
  expect(all.body.data.items[0].logoUrl).toBe(`https://www.google.com/s2/favicons?domain=${all.body.data.items[0].domain}&sz=128`);
  const popularNames = all.body.data.items.filter((i: { popular: boolean }) => i.popular).map((i: { name: string }) => i.name);
  expect(popularNames).toEqual([...popularNames].sort());
  expect(all.body.data.items.at(-1).popular).toBe(false);

  const filtered = await request(app).get('/api/v1/institutions?q=meezan').set('Authorization', `Bearer ${token}`);
  expect(filtered.body.data.items).toHaveLength(1);
  expect(filtered.body.data.items[0].name).toBe('Meezan Bank');

  const byUrdu = await request(app).get(`/api/v1/institutions?q=${encodeURIComponent('سندھ')}`).set('Authorization', `Bearer ${token}`);
  expect(byUrdu.body.data.items).toHaveLength(1);
  expect(byUrdu.body.data.items[0].code).toBe('SINDHBANK');
});

test('POST /transfers/resolve: PAYO phone resolves to real user; wallet/bank resolve deterministically', async () => {
  const [payo, easypaisa, meezan] = await seedInstitutions();
  const a = await createVerifiedUser(app);
  const b = await createVerifiedUser(app);

  const payoResolve = await request(app).post('/api/v1/transfers/resolve')
    .set('Authorization', `Bearer ${a.token}`).send({ institutionId: String(payo!._id), identifier: b.user.phone });
  expect(payoResolve.status).toBe(200);
  expect(payoResolve.body.data.title).toBe(b.user.name);
  expect(payoResolve.body.data.linkedUserId).toBe(b.userId);
  expect(payoResolve.body.data.institution.domain).toBe('payo.app');
  expect(payoResolve.body.data.institution.logoUrl).toBe('https://www.google.com/s2/favicons?domain=payo.app&sz=128');

  const walletResolve = await request(app).post('/api/v1/transfers/resolve')
    .set('Authorization', `Bearer ${a.token}`).send({ institutionId: String(easypaisa!._id), identifier: '03135468810' });
  expect(walletResolve.status).toBe(200);
  expect(walletResolve.body.data.identifier).toBe('+923135468810');
  expect(walletResolve.body.data.linkedUserId).toBeUndefined();
  const again = await request(app).post('/api/v1/transfers/resolve')
    .set('Authorization', `Bearer ${a.token}`).send({ institutionId: String(easypaisa!._id), identifier: '+923135468810' });
  expect(again.body.data.title).toBe(walletResolve.body.data.title);

  const bankResolve = await request(app).post('/api/v1/transfers/resolve')
    .set('Authorization', `Bearer ${a.token}`).send({ institutionId: String(meezan!._id), identifier: 'PK36MEZN0000001123456702' });
  expect(bankResolve.status).toBe(200);
  expect(bankResolve.body.data.title).toBeTruthy();

  const bad = await request(app).post('/api/v1/transfers/resolve')
    .set('Authorization', `Bearer ${a.token}`).send({ institutionId: String(meezan!._id), identifier: 'nope' });
  expect(bad.status).toBe(400);
  expect(bad.body.code).toBe('INVALID_IDENTIFIER');
});

test('recipients: create resolves + stores, search, ownership-scoped list, duplicate 409, delete', async () => {
  const [payo] = await seedInstitutions();
  const a = await createVerifiedUser(app);
  const b = await createVerifiedUser(app);
  const other = await createVerifiedUser(app);

  const created = await request(app).post('/api/v1/recipients')
    .set('Authorization', `Bearer ${a.token}`)
    .send({ nickname: 'Bestie', institutionId: String(payo!._id), identifier: b.user.phone });
  expect(created.status).toBe(201);
  expect(created.body.data.title).toBe(b.user.name);
  expect(created.body.data.linkedUserId).toBe(b.userId);
  expect(created.body.data.institution.logoUrl).toBe('https://www.google.com/s2/favicons?domain=payo.app&sz=128');

  const dup = await request(app).post('/api/v1/recipients')
    .set('Authorization', `Bearer ${a.token}`)
    .send({ nickname: 'Bestie Again', institutionId: String(payo!._id), identifier: b.user.phone });
  expect(dup.status).toBe(409);
  expect(dup.body.code).toBe('ALREADY_SAVED');

  const mine = await request(app).get('/api/v1/recipients').set('Authorization', `Bearer ${a.token}`);
  expect(mine.body.data.items).toHaveLength(1);
  const theirs = await request(app).get('/api/v1/recipients').set('Authorization', `Bearer ${other.token}`);
  expect(theirs.body.data.items).toHaveLength(0);

  const search = await request(app).get('/api/v1/recipients?q=bestie').set('Authorization', `Bearer ${a.token}`);
  expect(search.body.data.items).toHaveLength(1);
  const searchByPhone = await request(app).get(`/api/v1/recipients?q=${encodeURIComponent(b.user.phone)}`).set('Authorization', `Bearer ${a.token}`);
  expect(searchByPhone.body.data.items).toHaveLength(1);

  const del = await request(app).delete(`/api/v1/recipients/${created.body.data.id}`).set('Authorization', `Bearer ${a.token}`);
  expect(del.status).toBe(200);
  const afterDelete = await request(app).get('/api/v1/recipients').set('Authorization', `Bearer ${a.token}`);
  expect(afterDelete.body.data.items).toHaveLength(0);

  const deleteOthers = await request(app).delete(`/api/v1/recipients/${created.body.data.id}`).set('Authorization', `Bearer ${other.token}`);
  expect(deleteOthers.status).toBe(404);
});

test('recipients list skips an item whose Institution was deleted (never a partial shape)', async () => {
  const [payo] = await seedInstitutions();
  const a = await createVerifiedUser(app);
  const b = await createVerifiedUser(app);

  const created = await request(app).post('/api/v1/recipients')
    .set('Authorization', `Bearer ${a.token}`)
    .send({ nickname: 'Bestie', institutionId: String(payo!._id), identifier: b.user.phone });
  expect(created.status).toBe(201);
  expect(await Recipient.countDocuments({ userId: a.userId })).toBe(1);

  await Institution.deleteOne({ _id: payo!._id });

  const list = await request(app).get('/api/v1/recipients').set('Authorization', `Bearer ${a.token}`);
  expect(list.status).toBe(200);
  expect(list.body.data.items).toHaveLength(0);
});

test('normalizePhone: +92/92/03/3-prefixed forms all resolve to the same canonical identifier and dedupe', async () => {
  const [, easypaisa] = await seedInstitutions();
  const a = await createVerifiedUser(app);
  const canonical = '+923135468810';
  const forms = ['+923135468810', '923135468810', '03135468810', '3135468810'];

  for (const identifier of forms) {
    const res = await request(app).post('/api/v1/transfers/resolve')
      .set('Authorization', `Bearer ${a.token}`).send({ institutionId: String(easypaisa!._id), identifier });
    expect(res.status).toBe(200);
    expect(res.body.data.identifier).toBe(canonical);
  }

  // Saving one form, then trying to save any other form of the same number → 409 (dedupe).
  const first = await request(app).post('/api/v1/recipients')
    .set('Authorization', `Bearer ${a.token}`)
    .send({ nickname: 'A', institutionId: String(easypaisa!._id), identifier: forms[0] });
  expect(first.status).toBe(201);
  expect(first.body.data.identifier).toBe(canonical);

  for (const identifier of forms.slice(1)) {
    const dup = await request(app).post('/api/v1/recipients')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ nickname: 'A again', institutionId: String(easypaisa!._id), identifier });
    expect(dup.status).toBe(409);
    expect(dup.body.code).toBe('ALREADY_SAVED');
  }
});
