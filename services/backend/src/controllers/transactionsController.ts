import { Request, Response } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import { Transaction } from '../models';
import { ApiError } from '../lib/apiError';
import { ok } from '../lib/respond';
import { txnDto } from '../lib/pendingActions';

const listQuery = z.object({
  type: z.string().optional(),
  category: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  q: z.string().max(64).optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
  cursor: z.string().optional(),
});

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function decodeCursor(cursor: string): { createdAt: Date; id: string } | null {
  try {
    const [iso, id] = Buffer.from(cursor, 'base64').toString('utf8').split('|');
    if (!iso || !id) return null;
    const d = new Date(iso);
    if (isNaN(d.getTime()) || !Types.ObjectId.isValid(id)) return null;
    return { createdAt: d, id };
  } catch { return null; }
}

const encodeCursor = (createdAt: Date, id: string) =>
  Buffer.from(`${createdAt.toISOString()}|${id}`).toString('base64');

export async function listTransactions(req: Request, res: Response) {
  const q = listQuery.parse(req.query);
  const filter: Record<string, unknown> = { userId: req.userId };
  if (q.type) filter.type = q.type;
  if (q.category) filter.category = q.category;
  const range: Record<string, Date> = {};
  if (q.from) range.$gte = new Date(q.from);
  if (q.to) range.$lte = new Date(q.to);
  if (Object.keys(range).length) filter.createdAt = range;
  if (q.q) {
    const re = new RegExp(escapeRegex(q.q), 'i');
    filter.$or = [
      { 'counterparty.name': re },
      { 'counterparty.urduName': re },
      { 'counterparty.detail': re },
      { refNo: re },
    ];
  }

  const conditions: Record<string, unknown>[] = [filter];
  if (q.cursor) {
    const c = decodeCursor(q.cursor);
    if (c) {
      conditions.push({
        $or: [
          { createdAt: { $lt: c.createdAt } },
          { createdAt: c.createdAt, _id: { $lt: new Types.ObjectId(c.id) } },
        ],
      });
    }
  }

  const items = await Transaction.find(conditions.length > 1 ? { $and: conditions } : filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(q.limit + 1);

  const hasMore = items.length > q.limit;
  const page = hasMore ? items.slice(0, q.limit) : items;
  const last = page[page.length - 1];
  return ok(res, {
    items: page.map(txnDto),
    nextCursor: hasMore && last
      ? encodeCursor((last as unknown as { createdAt: Date }).createdAt, String(last._id))
      : null,
  });
}

export async function getTransaction(req: Request, res: Response) {
  const id = req.params.id;
  if (typeof id !== 'string' || !Types.ObjectId.isValid(id)) throw new ApiError(400, 'INVALID_ID', 'Invalid transaction id');
  const txn = await Transaction.findOne({ _id: id, userId: req.userId });
  if (!txn) throw new ApiError(404, 'NOT_FOUND', 'Transaction not found');
  return ok(res, txnDto(txn));
}

export interface SpendingSummary {
  totalOutPaisa: number;
  totalInPaisa: number;
  byCategory: { category: string; totalPaisa: number; count: number }[];
  txnCount: number;
}

export async function summarizeTransactions(userId: string, from?: Date, to?: Date): Promise<SpendingSummary> {
  const match: Record<string, unknown> = { userId: new Types.ObjectId(userId) };
  const range: Record<string, Date> = {};
  if (from) range.$gte = from;
  if (to) range.$lte = to;
  if (Object.keys(range).length) match.createdAt = range;

  const rows = await Transaction.aggregate([
    { $match: match },
    {
      $group: {
        _id: { direction: '$direction', category: '$category' },
        totalPaisa: { $sum: '$amountPaisa' },
        count: { $sum: 1 },
      },
    },
  ]);

  let totalOutPaisa = 0, totalInPaisa = 0, txnCount = 0;
  const byCategory: { category: string; totalPaisa: number; count: number }[] = [];
  for (const r of rows) {
    txnCount += r.count;
    if (r._id.direction === 'in') totalInPaisa += r.totalPaisa;
    else {
      totalOutPaisa += r.totalPaisa;
      byCategory.push({ category: r._id.category, totalPaisa: r.totalPaisa, count: r.count });
    }
  }
  byCategory.sort((a, b) => b.totalPaisa - a.totalPaisa);
  return { totalOutPaisa, totalInPaisa, byCategory, txnCount };
}

export async function spendingSummary(req: Request, res: Response) {
  const q = z.object({ from: z.string().optional(), to: z.string().optional() }).parse(req.query);
  const summary = await summarizeTransactions(
    req.userId,
    q.from ? new Date(q.from) : undefined,
    q.to ? new Date(q.to) : undefined,
  );
  return ok(res, { totalOutPaisa: summary.totalOutPaisa, totalInPaisa: summary.totalInPaisa, byCategory: summary.byCategory });
}
