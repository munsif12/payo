import { Request, Response } from 'express';
import { z } from 'zod';
import { User, Bank, Contact } from '../models';
import { ApiError } from '../lib/apiError';
import { ok } from '../lib/respond';
import { createPendingAction, toActionDto } from '../lib/pendingActions';
import { feeFor } from '../config/fees';
import { resolveFakeTitle } from '../lib/fakeTitles';
import { fmtRs } from '../lib/fmt';

const bodySchema = z.object({
  to: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('payo'), phone: z.string().regex(/^\+92\d{10}$/) }),
    z.object({ kind: z.literal('bank'), bankId: z.string(), iban: z.string().regex(/^PK\d{2}[A-Z]{4}\d{16}$/) }),
    z.object({ kind: z.literal('contact'), contactId: z.string() }),
  ]),
  amountPaisa: z.number().int().positive(),
  note: z.string().optional(),
});

const LINE_TO = { en: 'To', ur: 'وصول کنندہ' };
const LINE_AMOUNT = { en: 'Amount', ur: 'رقم' };
const LINE_FEE = { en: 'Fee', ur: 'فیس' };

async function payoPending(userId: string, phone: string, amountPaisa: number) {
  const recipient = await User.findOne({ phone });
  if (!recipient) throw new ApiError(404, 'RECIPIENT_NOT_FOUND', 'No PAYO user with that phone');
  if (String(recipient._id) === userId) throw new ApiError(400, 'SELF_TRANSFER', 'Cannot send money to yourself');
  return createPendingAction({
    userId, kind: 'send_money',
    payload: {
      recipientUserId: String(recipient._id), recipientName: recipient.name,
      recipientUrduName: recipient.urduName ?? undefined, phone: recipient.phone,
    },
    amountPaisa, feePaisa: feeFor('send_money'),
    summary: {
      en: `Send ${fmtRs(amountPaisa)} to ${recipient.name}`,
      ur: `${recipient.urduName ?? recipient.name} کو ${fmtRs(amountPaisa)} بھیجیں`,
    },
    lines: [
      { label: LINE_TO, value: `${recipient.name} · ${recipient.phone}` },
      { label: LINE_AMOUNT, value: fmtRs(amountPaisa) },
    ],
  });
}

async function bankPending(userId: string, bankId: string, iban: string, amountPaisa: number) {
  const bank = await Bank.findById(bankId).catch(() => null);
  if (!bank) throw new ApiError(404, 'NOT_FOUND', 'Bank not found');
  const accountTitle = resolveFakeTitle(iban);
  const feePaisa = feeFor('send_money_bank');
  return createPendingAction({
    userId, kind: 'send_money_bank',
    payload: { bankId: String(bank._id), bankName: bank.name, iban, accountTitle },
    amountPaisa, feePaisa,
    summary: {
      en: `Send ${fmtRs(amountPaisa)} to ${accountTitle}`,
      ur: `${accountTitle} کو ${fmtRs(amountPaisa)} بھیجیں`,
    },
    lines: [
      { label: LINE_TO, value: `${accountTitle} · ${bank.name} ****${iban.slice(-4)}` },
      { label: LINE_AMOUNT, value: fmtRs(amountPaisa) },
      { label: LINE_FEE, value: fmtRs(feePaisa) },
    ],
  });
}

export async function createTransfer(req: Request, res: Response) {
  const { to, amountPaisa } = bodySchema.parse(req.body);
  if (to.kind === 'payo') {
    const action = await payoPending(req.userId, to.phone, amountPaisa);
    return ok(res, toActionDto(action), 201);
  }
  if (to.kind === 'bank') {
    const action = await bankPending(req.userId, to.bankId, to.iban, amountPaisa);
    return ok(res, toActionDto(action), 201);
  }
  const contact = await Contact.findOne({ _id: to.contactId, userId: req.userId }).catch(() => null);
  if (!contact) throw new ApiError(404, 'NOT_FOUND', 'Contact not found');
  if (contact.kind === 'payo') {
    const action = await payoPending(req.userId, contact.phone!, amountPaisa);
    return ok(res, toActionDto(action), 201);
  }
  const action = await bankPending(req.userId, String(contact.bankId), contact.iban!, amountPaisa);
  return ok(res, toActionDto(action), 201);
}
