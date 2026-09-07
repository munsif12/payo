import { buildStatementPdf } from '../statementPdf';
import { extractPdfText, countPdfPages } from '../../testUtils/pdfText';

function makeInput(overrides: Partial<Parameters<typeof buildStatementPdf>[0]> = {}) {
  return {
    holderName: 'Ammi Jaan',
    phone: '+923001110001',
    statementRef: 'STMT-2026-08-A1B2C3',
    periodLabel: 'August 2026',
    generatedAt: new Date('2026-09-01T12:00:00Z'),
    summary: {
      totalInPaisa: 25_000_00,
      totalOutPaisa: 8_000_00,
      byCategory: [
        { category: 'bills', totalPaisa: 5_200_00, count: 1 },
        { category: 'food', totalPaisa: 2_800_00, count: 2 },
      ],
      txnCount: 3,
    },
    transactions: [
      {
        createdAt: new Date('2026-08-01T09:00:00Z'), type: 'p2p', direction: 'in' as const,
        category: 'income', amountPaisa: 25_000_00, counterpartyName: 'Salary',
      },
      {
        createdAt: new Date('2026-08-04T18:00:00Z'), type: 'bill', direction: 'out' as const,
        category: 'bills', amountPaisa: 5_200_00, counterpartyName: 'K-Electric',
      },
      {
        createdAt: new Date('2026-08-05T10:00:00Z'), type: 'p2p', direction: 'out' as const,
        category: 'food', amountPaisa: 2_800_00, counterpartyName: 'Imtiaz Super Market',
      },
    ],
    ...overrides,
  };
}

test('is a valid single-page PDF containing the holder name and page stamp', async () => {
  const pdf = await buildStatementPdf(makeInput());

  expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
  expect(countPdfPages(pdf)).toBeGreaterThanOrEqual(1);

  const text = extractPdfText(pdf);
  expect(text).toContain('Ammi Jaan');
  expect(text).toContain('Page 1 of');
});

test('paginates the transactions table across multiple pages, repeating the header on each', async () => {
  const many = Array.from({ length: 60 }, (_, i) => ({
    createdAt: new Date(Date.UTC(2026, 7, 1 + (i % 28), 10, 0)),
    type: 'p2p', direction: (i % 5 === 0 ? 'in' : 'out') as 'in' | 'out',
    category: ['food', 'transport', 'bills', 'shopping'][i % 4]!,
    amountPaisa: 1_000_00 + i * 100,
    counterpartyName: `Merchant ${i}`,
  }));
  const pdf = await buildStatementPdf(makeInput({ transactions: many, summary: { ...makeInput().summary, txnCount: many.length } }));

  expect(countPdfPages(pdf)).toBeGreaterThan(1);
  const text = extractPdfText(pdf);
  // "Date" / "Description" / etc. header labels should appear once per page.
  const headerOccurrences = text.match(/Description/g) ?? [];
  expect(headerOccurrences.length).toBe(countPdfPages(pdf));
  expect(text).toContain(`Page ${countPdfPages(pdf)} of ${countPdfPages(pdf)}`);
});

test('humanises known category codes and formats signed money with Rs grouping', async () => {
  const pdf = await buildStatementPdf(makeInput());
  const text = extractPdfText(pdf);
  expect(text).toContain('Bills');
  expect(text).toContain('Food');
  expect(text).not.toContain('bills');
  expect(text).toContain('Rs 25,000');
});

test('masks the holder phone number', async () => {
  const pdf = await buildStatementPdf(makeInput());
  const text = extractPdfText(pdf);
  expect(text).toContain('+92 300 ••• 0001');
  expect(text).not.toContain('923001110001');
});

test('never crashes when transactions are empty', async () => {
  const pdf = await buildStatementPdf(makeInput({
    transactions: [],
    summary: { totalInPaisa: 0, totalOutPaisa: 0, byCategory: [], txnCount: 0 },
  }));
  expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
  const text = extractPdfText(pdf);
  expect(text).toContain('No transactions in this period');
});
