import { Request, Response } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { ChatSession, ChatMessage } from '../models';
import { ApiError } from '../lib/apiError';
import { ok } from '../lib/respond';

type SessionDoc = InstanceType<typeof ChatSession>;
type MessageDoc = InstanceType<typeof ChatMessage>;

const sessionDto = (s: SessionDoc) => ({
  id: String(s._id), title: s.title ?? null,
  createdAt: (s as unknown as { createdAt: Date }).createdAt.toISOString(),
});
const messageDto = (m: MessageDoc) => ({
  id: String(m._id), role: m.role, text: m.text, cards: m.cards ?? [],
  createdAt: (m as unknown as { createdAt: Date }).createdAt.toISOString(),
});

export async function createSession(req: Request, res: Response) {
  const s = await ChatSession.create({ userId: req.userId });
  return ok(res, sessionDto(s), 201);
}

export async function listSessions(req: Request, res: Response) {
  const items = await ChatSession.find({ userId: req.userId }).sort({ createdAt: -1 });
  return ok(res, { items: items.map(sessionDto) });
}

async function findOwnSession(userId: string, id: string) {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(404, 'NOT_FOUND', 'Session not found');
  const s = await ChatSession.findOne({ _id: id, userId });
  if (!s) throw new ApiError(404, 'NOT_FOUND', 'Session not found');
  return s;
}

export async function listMessages(req: Request, res: Response) {
  const s = await findOwnSession(req.userId, req.params.id);
  const items = await ChatMessage.find({ sessionId: s._id }).sort({ createdAt: 1, _id: 1 });
  return ok(res, { items: items.map(messageDto) });
}

export async function createMessage(req: Request, res: Response) {
  const { role, text, cards } = z.object({
    role: z.enum(['user', 'assistant']),
    text: z.string().min(1),
    cards: z.array(z.unknown()).optional(),
  }).parse(req.body);
  const s = await findOwnSession(req.userId, req.params.id);
  const m = await ChatMessage.create({ sessionId: s._id, userId: req.userId, role, text, cards });
  if (role === 'user' && !s.title) {
    s.title = text.slice(0, 40);
    await s.save();
  }
  return ok(res, messageDto(m), 201);
}
