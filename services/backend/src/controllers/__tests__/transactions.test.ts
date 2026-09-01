import request from 'supertest';
import { createApp } from '../../app';
import { createVerifiedUser } from '../../testUtils/factories';
import { Transaction } from '../../models';

const app = createApp();

async function seedTxns(userId: string) {
  const docs = [];
  for (let i = 0; i < 25; i++) {
    const category = ['food', 'transport', 'bills'][i % 3];
    const direction = i % 5 === 0 ? 'in' : 'out';
    docs.push({
      userId, type: 'p2p', direction, amountPaisa: (i + 1) * 1000, feePaisa: 0,
      counterparty: { name: `CP${i}`, detail: 'x' }, category: direction === 'in' ? 'income' : category,
      status: 'completed', refNo: `PAYO-TEST${String(i).padStart(4, '0')}${userId.slice(-4)}`,
      createdAt: new Date(Date.now() - i * 60_000),
    });
  }
  await Transaction.create(docs);
}

test('pagination walks 20 + 5 with cursor, no overlap', async () => {
  const { userId, token } = await createVerifiedUser(app);
  await seedTxns(userId);
  const p1 = await request(app).get('/api/v1/transactions').set('Authorization', `Bearer ${token}`);
  expect(p1.body.data.items).toHaveLength(20);
  expect(p1.body.data.nextCursor).toBeTruthy();
  const p2 = await request(app).get(`/api/v1/transactions?cursor=${encodeURIComponent(p1.body.data.nextCursor)}`)
    .set('Authorization', `Bearer ${token}`);
  expect(p2.body.data.items).toHaveLength(5);
  expect(p2.body.data.nextCursor).toBeNull();
  const ids = new Set([...p1.body.data.items, ...p2.body.data.items].map((t: { id: string }) => t.id));
  expect(ids.size).toBe(25);
});

test('category filter works', async () => {
  const { userId, token } = await createVerifiedUser(app);
  await seedTxns(userId);
  const res = await request(app).get('/api/v1/transactions?category=food&limit=100')
    .set('Authorization', `Bearer ${token}`);
  expect(res.body.data.items.length).toBeGreaterThan(0);
  for (const t of res.body.data.items) expect(t.category).toBe('food');
});

test('spending summary aggregates by category and excludes other users', async () => {
  const { userId, token } = await createVerifiedUser(app);
  const other = await createVerifiedUser(app);
  await seedTxns(userId);
  await seedTxns(other.userId);
  const res = await request(app).get('/api/v1/transactions/spending-summary')
    .set('Authorization', `Bearer ${token}`);
  const d = res.body.data;

  // hand-computed from seedTxns: i=0,5,10,15,20 are 'in' (amounts 1000,6000,11000,16000,21000 → 55000)
  expect(d.totalInPaisa).toBe(55_000);
  // total out = sum of 1..25 *1000 minus in = 325000 - 55000 = 270000
  expect(d.totalOutPaisa).toBe(270_000);
  const byCat = Object.fromEntries(d.byCategory.map((c: { category: string; totalPaisa: number }) => [c.category, c.totalPaisa]));
  expect(byCat.food + byCat.transport + byCat.bills).toBe(270_000);
  // sorted desc by total
  const totals = d.byCategory.map((c: { totalPaisa: number }) => c.totalPaisa);
  expect([...totals].sort((a, b) => b - a)).toEqual(totals);
});

test("other user's transactions never appear in list", async () => {
  const { token } = await createVerifiedUser(app);
  const other = await createVerifiedUser(app);
  await seedTxns(other.userId);
  const res = await request(app).get('/api/v1/transactions').set('Authorization', `Bearer ${token}`);
  expect(res.body.data.items).toHaveLength(0);
});
