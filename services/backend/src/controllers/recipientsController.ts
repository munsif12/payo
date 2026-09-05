import { Request, Response } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { Recipient, Institution } from '../models';
import { ApiError } from '../lib/apiError';
import { ok } from '../lib/respond';
import { resolveRecipient } from '../lib/resolveRecipient';
import { escapeRegExp } from '../lib/fmt';
import { logoUrlFor } from '../lib/logos';

type RecipientDoc = InstanceType<typeof Recipient>;

// Returns null (never a partial shape) when the joined Institution is gone — e.g. seed
// data changed underneath an existing Recipient. Callers filter nulls out of list
// responses; createRecipient (where the institution was just validated) treats a null
// as an internal error instead.
async function recipientDto(r: RecipientDoc) {
  const institution = await Institution.findById(r.institutionId);
  if (!institution) return null;
  return {
    id: String(r._id), nickname: r.nickname,
    institution: {
      id: String(institution._id), name: institution.name, urduName: institution.urduName, kind: institution.kind,
      domain: institution.domain, logoUrl: logoUrlFor(institution.domain),
    },
    identifier: r.identifier, title: r.title,
    linkedUserId: r.linkedUserId ? String(r.linkedUserId) : undefined,
    lastUsedAt: r.lastUsedAt.toISOString(),
  };
}

export async function listRecipients(req: Request, res: Response) {
  const { q } = z.object({ q: z.string().optional() }).parse(req.query);
  const filter: Record<string, unknown> = { userId: req.userId };
  if (q) {
    const re = new RegExp(escapeRegExp(q), 'i');
    filter.$or = [{ nickname: re }, { title: re }, { identifier: re }];
  }
  const items = await Recipient.find(filter).sort({ lastUsedAt: -1 });
  const dtos = await Promise.all(items.map(recipientDto));
  return ok(res, { items: dtos.filter((d): d is NonNullable<typeof d> => d !== null) });
}

const createSchema = z.object({
  nickname: z.string().min(1),
  institutionId: z.string(),
  identifier: z.string().min(1),
});

export async function createRecipient(req: Request, res: Response) {
  const { nickname, institutionId, identifier } = createSchema.parse(req.body);
  const resolved = await resolveRecipient(institutionId, identifier, req.userId);
  let recipient: RecipientDoc;
  try {
    recipient = await Recipient.create({
      userId: req.userId, nickname, institutionId, identifier: resolved.identifier,
      title: resolved.title, linkedUserId: resolved.linkedUserId,
    });
  } catch (e) {
    if (e instanceof Error && 'code' in e && (e as { code?: number }).code === 11000)
      throw new ApiError(409, 'ALREADY_SAVED', 'Recipient already saved');
    throw e;
  }
  const dto = await recipientDto(recipient);
  if (!dto) throw new ApiError(500, 'INTERNAL', 'Institution missing after resolve');
  return ok(res, dto, 201);
}

export async function deleteRecipient(req: Request, res: Response) {
  const { id } = req.params;
  if (!id || !mongoose.isValidObjectId(id)) throw new ApiError(404, 'NOT_FOUND', 'Recipient not found');
  const deleted = await Recipient.findOneAndDelete({ _id: id, userId: req.userId });
  if (!deleted) throw new ApiError(404, 'NOT_FOUND', 'Recipient not found');
  return ok(res, { deleted: true });
}
