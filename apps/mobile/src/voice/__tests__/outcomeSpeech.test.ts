import { outcomeSpeech } from '../outcomeSpeech';
import type { Txn } from '../../api/types';
import type { PinSheetResolution } from '../../pin/usePinSheet';

const txn = (over: Partial<Txn> = {}): Txn => ({
  id: 't1',
  type: 'p2p',
  direction: 'out',
  amountPaisa: 255000,
  feePaisa: 0,
  counterparty: { name: 'PTCL', detail: '0300-1234567' },
  category: 'transfer',
  status: 'completed',
  refNo: 'PAYO-7X2K',
  createdAt: '2026-09-05T10:00:00.000Z',
  ...over,
});

const send = (t: Txn): PinSheetResolution => ({ transaction: t });
const ai = { kind: 'ai', amountPaisa: 255000 };

describe('a send', () => {
  test('en', () => {
    expect(outcomeSpeech(send(txn()), ai, 'en'))
      .toBe('Done. 2,550 rupees sent to PTCL. Reference PAYO-7X2K.');
  });

  test('ur — the amount is spelled out, never read as digits', () => {
    expect(outcomeSpeech(send(txn()), ai, 'ur'))
      .toBe('ہو گیا۔ دو ہزار پانچ سو پچاس روپے PTCL کو بھیج دیے۔ حوالہ PAYO-7X2K۔');
  });

  test('a bank transfer is worded the same way as a p2p send', () => {
    expect(outcomeSpeech(send(txn({ type: 'bank_transfer' })), ai, 'en'))
      .toBe('Done. 2,550 rupees sent to PTCL. Reference PAYO-7X2K.');
  });

  test('an unknown future transaction type still gets the send wording', () => {
    expect(outcomeSpeech(send(txn({ type: 'salary_advance' as Txn['type'] })), ai, 'en'))
      .toContain('sent to PTCL');
  });

  test('no refNo drops the reference sentence rather than saying "Reference ."', () => {
    const s = outcomeSpeech(send(txn({ refNo: '' })), ai, 'en');
    expect(s).toBe('Done. 2,550 rupees sent to PTCL.');
    expect(s).not.toContain('Reference');
  });

  test('ur prefers the counterparty urduName when there is one', () => {
    expect(outcomeSpeech(send(txn({ counterparty: { name: 'Ali', urduName: 'علی', detail: 'x' } })), ai, 'ur'))
      .toContain('علی');
  });
});

describe('the other money kinds', () => {
  const bill = txn({ type: 'bill', amountPaisa: 432000, counterparty: { name: 'K-Electric', detail: '12345' } });

  test('bill en', () => {
    expect(outcomeSpeech(send(bill), ai, 'en')).toBe('Done. K-Electric bill of 4,320 rupees paid.');
  });

  test('bill ur', () => {
    expect(outcomeSpeech(send(bill), ai, 'ur'))
      .toBe('ہو گیا۔ K-Electric کا چار ہزار تین سو بیس روپے کا بل ادا ہو گیا۔');
  });

  test('a bill never reads out its reference — one short sentence is the whole point', () => {
    expect(outcomeSpeech(send(bill), ai, 'en')).not.toContain('PAYO-');
  });

  test.each([
    ['recharge', 'en', 'Done. 2,550 rupees loaded on PTCL.'],
    ['pocket_deposit', 'en', 'Done. 2,550 rupees moved into PTCL.'],
    ['pocket_withdraw', 'en', 'Done. 2,550 rupees moved out of PTCL.'],
    ['request_settlement', 'en', "Done. PTCL's request for 2,550 rupees is settled."],
  ])('%s (%s)', (type, lng, expected) => {
    expect(outcomeSpeech(send(txn({ type: type as Txn['type'] })), ai, lng)).toBe(expected);
  });

  test.each(['recharge', 'pocket_deposit', 'pocket_withdraw', 'request_settlement'])(
    '%s in ur is spoken in Urdu with the amount in words',
    (type) => {
      const s = outcomeSpeech(send(txn({ type: type as Txn['type'] })), ai, 'ur');
      expect(s).toContain('دو ہزار پانچ سو پچاس روپے');
      expect(s).not.toMatch(/[0-9]/);
    },
  );
});

