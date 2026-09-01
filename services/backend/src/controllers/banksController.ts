import { Request, Response } from 'express';
import { z } from 'zod';
import { Bank } from '../models';
import { ApiError } from '../lib/apiError';
import { ok } from '../lib/respond';
import { resolveFakeTitle } from '../lib/fakeTitles';

export async function listBanks(_req: Request, res: Response) {
  const items = await Bank.find().sort({ name: 1 });
  return ok(res, { items: items.map(b => ({ id: String(b._id), name: b.name, urduName: b.urduName })) });
}

export async function resolveTitle(req: Request, res: Response) {
  const { bankId, iban } = z.object({
    bankId: z.string(),
    iban: z.string().regex(/^PK\d{2}[A-Z]{4}\d{16}$/, 'Invalid IBAN'),
  }).parse(req.body);
  const bank = await Bank.findById(bankId).catch(() => null);
  if (!bank) throw new ApiError(404, 'NOT_FOUND', 'Bank not found');
  return ok(res, { accountTitle: resolveFakeTitle(iban) });
}
