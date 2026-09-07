import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import type { SpendingSummary } from '../controllers/transactionsController';

export interface StatementPdfInput {
  holderName: string;
  phone: string;
  statementRef: string;
  periodLabel: string;
  generatedAt?: Date;
  summary: SpendingSummary;
  transactions: {
    createdAt: Date; type: string; direction: 'in' | 'out'; category: string;
    amountPaisa: number; counterpartyName: string;
  }[];
}

// ---- Design tokens — verbatim from apps/mobile/src/theme/tokens.ts `light` (plus the two
// dark-theme values the header band needs for its own navy background: dark.ink / dark.ink2). ----
const COLOR = {
  bg: '#F7F4EE',
  surface: '#FFFFFF',
  surface2: '#F1EDE4',
  separator: '#E7E1D6',
  ink: '#0E2233',
  ink2: '#5B6B78',
  ink3: '#8A98A4',
  amber: '#F2A93B',
  amberDeep: '#D98F1F',
  amberTint: '#FBEBD0',
  green: '#1F9D6A',
  greenTint: '#DDF3E9',
  red: '#D64545',
  navy: '#0D2A3D',
  onNavy: '#F3F6F8', // dark.ink — off-white text on the navy header band
  onNavy2: '#A7B4BF', // dark.ink2 — secondary text on the navy header band
} as const;

const PAGE_MARGIN = 40;
const FOOTER_H = 34; // reserved band at the bottom of every page, inside the 40pt margin

// ---- Fonts — Plus Jakarta Sans, copied from apps/mobile's node_modules into assets/fonts/.
// Each weight falls back to a Helvetica variant independently if its file is missing, so a
// partial checkout (or a font that was never vendored) never crashes PDF generation. ----
const FONT_DIR = path.join(__dirname, '../../assets/fonts');
const FONT_FILES: Record<'regular' | 'semibold' | 'bold' | 'extrabold', string> = {
  regular: 'PlusJakartaSans-Regular.ttf',
  semibold: 'PlusJakartaSans-SemiBold.ttf',
  bold: 'PlusJakartaSans-Bold.ttf',
  extrabold: 'PlusJakartaSans-ExtraBold.ttf',
};
const FONT_FALLBACK: Record<keyof typeof FONT_FILES, string> = {
  regular: 'Helvetica',
  semibold: 'Helvetica-Bold',
  bold: 'Helvetica-Bold',
  extrabold: 'Helvetica-Bold',
};

// Nastaliq isn't vendored anywhere in this workspace today (checked apps/mobile's
// @expo-google-fonts packages) — Urdu rendering is skipped rather than guessed at.
const URDU_FONT_FILE = path.join(FONT_DIR, 'NotoNastaliqUrdu-Regular.ttf');

interface RegisteredFonts {
  regular: string; semibold: string; bold: string; extrabold: string;
  embedded: boolean; // true if every weight above is the real Jakarta Sans file, not a fallback
  urdu: string | null;
}

function registerFonts(doc: PDFKit.PDFDocument): RegisteredFonts {
  const names = {} as { regular: string; semibold: string; bold: string; extrabold: string };
  let allEmbedded = true;
  for (const weight of Object.keys(FONT_FILES) as (keyof typeof FONT_FILES)[]) {
    const filePath = path.join(FONT_DIR, FONT_FILES[weight]);
    const alias = `Jakarta-${weight}`;
    if (fs.existsSync(filePath)) {
      doc.registerFont(alias, filePath);
      names[weight] = alias;
    } else {
      allEmbedded = false;
      names[weight] = FONT_FALLBACK[weight];
    }
  }
  let urdu: string | null = null;
  if (fs.existsSync(URDU_FONT_FILE)) {
    doc.registerFont('Urdu', URDU_FONT_FILE);
    urdu = 'Urdu';
  }
  return { ...names, embedded: allEmbedded, urdu };
}

// "Rs " prefix rather than the app's "₨" glyph — the rupee sign isn't guaranteed to exist in
// every fallback path (Helvetica has no ₨ glyph at all), and the task's own spec asks for
// "Rs 1,20,000". Grouping reuses the same `en-PK` toLocaleString the app's fmtRs() helper
// (src/lib/fmt.ts) uses — Node's ICU en-PK data doesn't actually produce lakh grouping
// (1,20,000), only western grouping (120,000), which is a pre-existing limitation of that
// helper, not something introduced here.
const rs = (paisa: number) => 'Rs ' + Math.round(paisa / 100).toLocaleString('en-PK');
const signedRs = (paisa: number) => (paisa < 0 ? '-' : '+') + rs(Math.abs(paisa));

