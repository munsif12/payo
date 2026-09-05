import { CheckInClearance, GuardianNotice, PendingAction, User } from '../models';
import { DEFAULT_CEILING_PAISA } from '../models/User';
import { normalizePhone } from './resolveRecipient';
import { isSenior } from './risk';
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
export const PRESSURE_LANGUAGE = 'pressure_language';

/** A first payment to someone new at or above this always goes to the guardian. */
export const NEW_RECIPIENT_APPROVAL_PAISA = 2_000_000; // ₨20,000
/** What counts as "large" for the SENIOR check-in: a quarter of the balance, or ₨20,000. */
const LARGE_ABSOLUTE_PAISA = 2_000_000;
const LARGE_BALANCE_SHARE = 0.25;
/** How long a senior's "no, my own idea" answer covers that same recipient. */
export const CHECK_IN_CLEARANCE_MS = 24 * 60 * 60 * 1000;

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

/**
 * The AI may name the recipient its pressure detection was actually about
 * (`riskTarget`). A flag raised because "someone rang about paying Ali" must not stick to
 * an unrelated send to the electricity company two turns later, so it is applied only when
 * the recipient matches. Identifiers are compared in canonical `+92…` form, since the AI
 * repeats whatever the user said (`0300…`, `+92300…`) while resolution normalises.
 * No `riskTarget` = the old unscoped behaviour, so an older AI build still works.
 */
export function scopedRiskFlags(
  clientRiskFlags: string[],
  riskTarget: { institutionId: string; identifier: string } | undefined,
  recipient: { institutionId: string; identifier: string },
): string[] {
  if (!clientRiskFlags.length || !riskTarget) return [...clientRiskFlags];
  const canonical = (v: string) => normalizePhone(v) ?? v;
  const matches = riskTarget.institutionId === recipient.institutionId
    && canonical(riskTarget.identifier) === canonical(recipient.identifier);
  return matches ? [...clientRiskFlags] : [];
}

/** Has this user recently said "my own idea" about this exact recipient? */
export async function isCheckInCleared(userId: string, institutionId: string, identifier: string): Promise<boolean> {
  const cleared = await CheckInClearance.findOne({ userId, institutionId, identifier });
  return !!cleared && Date.now() - cleared.clearedAt.getTime() < CHECK_IN_CLEARANCE_MS;
}

/** Records a "no, my own idea" so the same recipient is not queried again for 24 h. */
export async function recordCheckInClearance(userId: string, institutionId: string, identifier: string) {
  await CheckInClearance.findOneAndUpdate(
    { userId, institutionId, identifier },
    { $set: { clearedAt: new Date() } },
    { upsert: true },
  );
}

export interface SendRisk {
  riskFlags: string[];
  approval: { required: true; guardianId: string; status: 'waiting' } | undefined;
  expiryMs: number | undefined;
}

/**
 * The whole guardian + scam rule in one place. The two gates answer different questions and
 * are deliberately decoupled:
 *
 * APPROVAL (a second person reviews the money) is AGE-INDEPENDENT — at or above the ceiling,
 * a first payment to someone new of ₨20,000 or more, or a pressure flag that actually names
 * this recipient. A ₨1,000 send to someone new is not worth a guardian's time and asking
 * for one would make the feature something users switch off.
 *
 * CHECK-IN (the scam question, asked of the payer) is age-dependent, because the interruption
 * only earns its friction where the harm lands hardest: `pressure_language` asks EVERYONE,
 * while the money-pattern signal asks a senior at a quarter of their balance or ₨20,000, and
 * everyone else only at the ceiling. A senior's "no, my own idea" then covers that same
 * recipient for 24 h, so a retry is not met with the same question.
 *
 * The window stretches to 30 minutes as soon as either gate applies.
 */
export function evaluateSend(i: {
  user: UserDoc; amountPaisa: number; balancePaisa: number; newRecipient: boolean;
  clientRiskFlags: string[]; checkInCleared?: boolean;
}): SendRisk {
  const guardian = i.user.guardian;
  const ceilingPaisa = guardian?.ceilingPaisa ?? DEFAULT_CEILING_PAISA;
  const senior = isSenior(i.user);

  const riskFlags = [...i.clientRiskFlags];
  const largeForSenior = i.amountPaisa >= i.balancePaisa * LARGE_BALANCE_SHARE
    || i.amountPaisa >= LARGE_ABSOLUTE_PAISA;
  const asksAboutNewRecipient = i.newRecipient
    && (senior ? largeForSenior : i.amountPaisa >= ceilingPaisa);
  if (asksAboutNewRecipient && !(senior && i.checkInCleared) && !riskFlags.includes(NEW_RECIPIENT_LARGE))
    riskFlags.push(NEW_RECIPIENT_LARGE);

  const needsApproval = !!guardian && (
    i.amountPaisa >= ceilingPaisa
    || (i.newRecipient && i.amountPaisa >= NEW_RECIPIENT_APPROVAL_PAISA)
    || i.clientRiskFlags.includes(PRESSURE_LANGUAGE)
  );

  return {
    riskFlags,
    approval: needsApproval && guardian
      ? { required: true, guardianId: String(guardian.userId), status: 'waiting' }
      : undefined,
    expiryMs: needsApproval || riskFlags.length ? APPROVAL_EXPIRY_MS : undefined,
  };
}
