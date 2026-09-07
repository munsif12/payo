import request from 'supertest';
import { createApp } from '../../app';
import { createVerifiedUser } from '../../testUtils/factories';
import { extractPdfText } from '../../testUtils/pdfText';
import { Transaction } from '../../models';

const app = createApp();

async function seedTwoMonths(userId: string) {
  // June 2026: in 500000, out 120000 (food) + 80000 (bills)
  // July 2026: out 50000 (transport)
  const mk = (over: Record<string, unknown>, i: number) => ({
    userId, type: 'p2p', feePaisa: 0, status: 'completed',
    counterparty: { name: `C${i}`, detail: 'x' },
    refNo: `PAYO-ST${String(i).padStart(4, '0')}${userId.slice(-4)}`,
    ...over,
  });
  await Transaction.create([
    mk({ direction: 'in', amountPaisa: 500_000, category: 'income', createdAt: new Date('2026-06-05T10:00:00Z') }, 1),
    mk({ direction: 'out', amountPaisa: 120_000, category: 'food', createdAt: new Date('2026-06-10T10:00:00Z') }, 2),
    mk({ direction: 'out', amountPaisa: 80_000, category: 'bills', createdAt: new Date('2026-06-20T10:00:00Z') }, 3),
    mk({ direction: 'out', amountPaisa: 50_000, category: 'transport', createdAt: new Date('2026-07-03T10:00:00Z') }, 4),
  ]);
}

test('monthly statement totals match; regenerate is upsert; pdf downloads', async () => {
  const { userId, token } = await createVerifiedUser(app);
  await seedTwoMonths(userId);
  const gen = await request(app).post('/api/v1/statements')
    .set('Authorization', `Bearer ${token}`).send({ year: 2026, month: 6 });
  expect(gen.status).toBe(201);
  expect(gen.body.data.summary.totalInPaisa).toBe(500_000);
  expect(gen.body.data.summary.totalOutPaisa).toBe(200_000);
  expect(gen.body.data.summary.txnCount).toBe(3);
  expect(gen.body.data.summary.period.ur).toContain('جون');

  const again = await request(app).post('/api/v1/statements')
    .set('Authorization', `Bearer ${token}`).send({ year: 2026, month: 6 });
  expect(again.body.data.statementId).toBe(gen.body.data.statementId);

  const list = await request(app).get('/api/v1/statements').set('Authorization', `Bearer ${token}`);
  expect(list.body.data.items).toHaveLength(1);

  const pdf = await request(app).get(`/api/v1/statements/${gen.body.data.statementId}/pdf`)
    .set('Authorization', `Bearer ${token}`);
  expect(pdf.status).toBe(200);
  expect(pdf.headers['content-type']).toContain('application/pdf');
  expect(pdf.body.length).toBeGreaterThan(1000);
  expect(pdf.body.subarray(0, 4).toString()).toBe('%PDF');

  const text = extractPdfText(pdf.body);
  expect(text).toContain('Page 1 of');
});

test('empty month → 404 NO_ACTIVITY; yearly statement covers both months', async () => {
  const { userId, token } = await createVerifiedUser(app);
  await seedTwoMonths(userId);
  const empty = await request(app).post('/api/v1/statements')
    .set('Authorization', `Bearer ${token}`).send({ year: 2026, month: 1 });
  expect(empty.status).toBe(404);
  expect(empty.body.code).toBe('NO_ACTIVITY');

  const yearly = await request(app).post('/api/v1/statements')
    .set('Authorization', `Bearer ${token}`).send({ year: 2026 });
  expect(yearly.body.data.summary.totalOutPaisa).toBe(250_000);
  expect(yearly.body.data.summary.txnCount).toBe(4);
  expect(yearly.body.data.summary.period.ur).toContain('سال');
});
