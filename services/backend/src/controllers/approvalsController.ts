import { Request, Response } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { PendingAction, User } from '../models';
import { ApiError } from '../lib/apiError';
import { ok } from '../lib/respond';
import { assertPinOk } from '../lib/pinAuth';
import { isCurrentGuardianOf, wardsOf } from '../lib/guardian';

type PADoc = InstanceType<typeof PendingAction>;
type UserDoc = InstanceType<typeof User>;

/**
 * What a guardian is shown and handed back — the payer, the amount, the risk, and nothing
 * else. The raw action carries the payload and the payer's own `requiresPin`, which are the
 * payer's business, not the guardian's.
 */
const approvalItemDto = (a: PADoc, payer: UserDoc | undefined) => ({
  id: String(a._id), kind: a.kind,
  payer: { name: payer?.name ?? '?', urduName: payer?.urduName ?? undefined, phone: payer?.phone ?? '' },
  summary: a.summary, amountPaisa: a.amountPaisa, feePaisa: a.feePaisa,
  riskFlags: [...a.riskFlags],
  status: a.status,
  approval: a.approval
    ? {
      status: a.approval.status,
      decidedAt: a.approval.decidedAt?.toISOString() ?? null,
      reason: a.approval.reason ?? null,
      remindedAt: a.approval.remindedAt?.toISOString() ?? null,
    }
    : null,
  createdAt: (a as unknown as { createdAt: Date }).createdAt.toISOString(),
  expiresAt: a.expiresAt.toISOString(),
});

/**
 * Ownership for the guardian side. Authority is the payer's CURRENT guardian, never the
 * `approval.guardianId` snapshot taken when the action was raised (spec §A.6a): a guardian
 * since removed or replaced has none, and whoever holds the role now has it instead. Anyone
 * without it — the payer included, who must never self-approve — gets a plain 404 rather
 * than a 403, so a stranger cannot probe which action ids exist.
 */
async function guardedAction(guardianId: string, id: unknown): Promise<{ action: PADoc; payer: UserDoc }> {
  if (typeof id !== 'string' || !mongoose.isValidObjectId(id))
    throw new ApiError(404, 'NOT_FOUND', 'Approval not found');
  const action = await PendingAction.findOne({ _id: id, approval: { $ne: null } });
  if (!action || !action.approval) throw new ApiError(404, 'NOT_FOUND', 'Approval not found');
  if (!(await isCurrentGuardianOf(action.userId, guardianId)))
    throw new ApiError(404, 'NOT_FOUND', 'Approval not found');
  const payer = await User.findById(action.userId);
  if (!payer) throw new ApiError(404, 'NOT_FOUND', 'Approval not found');
  return { action, payer };
}

function assertStillWaiting(action: PADoc) {
  if (!action.approval || action.approval.status !== 'waiting'
    || action.status !== 'pending' || action.expiresAt < new Date())
    throw new ApiError(410, 'ACTION_GONE', 'Approval expired or already handled');
}

/** GET /approvals — my inbox as a guardian: waiting, unexpired, newest first. */
export async function listApprovals(req: Request, res: Response) {
  const wards = await wardsOf(req.userId);
  if (!wards.length) return ok(res, { items: [] });

  const actions = await PendingAction.find({
    userId: { $in: wards }, 'approval.status': 'waiting',
    status: 'pending', expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });

  const payers = await User.find({ _id: { $in: actions.map(a => a.userId) } });
  const payerMap = new Map(payers.map(u => [String(u._id), u]));
  return ok(res, { items: actions.map(a => approvalItemDto(a, payerMap.get(String(a.userId)))) });
}

/**
 * POST /approvals/:id/approve — the guardian's OWN PIN, through the shared `assertPinOk`
 * (so the lockout is the same one that guards their login). Approving only lifts the
 * guardian gate: the payer still has to enter their own PIN at execute.
 */
export async function approveAction(req: Request, res: Response) {
  const { pin } = z.object({ pin: z.string() }).parse(req.body ?? {});
  const { action, payer } = await guardedAction(req.userId, req.params.id);
  assertStillWaiting(action);

  const guardian = await User.findById(req.userId);
  if (!guardian) throw new ApiError(401, 'INVALID_PIN', 'Wrong PIN');
  await assertPinOk(guardian, pin);

  action.approval!.status = 'approved';
  action.approval!.decidedAt = new Date();
  await action.save();
  return ok(res, approvalItemDto(action, payer));
}

/** POST /approvals/:id/decline — no PIN; the action is cancelled with the guardian's reason. */
export async function declineAction(req: Request, res: Response) {
  const { reason } = z.object({ reason: z.string().max(200).optional() }).parse(req.body ?? {});
  const { action, payer } = await guardedAction(req.userId, req.params.id);
  assertStillWaiting(action);

  action.approval!.status = 'declined';
  action.approval!.decidedAt = new Date();
  if (reason !== undefined) action.approval!.reason = reason;
  action.status = 'cancelled';
  action.cancelReason = 'guardian_declined';
  await action.save();
  return ok(res, approvalItemDto(action, payer));
}
