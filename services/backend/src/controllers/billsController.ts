import { Request, Response } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { Bill, Biller } from '../models';
import { ApiError } from '../lib/apiError';
import { ok } from '../lib/respond';
import { createPendingAction, toActionDto } from '../lib/pendingActions';
import { djb2, resolveFakeTitle } from '../lib/fakeTitles';
import { fmtRs } from '../lib/fmt';

export async function listBillers(_req: Request, res: Response) {
  const items = await Biller.find().sort({ name: 1 });
  return ok(res, { items: items.map(b => ({ id: String(b._id), name: b.name, urduName: b.urduName, category: b.category })) });
}

/** GET /bills/due — the caller's own due bills (bill.userId, stamped on lookup and by seed). */
export async function listDueBills(req: Request, res: Response) {
  const bills = await Bill.find({ userId: req.userId, status: 'due' }).sort({ dueDate: 1 });
  const billers = await Biller.find({ _id: { $in: bills.map(b => b.billerId) } });
  const billerMap = new Map(billers.map(b => [String(b._id), b]));
  return ok(res, {
    items: bills.map((b) => {
      const biller = billerMap.get(String(b.billerId));
      if (!biller) throw new ApiError(404, 'NOT_FOUND', 'Biller not found');
      return {
        billId: String(b._id),
        biller: { id: String(biller._id), name: biller.name, urduName: biller.urduName, category: biller.category },
        consumerNo: b.consumerNo, amountPaisa: b.amountPaisa,
        dueDate: b.dueDate.toISOString(), month: b.month,
      };
    }),
  });
}

export async function lookupBill(req: Request, res: Response) {
  const { billerId, consumerNo } = z.object({
    billerId: z.string(),
    consumerNo: z.string().regex(/^\d{10,14}$/, 'Consumer number must be 10-14 digits'),
  }).parse(req.body);
  const biller = await Biller.findById(billerId).catch(() => null);
  if (!biller) throw new ApiError(404, 'NOT_FOUND', 'Biller not found');

  let bill = await Bill.findOne({ userId: req.userId, billerId: biller._id, consumerNo, status: 'due' });
  if (!bill) {
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const month = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
    // Deterministic on consumerNo alone so every user looking up the same consumer number
    // sees the same amount/name — but each user gets their OWN bill document (never
    // shares or re-stamps another user's bill).
    const amountPaisa = Math.round((150000 + (djb2(consumerNo) % 700000)) / 1000) * 1000;
    bill = await Bill.create({
      billerId: biller._id, consumerNo,
      consumerName: resolveFakeTitle(consumerNo),
      amountPaisa, month,
      dueDate: new Date(now.getFullYear(), now.getMonth(), 10),
      userId: req.userId,
    });
  }
  return ok(res, {
    billId: String(bill._id), consumerName: bill.consumerName,
    amountPaisa: bill.amountPaisa, dueDate: bill.dueDate.toISOString(), month: bill.month,
  });
}

export async function payBill(req: Request, res: Response) {
  const { billId } = z.object({ billId: z.string() }).parse(req.body);
  if (!mongoose.isValidObjectId(billId)) throw new ApiError(404, 'NOT_FOUND', 'Bill not found');
  const bill = await Bill.findById(billId);
  if (!bill) throw new ApiError(404, 'NOT_FOUND', 'Bill not found');
  if (bill.status === 'paid') throw new ApiError(410, 'ALREADY_PAID', 'Bill already paid');
  const biller = await Biller.findById(bill.billerId);
  if (!biller) throw new ApiError(404, 'NOT_FOUND', 'Biller not found');

  const action = await createPendingAction({
    userId: req.userId, kind: 'pay_bill', payload: { billId: String(bill._id) },
    amountPaisa: bill.amountPaisa, feePaisa: 0,
    summary: {
      en: `Pay ${biller.name} bill ${fmtRs(bill.amountPaisa)}`,
      ur: `${biller.urduName} کا بل ${fmtRs(bill.amountPaisa)} ادا کریں`,
    },
    lines: [
      { label: { en: 'Consumer', ur: 'صارف' }, value: bill.consumerName },
      { label: { en: 'Consumer No', ur: 'صارف نمبر' }, value: bill.consumerNo },
      { label: { en: 'Month', ur: 'مہینہ' }, value: bill.month },
      { label: { en: 'Due date', ur: 'آخری تاریخ' }, value: bill.dueDate.toISOString().slice(0, 10) },
    ],
  });
  return ok(res, toActionDto(action), 201);
}