const CATEGORY_LABELS: Record<string, string> = {
  transfer: 'Transfers',
  bills: 'Bills',
  shopping: 'Shopping',
  food: 'Food',
  transport: 'Transport',
  recharge: 'Mobile load',
  savings: 'Savings',
  health: 'Health',
  income: 'Income',
};
function humanizeCategory(category: string): string {
  return CATEGORY_LABELS[category] ?? (category.charAt(0).toUpperCase() + category.slice(1));
}

/** `+923001110001` → `+92 300 ••• 0001`. Falls back to the raw string if it doesn't look
 * like a normalised `+92xxxxxxxxxx` number. */
function maskPhone(phone: string): string {
  const m = /^\+(\d{2})(\d{3})\d{3}(\d{4})$/.exec(phone);
  if (!m) return phone;
  return `+${m[1]} ${m[2]} ••• ${m[3]}`;
}

const fmtDate = (d: Date) => d.toISOString().slice(0, 10);

export function buildStatementPdf(i: StatementPdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: PAGE_MARGIN, bottom: PAGE_MARGIN, left: PAGE_MARGIN, right: PAGE_MARGIN },
      bufferPages: true,
      // Uncompressed content streams keep this PDF's text greppable — the transactions table
      // can run to hundreds of rows, and an inspectable buffer is worth more here than the
      // handful of extra KB compression would save on a demo document.
      compress: false,
    });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const fonts = registerFonts(doc);
    const pageWidth = doc.page.width;
    const contentWidth = pageWidth - PAGE_MARGIN * 2;
    const generatedAt = i.generatedAt ?? new Date();

    drawHeaderBand(doc, fonts, contentWidth, i.periodLabel, i.statementRef);
    drawHolderBlock(doc, fonts, contentWidth, i, generatedAt);
    drawSummaryTiles(doc, fonts, contentWidth, i.summary);
    drawCategoryTable(doc, fonts, contentWidth, i.summary.byCategory);
    drawTransactionsTable(doc, fonts, contentWidth, i.transactions);

    stampFooters(doc, fonts);
    doc.end();
  });
}

function drawHeaderBand(
  doc: PDFKit.PDFDocument, fonts: RegisteredFonts, contentWidth: number,
  periodLabel: string, statementRef: string,
) {
  const bandH = 90;
  doc.rect(0, 0, doc.page.width, bandH).fill(COLOR.navy);
  doc.rect(0, bandH, doc.page.width, 3).fill(COLOR.amber);

  doc.font(fonts.extrabold).fontSize(26).fillColor(COLOR.onNavy)
    .text('PAYO', PAGE_MARGIN, 26, { lineBreak: false });
  doc.font(fonts.regular).fontSize(12).fillColor(COLOR.onNavy2)
    .text('Account statement', PAGE_MARGIN, 56, { lineBreak: false });

  doc.font(fonts.semibold).fontSize(13).fillColor(COLOR.onNavy)
    .text(periodLabel, PAGE_MARGIN, 30, { width: contentWidth, align: 'right', lineBreak: false });
  doc.font(fonts.regular).fontSize(10).fillColor(COLOR.onNavy2)
    .text(statementRef, PAGE_MARGIN, 48, { width: contentWidth, align: 'right', lineBreak: false });

  doc.y = bandH + 3 + 20;
}

function drawHolderBlock(
  doc: PDFKit.PDFDocument, fonts: RegisteredFonts, contentWidth: number,
  i: StatementPdfInput, generatedAt: Date,
) {
  const top = doc.y;
  const halfW = contentWidth / 2;

  doc.font(fonts.bold).fontSize(14).fillColor(COLOR.ink)
    .text(i.holderName, PAGE_MARGIN, top, { width: halfW });
  doc.font(fonts.regular).fontSize(11).fillColor(COLOR.ink2)
    .text(maskPhone(i.phone), PAGE_MARGIN, doc.y + 2, { width: halfW });

  doc.font(fonts.semibold).fontSize(11).fillColor(COLOR.ink)
    .text('PAYO wallet · PKR', PAGE_MARGIN + halfW, top, { width: halfW, align: 'right' });
  doc.font(fonts.regular).fontSize(10).fillColor(COLOR.ink3)
    .text(`Generated ${fmtDate(generatedAt)}`, PAGE_MARGIN + halfW, top + 18, { width: halfW, align: 'right' });

  doc.y = Math.max(doc.y, top + 40) + 16;
  doc.moveTo(PAGE_MARGIN, doc.y).lineTo(PAGE_MARGIN + contentWidth, doc.y).strokeColor(COLOR.separator).lineWidth(1).stroke();
  doc.y += 18;
}

