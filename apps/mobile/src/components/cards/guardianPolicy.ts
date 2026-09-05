// Pure guardian/approval presentation rules, kept out of CardView.tsx so both the
// chat cards and the classic-Send screens read the SAME logic and it can be unit
// tested without the native render stack (same split as confirmationPolicy.ts).
import type { PendingAction } from '../../api/types';

export type Translate = (key: string, opts?: Record<string, unknown>) => string;

/** A cooling-off deadline, as a short local date + time. */
export function formatEffective(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/** Both vocabularies in one shape: the BACKEND's `GET /guardian` pending
 *  ('remove' | 'replace' | 'raise', with the incoming guardian in phone/name) and the
 *  AI card's `GuardianPendingChange` ('set' | 'remove' | 'raise', with phone). */
export interface PendingChangeLike {
  change: string;
  effectiveAt?: string | null;
  ceilingPaisa?: number | null;
  phone?: string | null;
  name?: string | null;
}

/**
 * The one-line "this is still cooling off" explanation, or null when nothing is pending.
 *
 * Branches per change, so a `replace` never borrows the removal copy and a `remove`
 * never renders an amount it does not have — the "₨0" that a single shared line
 * produced. Without an `effectiveAt` nothing is scheduled at all: that is the
 * assistant PROPOSING a change the user still has to confirm with their PIN.
 *
 * @param fallbackCeilingPaisa the current ceiling, used only when a 'raise' arrived
 *                             without the target amount.
 */
export function guardianPendingLine(
  pending: PendingChangeLike | null | undefined,
  fallbackCeilingPaisa: number,
  t: Translate,
  formatAmount: (paisa: number) => string,
): string | null {
  if (!pending) return null;
  if (!pending.effectiveAt) return t('guardian.pending.proposed');
  const date = formatEffective(pending.effectiveAt);
  switch (pending.change) {
    case 'remove':
      return t('guardian.pending.remove', { date });
    case 'replace':
      return t('guardian.pending.replace', { name: pending.name ?? pending.phone ?? '', date });
    case 'raise':
      return t('guardian.pending.raise', { amount: formatAmount(pending.ceilingPaisa ?? fallbackCeilingPaisa), date });
    default:
      // 'set' (the AI card's proposal vocabulary) and anything a newer service adds:
      // say a change is pending without inventing details for it.
      return t('guardian.pending.proposed');
  }
}

export type ApprovalOutcome = 'waiting' | 'approved' | 'declined' | 'expired';

/**
 * What a polled action has settled into. Expiry is checked BEFORE the decline copy,
 * because an action that simply ran out of time is also `cancelled` server-side — and
 * telling the user their trusted contact "did not approve this" when nobody was ever
 * asked in time is both wrong and alarming.
 */
export function approvalOutcome(action: PendingAction, now: number): ApprovalOutcome {
  const expired = action.cancelReason === 'expired' || Date.parse(action.expiresAt) <= now;
  if (action.approval?.status === 'approved') return 'approved';
  if (expired && action.approval?.status !== 'declined') return 'expired';
  if (action.approval?.status === 'declined' || action.status === 'cancelled') return 'declined';
  return 'waiting';
}
