import { Request, Response } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { Pocket } from '../models';
import { ApiError } from '../lib/apiError';
import { ok } from '../lib/respond';
import { createPendingAction, toActionDto } from '../lib/pendingActions';
import { fmtRs } from '../lib/fmt';

type PocketDoc = InstanceType<typeof Pocket>;

const pocketDto = (p: PocketDoc) => ({
  id: String(p._id), name: p.name, urduName: p.urduName ?? undefined, emoji: p.emoji,
  goalPaisa: p.goalPaisa ?? undefined, balancePaisa: p.balancePaisa,
});

export async function listPockets(req: Request, res: Response) {
  const items = await Pocket.find({ userId: req.userId }).sort({ createdAt: 1 });
  return ok(res, { items: items.map(pocketDto) });
}

export async function createPocket(req: Request, res: Response) {
  const body = z.object({
    name: z.string().min(1),
    urduName: z.string().optional(),
    emoji: z.string().min(1),
    goalPaisa: z.number().int().positive().optional(),
  }).parse(req.body);
  const p = await Pocket.create({ userId: req.userId, ...body });
  return ok(res, pocketDto(p), 201);
}

async function findOwnPocket(userId: string, id: unknown) {
  if (typeof id !== 'string' || !mongoose.isValidObjectId(id)) throw new ApiError(404, 'NOT_FOUND', 'Pocket not found');
  const p = await Pocket.findOne({ _id: id, userId });
  if (!p) throw new ApiError(404, 'NOT_FOUND', 'Pocket not found');
  return p;
}

export async function depositPocket(req: Request, res: Response) {
  const { amountPaisa } = z.object({ amountPaisa: z.number().int().positive() }).parse(req.body);
  const p = await findOwnPocket(req.userId, req.params.id);
  const action = await createPendingAction({
    userId: req.userId, kind: 'pocket_deposit',
    payload: { pocketId: String(p._id), pocketName: p.name, pocketUrduName: p.urduName ?? undefined },
    amountPaisa, feePaisa: 0, requiresPin: true,
    summary: {
      en: `Add ${fmtRs(amountPaisa)} to ${p.name}`,
      ur: `${p.urduName ?? p.name} میں ${fmtRs(amountPaisa)} ڈالیں`,
    },
    lines: [{ label: { en: 'Pocket', ur: 'بچت' }, value: `${p.emoji} ${p.urduName ?? p.name}` }],
  });
  return ok(res, toActionDto(action), 201);
}

export async function withdrawPocket(req: Request, res: Response) {
  const { amountPaisa } = z.object({ amountPaisa: z.number().int().positive() }).parse(req.body);
  const p = await findOwnPocket(req.userId, req.params.id);
  const action = await createPendingAction({
    userId: req.userId, kind: 'pocket_withdraw',
    payload: { pocketId: String(p._id), pocketName: p.name, pocketUrduName: p.urduName ?? undefined },
    amountPaisa, feePaisa: 0, requiresPin: true,
    summary: {
      en: `Withdraw ${fmtRs(amountPaisa)} from ${p.name}`,
      ur: `${p.urduName ?? p.name} سے ${fmtRs(amountPaisa)} نکالیں`,
    },
    lines: [{ label: { en: 'Pocket', ur: 'بچت' }, value: `${p.emoji} ${p.urduName ?? p.name}` }],
  });
  return ok(res, toActionDto(action), 201);
}
