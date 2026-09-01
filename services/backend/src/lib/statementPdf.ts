import PDFDocument from 'pdfkit';
import type { SpendingSummary } from '../controllers/transactionsController';

export interface StatementPdfInput {
  holderName: string;
  periodLabel: string;
  summary: SpendingSummary;
  transactions: {
    createdAt: Date; type: string; direction: 'in' | 'out';
    amountPaisa: number; counterpartyName: string;
  }[];
}

const rs = (paisa: number) => 'Rs ' + (paisa / 100).toLocaleString('en-PK');

// English-only PDF: Nastaliq shaping in pdfkit is unreliable; the in-app view is Urdu.
export function buildStatementPdf(i: StatementPdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(24).fillColor('#0B0F14').text('PAYO', { continued: true })
      .fontSize(12).fillColor('#555').text('   Account Statement');
    doc.moveDown(0.5);
    doc.fontSize(12).fillColor('#000').text(`Account holder: ${i.holderName}`);
    doc.text(`Period: ${i.periodLabel}`);
    doc.moveDown();

    doc.fontSize(14).text('Summary');
    doc.fontSize(11)
      .text(`Money in:  ${rs(i.summary.totalInPaisa)}`)
      .text(`Money out: ${rs(i.summary.totalOutPaisa)}`)
      .text(`Transactions: ${i.summary.txnCount}`);
    doc.moveDown();

    doc.fontSize(14).text('Spending by category');
    for (const c of i.summary.byCategory)
      doc.fontSize(11).text(`${c.category.padEnd(16)} ${rs(c.totalPaisa)}  (${c.count})`);
    doc.moveDown();

    doc.fontSize(14).text('Transactions');
    for (const t of i.transactions) {
      const sign = t.direction === 'out' ? '-' : '+';
      doc.fontSize(10).text(
        `${t.createdAt.toISOString().slice(0, 10)}  ${t.type.padEnd(18)} ${t.counterpartyName.padEnd(24)} ${sign}${rs(t.amountPaisa)}`,
      );
    }
    doc.end();
  });
}
