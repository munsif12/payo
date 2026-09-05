import { GuardianNotice, PendingAction, User } from '../models';
import { DEFAULT_CEILING_PAISA } from '../models/User';
import { config } from '../config';

export { DEFAULT_CEILING_PAISA };

type UserDoc = InstanceType<typeof User>;

/** The three transfer kinds (the ones that also produce a save-this-recipient suggestion). */
export const SEND_KINDS = ['send_money', 'send_money_bank', 'send_money_wallet'];

/**
 * Every kind that pays an identified recipient, and so counts as "I have paid them before".
 * Settling a money request pays the requester's PAYO identity, so it belongs here too.
 */
export const PAID_RECIPIENT_KINDS = [...SEND_KINDS, 'request_settlement'];

/** Risk flags the AI service is allowed to assert. The backend adds `new_recipient_large`. */
export const CLIENT_RISK_FLAGS = ['pressure_language'] as const;

export const NEW_RECIPIENT_LARGE = 'new_recipient_large';
const LARGE_ABSOLUTE_PAISA = 2_000_000; // ₨20,000
const LARGE_BALANCE_SHARE = 0.25;

export const APPROVAL_EXPIRY_MS = 30 * 60 * 1000;

/**
 * Applies a due `guardianPending` LAZILY — there is no cron. Every read of the guardian
 * state (GET /guardian, GET /me, and the transfer rule evaluation) calls this first, so a
 * scheduled loosening takes effect at exactly the moment it is next observed, and while it
 * is still cooling the OLD rule keeps applying.
 */
export async function applyDueGuardianPending(user: UserDoc): Promise<UserDoc> {
  const pending = user.guardianPending;
  if (!pending || pending.effectiveAt > new Date()) return user;

  if (pending.change === 'remove') user.set('guardian', undefined);
  else if (pending.change === 'replace' && pending.userId && pending.phone && pending.name)
    user.set('guardian', {
      userId: pending.userId, phone: pending.phone, name: pending.name,
      ceilingPaisa: user.guardian?.ceilingPaisa ?? DEFAULT_CEILING_PAISA,
      since: new Date(),
    });
  else if (user.guardian && pending.ceilingPaisa !== undefined && pending.ceilingPaisa !== null)
    user.guardian.ceilingPaisa = pending.ceilingPaisa;
  user.set('guardianPending', undefined);
  await user.save();
  return user;
}

/**
 * The one question every approval path must ask: is `guardianId` the payer's guardian RIGHT
 * NOW? Authority is never taken from the snapshot on the action — a guardian removed or
 * replaced since it was raised has none, and whoever holds the role now has it instead
 * (spec §A.6a). Settles any due cooling first, so a lapsed replacement counts.
 */
export async function isCurrentGuardianOf(payerId: unknown, guardianId: string): Promise<boolean> {
  const payer = await User.findById(payerId);
  if (!payer) return false;
  await applyDueGuardianPending(payer);
  return String(payer.guardian?.userId ?? '') === guardianId;
}

/** The payers who have `guardianId` as their guardian right now (pending changes settled). */
export async function wardsOf(guardianId: string): Promise<string[]> {
  const candidates = await User.find({
    $or: [{ 'guardian.userId': guardianId }, { 'guardianPending.userId': guardianId }],
  });
  const wards: string[] = [];
  for (const c of candidates) {
    await applyDueGuardianPending(c);
    if (String(c.guardian?.userId ?? '') === guardianId) wards.push(String(c._id));
  }
  return wards;
}

export const guardianSummary = (user: UserDoc) =>
  user.guardian ? { name: user.guardian.name, phone: user.guardian.phone } : undefined;

export const guardianStateDto = (user: UserDoc) => ({
  guardian: user.guardian
    ? {
      userId: String(user.guardian.userId), phone: user.guardian.phone, name: user.guardian.name,
      ceilingPaisa: user.guardian.ceilingPaisa, since: user.guardian.since.toISOString(),
    }
    : null,
  pending: user.guardianPending
    ? {
      change: user.guardianPending.change,
      ceilingPaisa: user.guardianPending.ceilingPaisa ?? undefined,
      phone: user.guardianPending.phone ?? undefined,
      name: user.guardianPending.name ?? undefined,
      effectiveAt: user.guardianPending.effectiveAt.toISOString(),
    }
    : null,
  ceilingPaisa: user.guardian?.ceilingPaisa ?? DEFAULT_CEILING_PAISA,
  coolingMs: config.guardianCoolingMs,
});

/**
 * Raises a notice on the guardian's side — either "your protection is being loosened"
 * (remove/replace/raise) or a payer's Remind nudge. Addressed to the CURRENT guardian.
 */
export async function noticeGuardian(
  payer: UserDoc,
  change: 'remove' | 'replace' | 'raise' | 'reminder',
  effectiveAt: Date,
  extra: { ceilingPaisa?: number; actionId?: unknown } = {},
) {
  if (!payer.guardian) return;
  await GuardianNotice.create({
    userId: payer.guardian.userId, payerId: payer._id, payerName: payer.name, payerPhone: payer.phone,
    change, ceilingPaisa: extra.ceilingPaisa, actionId: extra.actionId, effectiveAt,
  });
}

/**
 * "New recipient" = this user has never COMPLETED a payment to this institution+identifier,
 * by transfer OR by settling that person's money request.
 *
 * The check runs over the user's own completed `PendingAction`s (the only record that keeps
 * the institution+identifier pair verbatim) rather than over `Transaction.counterparty`,
 * whose `detail` is masked for bank/other-wallet sends and so cannot identify a recipient.
 * Consequence, and the intended one: a recipient merely SAVED but never paid is still new.
 */
export async function isNewRecipient(userId: string, institutionId: string, identifier: string): Promise<boolean> {
  const paid = await PendingAction.exists({
    userId, kind: { $in: PAID_RECIPIENT_KINDS }, status: 'completed',
    'payload.institutionId': institutionId, 'payload.identifier': identifier,
  });
  return !paid;
}

export interface SendRisk {
  riskFlags: string[];
  approval: { required: true; guardianId: string; status: 'waiting' } | undefined;
  expiryMs: number | undefined;
}

/**
 * The whole guardian + scam rule in one place.
 *  - `new_recipient_large` is the backend's own money-pattern signal;
 *  - approval is needed when a guardian is set AND (new recipient | at-or-above the ceiling |
 *    any risk flag);
 *  - the window stretches to 30 minutes as soon as either gate applies.
 */
export function evaluateSend(i: {
  user: UserDoc; amountPaisa: number; balancePaisa: number; newRecipient: boolean; clientRiskFlags: string[];
}): SendRisk {
  const riskFlags = [...i.clientRiskFlags];
  const large = i.amountPaisa >= i.balancePaisa * LARGE_BALANCE_SHARE || i.amountPaisa >= LARGE_ABSOLUTE_PAISA;
  if (i.newRecipient && large && !riskFlags.includes(NEW_RECIPIENT_LARGE)) riskFlags.push(NEW_RECIPIENT_LARGE);

  const guardian = i.user.guardian;
  const needsApproval = !!guardian
    && (i.newRecipient || i.amountPaisa >= guardian.ceilingPaisa || riskFlags.length > 0);

  return {
    riskFlags,
    approval: needsApproval && guardian
      ? { required: true, guardianId: String(guardian.userId), status: 'waiting' }
      : undefined,
    expiryMs: needsApproval || riskFlags.length ? APPROVAL_EXPIRY_MS : undefined,
  };
}