function drawSummaryTiles(doc: PDFKit.PDFDocument, fonts: RegisteredFonts, contentWidth: number, summary: SpendingSummary) {
  const netPaisa = summary.totalInPaisa - summary.totalOutPaisa;
  const tiles: { label: string; value: string; color: string }[] = [
    { label: 'Money in', value: rs(summary.totalInPaisa), color: COLOR.green },
    { label: 'Money out', value: rs(summary.totalOutPaisa), color: COLOR.red },
    { label: 'Net change', value: signedRs(netPaisa), color: netPaisa >= 0 ? COLOR.green : COLOR.red },
    { label: 'Transactions', value: String(summary.txnCount), color: COLOR.ink },
  ];

  const gap = 10;
  const tileW = (contentWidth - gap * (tiles.length - 1)) / tiles.length;
  const tileH = 56;
  const top = doc.y;

  tiles.forEach((tile, idx) => {
    const x = PAGE_MARGIN + idx * (tileW + gap);
    doc.roundedRect(x, top, tileW, tileH, 10).fill(COLOR.surface2);
    doc.font(fonts.semibold).fontSize(9).fillColor(COLOR.ink2)
      .text(tile.label.toUpperCase(), x + 12, top + 10, { width: tileW - 24, characterSpacing: 0.4 });
    doc.font(fonts.extrabold).fontSize(15).fillColor(tile.color)
      .text(tile.value, x + 12, top + 27, { width: tileW - 24, features: ['tnum'] });
  });

  doc.y = top + tileH + 24;
}

function drawCategoryTable(
  doc: PDFKit.PDFDocument, fonts: RegisteredFonts, contentWidth: number,
  byCategory: SpendingSummary['byCategory'],
) {
  doc.font(fonts.bold).fontSize(13).fillColor(COLOR.ink).text('Spending by category', PAGE_MARGIN, doc.y);
  doc.y += 12;

  if (byCategory.length === 0) {
    doc.font(fonts.regular).fontSize(10).fillColor(COLOR.ink3).text('No outgoing spend this period.', PAGE_MARGIN, doc.y);
    doc.y += 20;
    return;
  }

  const sorted = [...byCategory].sort((a, b) => b.totalPaisa - a.totalPaisa);
  const maxPaisa = sorted[0]!.totalPaisa || 1;

  const labelW = 120, countW = 40, amountW = 90, barW = contentWidth - labelW - countW - amountW;
  const rowH = 20;

  for (const c of sorted) {
    const y = doc.y;
    doc.font(fonts.semibold).fontSize(10).fillColor(COLOR.ink)
      .text(humanizeCategory(c.category), PAGE_MARGIN, y + 3, { width: labelW - 8, ellipsis: true, lineBreak: false });
    doc.font(fonts.regular).fontSize(9).fillColor(COLOR.ink3)
      .text(String(c.count), PAGE_MARGIN + labelW, y + 4, { width: countW, lineBreak: false });

    const barX = PAGE_MARGIN + labelW + countW;
    const barMaxW = barW - 12;
    const filledW = Math.max(4, (c.totalPaisa / maxPaisa) * barMaxW);
    doc.roundedRect(barX, y + 3, barMaxW, 10, 4).fill(COLOR.surface2);
    doc.roundedRect(barX, y + 3, filledW, 10, 4).fill(COLOR.amber);

    doc.font(fonts.semibold).fontSize(10).fillColor(COLOR.ink)
      .text(rs(c.totalPaisa), PAGE_MARGIN + labelW + countW + barW, y + 3, {
        width: amountW, align: 'right', features: ['tnum'], lineBreak: false,
      });

    doc.y = y + rowH;
  }
  doc.y += 12;
}

// Date · Description · Category · Money in · Money out · Balance
const TXN_COLS = { date: 62, description: 148, category: 78, in: 68, out: 68 } as const;

function txnColX(contentWidth: number) {
  const balance = contentWidth - TXN_COLS.date - TXN_COLS.description - TXN_COLS.category - TXN_COLS.in - TXN_COLS.out;
  const date = PAGE_MARGIN;
  const description = date + TXN_COLS.date;
  const category = description + TXN_COLS.description;
  const moneyIn = category + TXN_COLS.category;
  const moneyOut = moneyIn + TXN_COLS.in;
  const bal = moneyOut + TXN_COLS.out;
  return { date, description, category, moneyIn, moneyOut, balance: bal, balanceW: balance };
}

function drawTransactionsHeader(doc: PDFKit.PDFDocument, fonts: RegisteredFonts, contentWidth: number) {
  const x = txnColX(contentWidth);
  const y = doc.y;
  const h = 22;
  doc.rect(PAGE_MARGIN, y, contentWidth, h).fill(COLOR.surface2);
  doc.font(fonts.semibold).fontSize(9).fillColor(COLOR.navy);
  doc.text('Date', x.date + 4, y + 7, { width: TXN_COLS.date - 8, lineBreak: false });
  doc.text('Description', x.description + 4, y + 7, { width: TXN_COLS.description - 8, lineBreak: false });
  doc.text('Category', x.category + 4, y + 7, { width: TXN_COLS.category - 8, lineBreak: false });
  doc.text('Money in', x.moneyIn, y + 7, { width: TXN_COLS.in - 6, align: 'right', lineBreak: false });
  doc.text('Money out', x.moneyOut, y + 7, { width: TXN_COLS.out - 6, align: 'right', lineBreak: false });
  doc.text('Balance', x.balance, y + 7, { width: x.balanceW - 6, align: 'right', lineBreak: false });
  doc.y = y + h;
}

