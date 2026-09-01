import { Request, Response } from 'express';
import { z } from 'zod';
import { Contact, Bank, User } from '../models';
import { ApiError } from '../lib/apiError';
import { ok } from '../lib/respond';

const IBAN_RE = /^PK\d{2}[A-Z]{4}\d{16}$/;

const createSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('payo'),
    name: z.string().min(1),
    urduName: z.string().optional(),
    phone: z.string().regex(/^\+92\d{10}$/),
  }),
  z.object({
    kind: z.literal('bank'),
    name: z.string().min(1),
    urduName: z.string().optional(),
    bankId: z.string(),
    iban: z.string().regex(IBAN_RE, 'Invalid IBAN'),
  }),
]);

type ContactDoc = InstanceType<typeof Contact>;

async function contactDto(c: ContactDoc) {
  const bank = c.bankId ? await Bank.findById(c.bankId) : null;
  return {
    id: String(c._id), name: c.name, urduName: c.urduName ?? undefined, kind: c.kind,
    phone: c.phone ?? undefined, bankId: c.bankId ? String(c.bankId) : undefined,
    bankName: bank?.name, iban: c.iban ?? undefined,
    linkedUserId: c.linkedUserId ? String(c.linkedUserId) : undefined,
  };
}

export async function listContacts(req: Request, res: Response) {
  const items = await Contact.find({ userId: req.userId }).sort({ createdAt: -1 });
  return ok(res, { items: await Promise.all(items.map(contactDto)) });
}

export async function createContact(req: Request, res: Response) {
  const body = createSchema.parse(req.body);
  if (body.kind === 'bank') {
    const bank = await Bank.findById(body.bankId);
    if (!bank) throw new ApiError(404, 'NOT_FOUND', 'Bank not found');
    const c = await Contact.create({ userId: req.userId, ...body });
    return ok(res, await contactDto(c), 201);
  }
  const linked = await User.findOne({ phone: body.phone });
  const c = await Contact.create({ userId: req.userId, ...body, linkedUserId: linked?._id });
  return ok(res, await contactDto(c), 201);
}
