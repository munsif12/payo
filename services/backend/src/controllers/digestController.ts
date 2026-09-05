import { Request, Response } from 'express';
import { z } from 'zod';
import { Bill, Biller, GuardianNotice, MoneyRequest, PendingAction, SavedBiller, Transaction, User } from '../models';
import { ApiError } from '../lib/apiError';
import { ok } from '../lib/respond';
import { ensureDueBill } from './billsController';
import { summarizeTransactions } from './transactionsController';
import { wardsOf } from '../lib/guardian';

const DEFAULT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const ANOMALY_RATIO = 1.5;
const ANOMALY_MONTHS = 3;

async function receivedItems(userId: string, since: Date) {
  const txns = await Transaction.find({ userId, direction: 'in', createdAt: { $gt: since } })
    .sort({ createdAt: -1 });
  return txns.map(t => ({
    kind: 'received' as const, transactionId: String(t._id), amountPaisa: t.amountPaisa,
    from: { name: t.counterparty!.name, urduName: t.counterparty!.urduName ?? undefined, detail: t.counterparty!.detail },
    createdAt: (t as unknown as { createdAt: Date }).createdAt.toISOString(),
  }));
}

/** Same refresh-then-read as GET /bills/due, so the digest never shows a stale bill list. */
async function billDueItems(userId: string) {
  const savedBillers = await SavedBiller.find({ userId });
  for (const sb of savedBillers) await ensureDueBill(userId, String(sb.billerId), sb.consumerNo);

  const bills = await Bill.find({ userId, status: 'due' }).sort({ dueDate: 1 });
  const billers = await Biller.find({ _id: { $in: bills.map(b => b.billerId) } });
  const billerMap = new Map(billers.map(b => [String(b._id), b]));
  return bills.map(b => ({
    kind: 'bill_due' as const, billId: String(b._id),
    biller: {
      id: String(b.billerId), name: billerMap.get(String(b.billerId))?.name ?? '?',
      urduName: billerMap.get(String(b.billerId))?.urduName ?? undefined,
    },
    consumerNo: b.consumerNo, amountPaisa: b.amountPaisa, dueDate: b.dueDate.toISOString(),
  }));
}

async function approvalItems(userId: string) {
  // Same authority rule as GET /approvals: whoever is the payer's guardian right now.
  const wards = await wardsOf(userId);
  if (!wards.length) return [];
  const actions = await PendingAction.find({
    userId: { $in: wards }, 'approval.status': 'waiting',
    status: 'pending', expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });
  const payers = await User.find({ _id: { $in: actions.map(a => a.userId) } });
  const payerMap = new Map(payers.map(u => [String(u._id), u]));
  return actions.map(a => ({
    kind: 'approval_waiting' as const, actionId: String(a._id),
    payer: { name: payerMap.get(String(a.userId))?.name ?? '?', phone: payerMap.get(String(a.userId))?.phone ?? '' },
    summary: a.summary, amountPaisa: a.amountPaisa, riskFlags: [...a.riskFlags],
    expiresAt: a.expiresAt.toISOString(),
  }));
}

async function requestItems(userId: string) {
  const requests = await MoneyRequest.find({ payerId: userId, status: 'pending' }).sort({ createdAt: -1 });
  const requesters = await User.find({ _id: { $in: requests.map(r => r.requesterId) } });
  const map = new Map(requesters.map(u => [String(u._id), u]));
  return requests.map(r => ({
    kind: 'request' as const, requestId: String(r._id),
    from: { name: map.get(String(r.requesterId))?.name ?? '?', phone: map.get(String(r.requesterId))?.phone ?? '' },
    amountPaisa: r.amountPaisa, note: r.note ?? undefined,
    createdAt: (r as unknown as { createdAt: Date }).createdAt.toISOString(),
  }));
}

/**
 * At most ONE anomaly: the out-category whose spend this month most exceeds 1.5x its
 * average over the previous three months. Built on `summarizeTransactions` so the digest
 * and the spending summary can never disagree about what a category total is.
 */
async function anomalyItem(userId: string) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const baselineStart = new Date(now.getFullYear(), now.getMonth() - ANOMALY_MONTHS, 1);

  const [thisMonth, baseline] = await Promise.all([
    summarizeTransactions(userId, monthStart),
    summarizeTransactions(userId, baselineStart, monthStart, { toExclusive: true }),
  ]);
  const baselineByCategory = new Map(baseline.byCategory.map(c => [c.category, c.totalPaisa]));

  let best: { category: string; thisMonthPaisa: number; averagePaisa: number; ratio: number } | null = null;
  for (const c of thisMonth.byCategory) {
    const averagePaisa = Math.round((baselineByCategory.get(c.category) ?? 0) / ANOMALY_MONTHS);
    if (averagePaisa <= 0) continue; // no baseline = not an anomaly, just a first-ever spend
    const ratio = c.totalPaisa / averagePaisa;
    if (ratio > ANOMALY_RATIO && (!best || ratio > best.ratio))
      best = { category: c.category, thisMonthPaisa: c.totalPaisa, averagePaisa, ratio };
  }
  return best ? [{ kind: 'anomaly' as const, ...best }] : [];
}

async function guardianNoticeItems(userId: string, since: Date) {
  const notices = await GuardianNotice.find({ userId, createdAt: { $gt: since } }).sort({ createdAt: -1 });
  return notices.map(n => ({
    kind: 'guardian_notice' as const, noticeId: String(n._id), change: n.change,
    payer: { name: n.payerName, phone: n.payerPhone },
    ceilingPaisa: n.ceilingPaisa ?? undefined,
    actionId: n.actionId ? String(n.actionId) : undefined,
    effectiveAt: n.effectiveAt.toISOString(),
    createdAt: (n as unknown as { createdAt: Date }).createdAt.toISOString(),
  }));
}

/**
 * GET /me/digest — everything worth speaking first, since `lastDigestAt` (or the last 7 days
 * for a user who has never seen one). `?ack=1` stamps the cursor so the next open is quiet.
 * With `preferences.proactiveGreeting` off nothing financial is returned at all.
 */
export async function getDigest(req: Request, res: Response) {
  const { ack } = z.object({ ack: z.string().optional() }).parse(req.query);
  const user = await User.findById(req.userId);
  if (!user) throw new ApiError(404, 'NOT_FOUND', 'User not found');

  const since = user.lastDigestAt ?? new Date(Date.now() - DEFAULT_WINDOW_MS);
  // The cursor advances on an acknowledged open whatever the setting says: turning the
  // greeting back on must not replay a week of items the user has already lived through.
  const acked = ack === '1';
  if (acked) {
    user.lastDigestAt = new Date();
    await user.save();
  }
  if (!user.preferences.proactiveGreeting) return ok(res, { items: [], since: since.toISOString() });

  const [received, bills, approvals, requests, anomaly, notices] = await Promise.all([
    receivedItems(req.userId, since),
    billDueItems(req.userId),
    approvalItems(req.userId),
    requestItems(req.userId),
    anomalyItem(req.userId),
    guardianNoticeItems(req.userId, since),
  ]);

  // Approvals first: someone is waiting on this user to act.
  return ok(res, {
    items: [...approvals, ...received, ...bills, ...requests, ...anomaly, ...notices],
    since: since.toISOString(),
  });
}