function drawTransactionsTable(
  doc: PDFKit.PDFDocument, fonts: RegisteredFonts, contentWidth: number,
  transactions: StatementPdfInput['transactions'],
) {
  doc.font(fonts.bold).fontSize(13).fillColor(COLOR.ink).text('Transactions', PAGE_MARGIN, doc.y);
  doc.y += 12;

  const rowH = 20;
  const bottomLimit = doc.page.height - doc.page.margins.bottom - FOOTER_H;

  drawTransactionsHeader(doc, fonts, contentWidth);

  if (transactions.length === 0) {
    doc.font(fonts.regular).fontSize(10).fillColor(COLOR.ink3).text('No transactions in this period.', PAGE_MARGIN, doc.y + 6);
    return;
  }

  const x = txnColX(contentWidth);
  // Running balance: this statement doesn't persist a period-opening balance (Statement only
  // stores aggregate totals), so the balance column is relative to the START of the period —
  // opening is treated as 0 and each row adds/subtracts its own amount, forward in time. It is
  // NOT the wallet's real global balance; it exists to show the reader the shape of the period.
  let running = 0;

  transactions.forEach((t, idx) => {
    if (doc.y + rowH > bottomLimit) {
      doc.addPage();
      doc.y = PAGE_MARGIN;
      drawTransactionsHeader(doc, fonts, contentWidth);
    }
    const y = doc.y;
    if (idx % 2 === 1) doc.rect(PAGE_MARGIN, y, contentWidth, rowH).fill(COLOR.bg);

    running += t.direction === 'in' ? t.amountPaisa : -t.amountPaisa;

    doc.font(fonts.regular).fontSize(9).fillColor(COLOR.ink2)
      .text(fmtDate(t.createdAt), x.date + 4, y + 6, { width: TXN_COLS.date - 8, lineBreak: false, features: ['tnum'] });
    doc.font(fonts.regular).fontSize(9).fillColor(COLOR.ink)
      .text(t.counterpartyName, x.description + 4, y + 6, { width: TXN_COLS.description - 8, ellipsis: true, lineBreak: false });
    doc.font(fonts.regular).fontSize(9).fillColor(COLOR.ink2)
      .text(humanizeCategory(t.category), x.category + 4, y + 6, { width: TXN_COLS.category - 8, ellipsis: true, lineBreak: false });

    doc.font(fonts.semibold).fontSize(9).fillColor(COLOR.green)
      .text(t.direction === 'in' ? rs(t.amountPaisa) : '', x.moneyIn, y + 6, {
        width: TXN_COLS.in - 6, align: 'right', lineBreak: false, features: ['tnum'],
      });
    doc.font(fonts.semibold).fontSize(9).fillColor(COLOR.red)
      .text(t.direction === 'out' ? rs(t.amountPaisa) : '', x.moneyOut, y + 6, {
        width: TXN_COLS.out - 6, align: 'right', lineBreak: false, features: ['tnum'],
      });
    doc.font(fonts.regular).fontSize(9).fillColor(COLOR.ink)
      .text(signedRs(running), x.balance, y + 6, {
        width: x.balanceW - 6, align: 'right', lineBreak: false, features: ['tnum'],
      });

    doc.y = y + rowH;
  });
}

function stampFooters(doc: PDFKit.PDFDocument, fonts: RegisteredFonts) {
  const range = doc.bufferedPageRange();
  const total = range.count;
  for (let idx = 0; idx < total; idx++) {
    const pageNum = range.start + idx;
    doc.switchToPage(pageNum);
    const { width, height } = doc.page;
    const y = height - PAGE_MARGIN - FOOTER_H + 10;
    doc.moveTo(PAGE_MARGIN, y).lineTo(width - PAGE_MARGIN, y).strokeColor(COLOR.separator).lineWidth(1).stroke();
    doc.font(fonts.regular).fontSize(8).fillColor(COLOR.ink3)
      .text('PAYO · demo statement, not a legal document', PAGE_MARGIN, y + 8, { lineBreak: false });
    doc.font(fonts.regular).fontSize(8).fillColor(COLOR.ink3)
      .text(`Page ${idx + 1} of ${total}`, PAGE_MARGIN, y + 8, { width: width - PAGE_MARGIN * 2, align: 'right', lineBreak: false });
  }
}
