import { Request, Response } from 'express';
import { z } from 'zod';
import { Recipient } from '../models';
import { ApiError } from '../lib/apiError';
import { ok } from '../lib/respond';
import { createPendingAction, toActionDto } from '../lib/pendingActions';
import { feeFor } from '../config/fees';
import { fmtRs } from '../lib/fmt';
import { resolveRecipient, maskIdentifier } from '../lib/resolveRecipient';

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
});

const LINE_TO = { en: 'To', ur: 'وصول کنندہ' };
const LINE_AMOUNT = { en: 'Amount', ur: 'رقم' };
const LINE_FEE = { en: 'Fee', ur: 'فیس' };

export async function createTransfer(req: Request, res: Response) {
  const { to, amountPaisa } = bodySchema.parse(req.body);

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

  const action = await createPendingAction({
    userId: req.userId, kind, payload,
    amountPaisa, feePaisa,
    summary: {
      en: `Send ${fmtRs(amountPaisa)} to ${resolved.title}`,
      ur: `${resolved.title} کو ${fmtRs(amountPaisa)} بھیجیں`,
    },
    lines,
  });
  return ok(res, toActionDto(action), 201);
}
