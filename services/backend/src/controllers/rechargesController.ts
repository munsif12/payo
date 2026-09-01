import { Request, Response } from 'express';
import { z } from 'zod';
import { Telco } from '../models';
import { ApiError } from '../lib/apiError';
import { ok } from '../lib/respond';
import { createPendingAction, toActionDto } from '../lib/pendingActions';
import { fmtRs } from '../lib/fmt';

export async function listTelcos(_req: Request, res: Response) {
  const items = await Telco.find().sort({ name: 1 });
  return ok(res, { items: items.map(t => ({ id: String(t._id), name: t.name, urduName: t.urduName })) });
}

export async function createRecharge(req: Request, res: Response) {
  const { telcoId, phone, amountPaisa } = z.object({
    telcoId: z.string(),
    phone: z.string().regex(/^\+92\d{10}$/),
    amountPaisa: z.number().int().min(5000, 'Minimum recharge is Rs 50').max(500000, 'Maximum recharge is Rs 5,000'),
  }).parse(req.body);
  const telco = await Telco.findById(telcoId).catch(() => null);
  if (!telco) throw new ApiError(404, 'NOT_FOUND', 'Telco not found');

  const local = '0' + phone.slice(3);
  const action = await createPendingAction({
    userId: req.userId, kind: 'recharge',
    payload: { telcoId: String(telco._id), telcoName: telco.name, telcoUrduName: telco.urduName, phone },
    amountPaisa, feePaisa: 0,
    summary: {
      en: `Recharge ${fmtRs(amountPaisa)} on ${telco.name} ${local}`,
      ur: `${telco.urduName} ${local} پر ${fmtRs(amountPaisa)} لوڈ کریں`,
    },
    lines: [
      { label: { en: 'Number', ur: 'نمبر' }, value: local },
      { label: { en: 'Network', ur: 'نیٹ ورک' }, value: telco.name },
      { label: { en: 'Amount', ur: 'رقم' }, value: fmtRs(amountPaisa) },
    ],
  });
  return ok(res, toActionDto(action), 201);
}
