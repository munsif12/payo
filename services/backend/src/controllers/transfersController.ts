import { Request, Response } from 'express';
import { z } from 'zod';
import { Account, Recipient, User } from '../models';
import { ApiError } from '../lib/apiError';
import { ok } from '../lib/respond';
import { createPendingAction, toActionDto } from '../lib/pendingActions';
import { feeFor } from '../config/fees';
import { fmtRs } from '../lib/fmt';
import { resolveRecipient, maskIdentifier } from '../lib/resolveRecipient';
import { applyDueGuardianPending, evaluateSend, isNewRecipient, CLIENT_RISK_FLAGS } from '../lib/guardian';

const resolveBodySchema = z.object({ institutionId: z.string(), identifier: z.string().min(1) });

export async function resolveTransfer(req: Request, res: Response) {
  const { institutionId, identifier } = resolveBodySchema.parse(req.body);
  const resolved = await resolveRecipient(institutionId, identifier, req.userId);
  return ok(res, resolved);
}

const bodySchema = z.object({
  to: z.union([
    z.object({ recipientId: z.string() }),
    z.object({ institutionId: z.string(), identifier: z.string().min(1) }),
  ]),
  amountPaisa: z.number().int().positive(),
  note: z.string().optional(),
  // Conversation-pattern signals from the AI service. Allow-listed: the client may only
  // assert `pressure_language`; `new_recipient_large` is the backend's to add.
  riskFlags: z.array(z.enum(CLIENT_RISK_FLAGS)).optional(),
});

const LINE_TO = { en: 'To', ur: 'وصول کنندہ' };
const LINE_AMOUNT = { en: 'Amount', ur: 'رقم' };
const LINE_FEE = { en: 'Fee', ur: 'فیس' };

export async function createTransfer(req: Request, res: Response) {
  const { to, amountPaisa, riskFlags: clientRiskFlags } = bodySchema.parse(req.body);

  let institutionId: string; let identifier: string; let recipientId: string | undefined;
  if ('recipientId' in to) {
    const r = await Recipient.findOne({ _id: to.recipientId, userId: req.userId }).catch(() => null);
    if (!r) throw new ApiError(404, 'NOT_FOUND', 'Recipient not found');
    institutionId = String(r.institutionId);
    identifier = r.identifier;
    recipientId = String(r._id);
  } else {
    institutionId = to.institutionId;
    identifier = to.identifier;
  }

  const resolved = await resolveRecipient(institutionId, identifier, req.userId);
  const kind = resolved.institution.kind === 'bank'
    ? 'send_money_bank'
    : (resolved.linkedUserId ? 'send_money' : 'send_money_wallet');
  const feePaisa = feeFor(kind);

  const payload = {
    institutionId: resolved.institution.id, institutionName: resolved.institution.name,
    institutionUrduName: resolved.institution.urduName, institutionKind: resolved.institution.kind,
    identifier: resolved.identifier, title: resolved.title, linkedUserId: resolved.linkedUserId, recipientId,
  };

  const lines = [
    { label: LINE_TO, value: `${resolved.title} · ${resolved.institution.name} · ${maskIdentifier(resolved.identifier)}` },
    { label: LINE_AMOUNT, value: fmtRs(amountPaisa) },
  ];
  if (feePaisa > 0) lines.push({ label: LINE_FEE, value: fmtRs(feePaisa) });

  const [user, account] = await Promise.all([
    User.findById(req.userId), Account.findOne({ userId: req.userId }),
  ]);
  if (!user || !account) throw new ApiError(404, 'NOT_FOUND', 'User not found');
  await applyDueGuardianPending(user);
  const risk = evaluateSend({
    user, amountPaisa, balancePaisa: account.balancePaisa,
    newRecipient: await isNewRecipient(req.userId, resolved.institution.id, resolved.identifier),
    clientRiskFlags: clientRiskFlags ?? [],
  });

  const action = await createPendingAction({
    userId: req.userId, kind, payload,
    amountPaisa, feePaisa,
    approval: risk.approval, riskFlags: risk.riskFlags, expiryMs: risk.expiryMs,
    summary: {
      en: `Send ${fmtRs(amountPaisa)} to ${resolved.title}`,
      ur: `${resolved.title} کو ${fmtRs(amountPaisa)} بھیجیں`,
    },
    lines,
  });
  return ok(res, toActionDto(action), 201);
}
