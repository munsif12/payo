import { Request, Response } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { SavedBiller, Biller } from '../models';
import { ApiError } from '../lib/apiError';
import { ok } from '../lib/respond';
import { ensureDueBill } from './billsController';
import { logoUrlFor } from '../lib/logos';

type SavedBillerDoc = InstanceType<typeof SavedBiller>;

// Returns null (never a partial shape) when the joined Biller is gone. Callers filter
// nulls out of list responses; createSavedBiller treats a null as an internal error.
async function savedBillerDto(sb: SavedBillerDoc) {
  const biller = await Biller.findById(sb.billerId);
  if (!biller) return null;
  return {
    id: String(sb._id), nickname: sb.nickname,
    biller: {
      id: String(biller._id), name: biller.name, urduName: biller.urduName, category: biller.category,
      domain: biller.domain, logoUrl: logoUrlFor(biller.domain),
    },
    consumerNo: sb.consumerNo, consumerName: sb.consumerName,
  };
}

export async function listSavedBillers(req: Request, res: Response) {
  const items = await SavedBiller.find({ userId: req.userId }).sort({ createdAt: -1 });
  const dtos = await Promise.all(items.map(savedBillerDto));
  return ok(res, { items: dtos.filter((d): d is NonNullable<typeof d> => d !== null) });
}

const createSchema = z.object({
  nickname: z.string().min(1),
  billerId: z.string(),
  consumerNo: z.string().regex(/^\d{10,14}$/, 'Consumer number must be 10-14 digits'),
});

export async function createSavedBiller(req: Request, res: Response) {
  const { nickname, billerId, consumerNo } = createSchema.parse(req.body);
  const bill = await ensureDueBill(req.userId, billerId, consumerNo);
  let saved: SavedBillerDoc;
  try {
    saved = await SavedBiller.create({
      userId: req.userId, nickname, billerId, consumerNo, consumerName: bill.consumerName,
    });
  } catch (e) {
    if (e instanceof Error && 'code' in e && (e as { code?: number }).code === 11000)
      throw new ApiError(409, 'ALREADY_SAVED', 'Biller already saved');
    throw e;
  }
  const dto = await savedBillerDto(saved);
  if (!dto) throw new ApiError(500, 'INTERNAL', 'Biller missing after lookup');
  return ok(res, dto, 201);
}

export async function deleteSavedBiller(req: Request, res: Response) {
  const { id } = req.params;
  if (!id || !mongoose.isValidObjectId(id)) throw new ApiError(404, 'NOT_FOUND', 'Saved biller not found');
  const deleted = await SavedBiller.findOneAndDelete({ _id: id, userId: req.userId });
  if (!deleted) throw new ApiError(404, 'NOT_FOUND', 'Saved biller not found');
  return ok(res, { deleted: true });
}