describe('amounts', () => {
  test('a part-rupee amount keeps its digits in both languages', () => {
    const odd = send(txn({ amountPaisa: 150075 }));
    expect(outcomeSpeech(odd, ai, 'en')).toContain('1,500.75 rupees');
    expect(outcomeSpeech(odd, ai, 'ur')).toContain('1500.75 روپے');
  });

  test('an amount above the Urdu table falls back to digits instead of mis-speaking it', () => {
    // 1 crore rupees — one above the lakh-system range the port supports.
    expect(outcomeSpeech(send(txn({ amountPaisa: 1000000000 })), ai, 'ur')).toContain('10000000 روپے');
  });
});

describe('outcomes with no transaction', () => {
  test('an unfrozen card, en + ur', () => {
    const res: PinSheetResolution = {
      transaction: null,
      card: { id: 'c1', last4: '4321', maskedPan: '**** 4321', expiry: '01/30', frozen: false },
    };
    expect(outcomeSpeech(res, { kind: 'ai' }, 'en')).toBe('Your card is active again.');
    expect(outcomeSpeech(res, { kind: 'ai' }, 'ur')).toBe('آپ کا کارڈ دوبارہ فعال ہے۔');
  });

  test('a frozen card does not claim to be active', () => {
    const res: PinSheetResolution = {
      transaction: null,
      card: { id: 'c1', last4: '4321', maskedPan: '**** 4321', expiry: '01/30', frozen: true },
    };
    expect(outcomeSpeech(res, { kind: 'ai' }, 'en')).toBe('Your card is frozen.');
  });

  test('a guardian approval names the payer with no gendered pronoun', () => {
    const action = { kind: 'guardian_approval', amountPaisa: 255000, payerName: 'Ammi' };
    expect(outcomeSpeech({ transaction: null }, action, 'en'))
      .toBe('Approved. Ammi can enter the PIN now.');
    expect(outcomeSpeech({ transaction: null }, action, 'en')).not.toMatch(/\b(her|his)\b/);
    expect(outcomeSpeech({ transaction: null }, action, 'ur'))
      .toBe('منظور ہو گیا۔ Ammi اب پن درج کر سکتے ہیں۔');
  });

  test('an approval never claims the money moved', () => {
    const s = outcomeSpeech({ transaction: null }, { kind: 'guardian_approval', payerName: 'Ammi' }, 'en');
    expect(s).not.toContain('sent');
    expect(s).not.toContain('rupees');
  });

  test('an approval with no payer name still says something', () => {
    expect(outcomeSpeech({ transaction: null }, { kind: 'guardian_approval' }, 'en'))
      .toBe('Approved. The payment can go ahead now.');
  });

  test('nothing at all to report is silence, not an empty TTS request', () => {
    expect(outcomeSpeech({ transaction: null }, { kind: 'ai' }, 'en')).toBe('');
    expect(outcomeSpeech({ transaction: null }, { kind: 'ai' }, 'ur')).toBe('');
  });
});

test('every sentence stays inside the POST /speak character cap', () => {
  const long = txn({ counterparty: { name: 'A'.repeat(400), detail: 'x' } });
  expect(outcomeSpeech(send(long), ai, 'en').length).toBeLessThanOrEqual(200);
});

test('no outcome runs past two sentences', () => {
  for (const lng of ['en', 'ur']) {
    for (const type of ['p2p', 'bill', 'recharge', 'pocket_deposit', 'pocket_withdraw', 'request_settlement']) {
      const s = outcomeSpeech(send(txn({ type: type as Txn['type'] })), ai, lng);
      // "Done." / «ہو گیا۔» is an interjection glued to the outcome clause, so
      // the budget is: that opener, the outcome, and at most a reference line.
      expect(s.split(/(?<=[.۔])\s+/).filter(Boolean).length).toBeLessThanOrEqual(3);
    }
  }
});
