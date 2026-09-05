import { Request, Response } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { Account, Institution, MoneyRequest, User } from '../models';
import { ApiError } from '../lib/apiError';
import { ok } from '../lib/respond';
import { createPendingAction, toActionDto } from '../lib/pendingActions';
import { fmtRs } from '../lib/fmt';
import { applyDueGuardianPending, evaluateSend, isNewRecipient } from '../lib/guardian';

type MRDoc = InstanceType<typeof MoneyRequest>;

async function requestDto(r: MRDoc, viewerId: string) {
  const outgoing = String(r.requesterId) === viewerId;
  const counterpartId = outgoing ? r.payerId : r.requesterId;
  const cp = await User.findById(counterpartId);
  return {
    id: String(r._id),
    direction: outgoing ? 'outgoing' : 'incoming',
    counterparty: { name: cp?.name ?? '?', urduName: cp?.urduName ?? undefined, phone: cp?.phone ?? '' },
    amountPaisa: r.amountPaisa, note: r.note ?? undefined, status: r.status,
    createdAt: (r as unknown as { createdAt: Date }).createdAt.toISOString(),
  };
}

export async function createRequest(req: Request, res: Response) {
  const { fromPhone, amountPaisa, note } = z.object({
    fromPhone: z.string().regex(/^\+92\d{10}$/),
    amountPaisa: z.number().int().positive(),
    note: z.string().optional(),
  }).parse(req.body);
  const payer = await User.findOne({ phone: fromPhone });
  if (!payer) throw new ApiError(404, 'RECIPIENT_NOT_FOUND', 'No PAYO user with that phone');
  if (String(payer._id) === req.userId) throw new ApiError(400, 'SELF_REQUEST', 'Cannot request money from yourself');
  const r = await MoneyRequest.create({ requesterId: req.userId, payerId: payer._id, amountPaisa, note });
  return ok(res, { request: await requestDto(r, req.userId) }, 201);
}

export async function listRequests(req: Request, res: Response) {
  const items = await MoneyRequest.find({
    $or: [{ requesterId: req.userId }, { payerId: req.userId }],
  }).sort({ createdAt: -1 });
  return ok(res, { items: await Promise.all(items.map(r => requestDto(r, req.userId))) });
}

export async function approveRequest(req: Request, res: Response) {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) throw new ApiError(404, 'NOT_FOUND', 'Request not found');
  const r = await MoneyRequest.findOne({ _id: id, payerId: req.userId });
  if (!r) throw new ApiError(404, 'NOT_FOUND', 'Request not found');
  if (r.status !== 'pending') throw new ApiError(410, 'REQUEST_GONE', 'Request already handled');
  const requester = await User.findById(r.requesterId);
  if (!requester) throw new ApiError(404, 'NOT_FOUND', 'Requester not found');

  // Settling a request moves money out exactly like a transfer, so it runs the SAME guardian
  // and scam evaluation (spec §A.6a). The recipient is the requester's PAYO identity —
  // institution PAYO + their phone — which is also what goes in the payload, so a completed
  // settlement and a completed transfer make each other "not a new recipient" from then on.
  const payo = await Institution.findOne({ code: 'PAYO' });
  // Without the PAYO institution the settlement could not be matched against transfers
  // ("new recipient" symmetry) — that is a broken seed, not a user error.
  if (!payo) throw new ApiError(500, 'INSTITUTIONS_NOT_SEEDED', 'PAYO institution missing');
  const institutionId = String(payo._id);
  const [payer, account] = await Promise.all([
    User.findById(req.userId), Account.findOne({ userId: req.userId }),
  ]);
  if (!payer || !account) throw new ApiError(404, 'NOT_FOUND', 'User not found');
  await applyDueGuardianPending(payer);
  const risk = evaluateSend({
    user: payer, amountPaisa: r.amountPaisa, balancePaisa: account.balancePaisa,
    newRecipient: await isNewRecipient(req.userId, institutionId, requester.phone),
    clientRiskFlags: [],
  });

  const action = await createPendingAction({
    userId: req.userId, kind: 'request_settlement',
    payload: {
      requestId: String(r._id), requesterId: String(requester._id),
      requesterName: requester.name, requesterUrduName: requester.urduName ?? undefined,
      requesterPhone: requester.phone,
      institutionId, identifier: requester.phone,
    },
    amountPaisa: r.amountPaisa, feePaisa: 0,
    approval: risk.approval, riskFlags: risk.riskFlags, expiryMs: risk.expiryMs,
    summary: {
      en: `Send ${fmtRs(r.amountPaisa)} to ${requester.name} (request)`,
      ur: `${requester.urduName ?? requester.name} کو ${fmtRs(r.amountPaisa)} بھیجیں (درخواست)`,
    },
    lines: [
      { label: { en: 'To', ur: 'وصول کنندہ' }, value: `${requester.name} · ${requester.phone}` },
      { label: { en: 'Amount', ur: 'رقم' }, value: fmtRs(r.amountPaisa) },
    ],
  });
  return ok(res, toActionDto(action), 201);
}

export async function declineRequest(req: Request, res: Response) {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) throw new ApiError(404, 'NOT_FOUND', 'Request not found');
  const r = await MoneyRequest.findOne({ _id: id, payerId: req.userId });
  if (!r) throw new ApiError(404, 'NOT_FOUND', 'Request not found');
  if (r.status !== 'pending') throw new ApiError(410, 'REQUEST_GONE', 'Request already handled');
  r.status = 'declined';
  await r.save();
  return ok(res, { declined: true });
}
