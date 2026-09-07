import { Request, Response } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { Statement, Transaction, User } from '../models';
import { ApiError } from '../lib/apiError';
import { ok } from '../lib/respond';
import { summarizeTransactions } from './transactionsController';
import { buildStatementPdf } from '../lib/statementPdf';

const UR_MONTHS = ['جنوری', 'فروری', 'مارچ', 'اپریل', 'مئی', 'جون', 'جولائی', 'اگست', 'ستمبر', 'اکتوبر', 'نومبر', 'دسمبر'];
const EN_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function periodRange(year: number, month?: number) {
  if (month) return { from: new Date(Date.UTC(year, month - 1, 1)), to: new Date(Date.UTC(year, month, 1)) };
  return { from: new Date(Date.UTC(year, 0, 1)), to: new Date(Date.UTC(year + 1, 0, 1)) };
}

export function periodLabel(year: number, month?: number) {
  if (month) return { en: `${EN_MONTHS[month - 1]} ${year}`, ur: `${UR_MONTHS[month - 1]} ${year}` };
  return { en: `Year ${year}`, ur: `سال ${year}` };
}

export async function generateStatement(req: Request, res: Response) {
  const { year, month } = z.object({
    year: z.number().int().min(2020).max(2100),
    month: z.number().int().min(1).max(12).optional(),
  }).parse(req.body);
  const { from, to } = periodRange(year, month);
  const summary = await summarizeTransactions(req.userId, from, new Date(to.getTime() - 1));
  if (summary.txnCount === 0) throw new ApiError(404, 'NO_ACTIVITY', 'No transactions in that period');

  const st = await Statement.findOneAndUpdate(
    { userId: req.userId, year, month: month ?? null },
    {
      totalInPaisa: summary.totalInPaisa, totalOutPaisa: summary.totalOutPaisa,
      byCategory: summary.byCategory, txnCount: summary.txnCount,
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  return ok(res, {
    statementId: String(st._id),
    summary: { period: periodLabel(year, month), ...summary },
  }, 201);
}

export async function listStatements(req: Request, res: Response) {
  const items = await Statement.find({ userId: req.userId }).sort({ createdAt: -1 });
  return ok(res, {
    items: items.map(s => ({
      id: String(s._id), year: s.year, month: s.month ?? undefined,
      totalInPaisa: s.totalInPaisa, totalOutPaisa: s.totalOutPaisa, txnCount: s.txnCount,
      createdAt: (s as unknown as { createdAt: Date }).createdAt.toISOString(),
    })),
  });
}

export async function statementPdf(req: Request, res: Response) {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) throw new ApiError(404, 'NOT_FOUND', 'Statement not found');
  const st = await Statement.findOne({ _id: id, userId: req.userId });
  if (!st) throw new ApiError(404, 'NOT_FOUND', 'Statement not found');
  const user = await User.findById(req.userId);
  const { from, to } = periodRange(st.year, st.month ?? undefined);
  const txns = await Transaction.find({
    userId: req.userId, createdAt: { $gte: from, $lt: to },
  }).sort({ createdAt: 1 });

  const statementRef = `STMT-${st.year}${st.month ? '-' + String(st.month).padStart(2, '0') : ''}-${String(st._id).slice(-6).toUpperCase()}`;

  const pdf = await buildStatementPdf({
    holderName: user?.name ?? 'PAYO user',
    phone: user?.phone ?? '',
    statementRef,
    periodLabel: periodLabel(st.year, st.month ?? undefined).en,
    summary: {
      totalInPaisa: st.totalInPaisa, totalOutPaisa: st.totalOutPaisa,
      byCategory: st.byCategory.map(c => ({ category: c.category!, totalPaisa: c.totalPaisa!, count: c.count! })),
      txnCount: st.txnCount,
    },
    transactions: txns.map(t => ({
      createdAt: (t as unknown as { createdAt: Date }).createdAt, type: t.type, direction: t.direction as 'in' | 'out',
      category: t.category, amountPaisa: t.amountPaisa, counterpartyName: t.counterparty!.name,
    })),
  });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="payo-statement-${st.year}${st.month ? '-' + String(st.month).padStart(2, '0') : ''}.pdf"`);
  res.send(pdf);
}
