import { shouldFetchDigest, digestSpeech, capSpeech, toDigestCard, DIGEST_INTERVAL_MS } from '../digestLogic';
import type { DigestItemDto } from '../../api/types';

const NOW = Date.parse('2026-09-06T12:00:00.000Z');

describe('shouldFetchDigest (spec §1 rules 12-13)', () => {
  test('never fetches when the setting is off, however long ago the last one was', () => {
    expect(shouldFetchDigest(null, NOW, false)).toBe(false);
    expect(shouldFetchDigest(NOW - 10 * DIGEST_INTERVAL_MS, NOW, false)).toBe(false);
  });

  test('fetches when this device has never spoken a digest', () => {
    expect(shouldFetchDigest(null, NOW, true)).toBe(true);
    expect(shouldFetchDigest(undefined, NOW, true)).toBe(true);
  });

  test('does not fetch again inside the 4-hour window', () => {
    expect(shouldFetchDigest(NOW - 1000, NOW, true)).toBe(false);
    expect(shouldFetchDigest(NOW - (DIGEST_INTERVAL_MS - 1), NOW, true)).toBe(false);
  });

  test('fetches again at exactly 4 hours and beyond', () => {
    expect(shouldFetchDigest(NOW - DIGEST_INTERVAL_MS, NOW, true)).toBe(true);
    expect(shouldFetchDigest(NOW - DIGEST_INTERVAL_MS - 1, NOW, true)).toBe(true);
  });

  test('an unreadable or future stamp is treated as due, never as a lock-out', () => {
    expect(shouldFetchDigest(NaN, NOW, true)).toBe(true);
    expect(shouldFetchDigest(NOW + DIGEST_INTERVAL_MS, NOW, true)).toBe(true);
  });
});

const received: DigestItemDto = { kind: 'received', amountPaisa: 500000, from: { name: 'Ali' } };
const bill: DigestItemDto = { kind: 'bill_due', amountPaisa: 432000, biller: { id: 'b', name: 'K-Electric' } };
const approval: DigestItemDto = { kind: 'approval_waiting', amountPaisa: 3000000, payer: { name: 'Ammi', phone: '+923001110001' } };

describe('digestSpeech (spec §1 rule 12: at most 2 sentences)', () => {
  test('an empty digest is spoken as nothing at all', () => {
    expect(digestSpeech([], 'en')).toBe('');
  });

  test('one kind produces one sentence', () => {
    const s = digestSpeech([received], 'en');
    expect(s).toContain('₨5,000');
    expect(s.split('.').filter((x) => x.trim()).length).toBe(1);
  });

  test('waiting items and money news split into exactly two sentences', () => {
    const s = digestSpeech([approval, received, bill], 'en');
    expect(s.split('.').filter((x) => x.trim()).length).toBe(2);
  });

  test('every kind at once is still at most two sentences', () => {
    const all: DigestItemDto[] = [
      approval, received, bill,
      { kind: 'request', amountPaisa: 100000, from: { name: 'Sara', phone: '+923001110004' } },
      { kind: 'anomaly', category: 'bills', thisMonthPaisa: 1, averagePaisa: 1, ratio: 2 },
      { kind: 'guardian_notice', change: 'remove', payer: { name: 'Ammi', phone: '+923001110001' } },
    ];
    expect(digestSpeech(all, 'en').split('.').filter((x) => x.trim()).length).toBe(2);
  });

  test('amounts are summed per kind, not listed one by one', () => {
    expect(digestSpeech([received, { ...received, amountPaisa: 250000 }], 'en')).toContain('₨7,500');
  });

  test('speaks Urdu when asked, without changing the active UI language', () => {
    const ur = digestSpeech([received], 'ur');
    expect(ur).not.toBe(digestSpeech([received], 'en'));
    expect(ur.length).toBeGreaterThan(0);
  });
});

describe('capSpeech (POST /speak is capped at 200 chars, and bills per one)', () => {
  test('a short summary is returned untouched', () => {
    expect(capSpeech('You have 1 bill due.')).toBe('You have 1 bill due.');
  });

  test('drops whole trailing sentences rather than cutting one in half', () => {
    const a = `${'a'.repeat(120)}.`;
    const b = `${'b'.repeat(120)}.`;
    expect(capSpeech(`${a} ${b}`)).toBe(a);
  });

  test('keeps the terminator with the sentence it belongs to', () => {
    expect(capSpeech(`${'a'.repeat(150)}. short.`, 160)).toMatch(/\.$/);
  });

  test('falls back to a hard slice only when even the first sentence is too long', () => {
    const one = `${'a'.repeat(400)}.`;
    const out = capSpeech(one);
    expect(out.length).toBeLessThanOrEqual(200);
    expect(out.length).toBeGreaterThan(0);
  });

  test('a real all-kinds digest never exceeds the cap', () => {
    const many: DigestItemDto[] = [
      ...Array.from({ length: 5 }, () => approval),
      ...Array.from({ length: 5 }, () => received),
      ...Array.from({ length: 5 }, () => bill),
      { kind: 'request', amountPaisa: 1, from: { name: 'Sara', phone: '+92300' } },
      { kind: 'anomaly', category: 'bills', thisMonthPaisa: 1, averagePaisa: 1, ratio: 2 },
      { kind: 'guardian_notice', change: 'remove', payer: { name: 'Ammi', phone: '+92300' } },
    ];
    expect(digestSpeech(many, 'en').length).toBeLessThanOrEqual(200);
  });
});

describe('toDigestCard guardian_notice branches (never "Rs 0")', () => {
  const notice = (change: DigestItemDto['change'], extra: Partial<DigestItemDto> = {}): DigestItemDto =>
    ({ kind: 'guardian_notice', change, payer: { name: 'Ammi', phone: '+92300' }, ...extra });

  test('remove shows no amount at all', () => {
    const row = toDigestCard([notice('remove')]).items[0];
    expect(row.subtitle?.en).not.toMatch(/₨|Rs/);
  });

  test('replace gets its own copy, not the removal or the raise one', () => {
    const [remove, replace] = [notice('remove'), notice('replace')].map((n) => toDigestCard([n]).items[0]);
    expect(replace.subtitle?.en).not.toBe(remove.subtitle?.en);
    expect(replace.subtitle?.en).not.toMatch(/₨|Rs/);
  });

  test('raise is the only branch that renders an amount', () => {
    expect(toDigestCard([notice('raise', { ceilingPaisa: 500000 })]).items[0].subtitle?.en).toContain('₨5,000');
  });

  test('a reminder is a nudge, not a loosening — own copy, approvals intent, no amount', () => {
    const row = toDigestCard([notice('reminder', { actionId: 'a1' })]).items[0];
    expect(row.subtitle?.en).not.toMatch(/₨|Rs/);
    expect(row.intent?.en).toBe(toDigestCard([{ kind: 'approval_waiting', payer: { name: 'x', phone: 'y' } }]).items[0].intent?.en);
  });
});
