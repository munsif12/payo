import { guardianPendingLine, approvalOutcome } from '../guardianPolicy';
import type { PendingAction } from '../../../api/types';

const t = (key: string, opts?: Record<string, unknown>) => (opts ? `${key}:${JSON.stringify(opts)}` : key);
const money = (p: number) => `Rs${p / 100}`;
const AT = '2026-09-06T12:00:00.000Z';

describe('guardianPendingLine', () => {
  test('nothing pending renders no line at all', () => {
    expect(guardianPendingLine(null, 100, t, money)).toBeNull();
    expect(guardianPendingLine(undefined, 100, t, money)).toBeNull();
  });

  test('no effectiveAt is a PROPOSAL, not a scheduled change', () => {
    expect(guardianPendingLine({ change: 'set', phone: '+923001110002' }, 100, t, money))
      .toBe('guardian.pending.proposed');
  });

  test('remove gets the removal copy and never an amount', () => {
    const line = guardianPendingLine({ change: 'remove', effectiveAt: AT }, 100, t, money)!;
    expect(line).toContain('guardian.pending.remove');
    expect(line).not.toContain('Rs');
  });

  test('replace names the INCOMING contact rather than borrowing the removal copy', () => {
    const line = guardianPendingLine({ change: 'replace', effectiveAt: AT, name: 'Bilal', phone: '+92300' }, 100, t, money)!;
    expect(line).toContain('guardian.pending.replace');
    expect(line).toContain('Bilal');
  });

  test('replace falls back to the phone when no name travelled with it', () => {
    expect(guardianPendingLine({ change: 'replace', effectiveAt: AT, phone: '+923001110002' }, 100, t, money))
      .toContain('+923001110002');
  });

  test('raise renders the ceiling it is going TO, not the current one', () => {
    expect(guardianPendingLine({ change: 'raise', effectiveAt: AT, ceilingPaisa: 500000 }, 100, t, money))
      .toContain('Rs5000');
  });

  test('a raise missing its target falls back to the current ceiling, never Rs 0', () => {
    const line = guardianPendingLine({ change: 'raise', effectiveAt: AT }, 100000, t, money)!;
    expect(line).toContain('Rs1000');
    expect(line).not.toContain('Rs0');
  });

  test('an unknown change from a newer service degrades to the neutral line', () => {
    expect(guardianPendingLine({ change: 'something_new', effectiveAt: AT }, 100, t, money))
      .toBe('guardian.pending.proposed');
  });
});

const NOW = Date.parse('2026-09-06T12:00:00.000Z');
const base: PendingAction = {
  id: 'a1', kind: 'send_money', amountPaisa: 100, feePaisa: 0,
  summary: { en: 's', ur: 's' }, lines: [], requiresPin: true,
  expiresAt: new Date(NOW + 60_000).toISOString(), status: 'pending',
};

describe('approvalOutcome', () => {
  test('still pending and unexpired is waiting', () => {
    expect(approvalOutcome({ ...base, approval: { required: true, guardianId: 'g', status: 'waiting' } }, NOW)).toBe('waiting');
  });

  test('approved wins even at the very end of the window', () => {
    expect(approvalOutcome({ ...base, approval: { required: true, guardianId: 'g', status: 'approved' } }, NOW)).toBe('approved');
  });

  test('a decline is a decline', () => {
    expect(approvalOutcome({
      ...base, status: 'cancelled', cancelReason: 'guardian_declined',
      approval: { required: true, guardianId: 'g', status: 'declined', reason: 'too big' },
    }, NOW)).toBe('declined');
  });

  test('running out of time reads as expired, NOT as "did not approve"', () => {
    const past = { ...base, expiresAt: new Date(NOW - 1).toISOString(), approval: { required: true, guardianId: 'g', status: 'waiting' as const } };
    expect(approvalOutcome(past, NOW)).toBe('expired');
  });

  test('cancelReason "expired" reads as expired even inside the window', () => {
    expect(approvalOutcome({ ...base, status: 'cancelled', cancelReason: 'expired' }, NOW)).toBe('expired');
  });
});
