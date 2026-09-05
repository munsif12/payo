import { Request, Response } from 'express';
import { z } from 'zod';
import { Institution } from '../models';
import { ok } from '../lib/respond';
import { escapeRegExp } from '../lib/fmt';
import { logoUrlFor } from '../lib/logos';

export async function listInstitutions(req: Request, res: Response) {
  const { q } = z.object({ q: z.string().optional() }).parse(req.query);
  const filter = q
    ? { $or: [{ name: new RegExp(escapeRegExp(q), 'i') }, { urduName: new RegExp(escapeRegExp(q), 'i') }, { code: new RegExp(escapeRegExp(q), 'i') }] }
    : {};
  const items = await Institution.find(filter).sort({ popular: -1, name: 1 });
  return ok(res, {
    items: items.map(i => ({
      id: String(i._id), name: i.name, urduName: i.urduName, kind: i.kind, code: i.code, popular: i.popular,
      domain: i.domain, logoUrl: logoUrlFor(i.domain),
    })),
  });
}
