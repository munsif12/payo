import { Request, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { User, Account, Card, OtpCode } from '../models';
import { ApiError } from '../lib/apiError';
import { ok } from '../lib/respond';
import { signToken } from '../lib/tokens';

const pinSchema = z.string().regex(/^\d{4}$/, 'PIN must be 4 digits');
const phoneSchema = z.string().regex(/^\+92\d{10}$/, 'Phone must be +92XXXXXXXXXX');

const signupSchema = z.object({
  name: z.string().min(1),
  urduName: z.string().optional(),
  email: z.string().email(),
  phone: phoneSchema,
  pin: pinSchema,
});

const WELCOME_BALANCE_PAISA = 1_000_000; // ₨10,000

const randomDigits = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join('');

export function publicUser(u: InstanceType<typeof User>) {
  return {
    id: String(u._id), name: u.name, urduName: u.urduName ?? undefined,
    email: u.email, phone: u.phone, avatar: u.avatar ?? undefined, language: u.language,
  };
}

export async function signup(req: Request, res: Response) {
  const body = signupSchema.parse(req.body);
  const pinHash = await bcrypt.hash(body.pin, 10);
  const code = randomDigits(6);
  const session = await mongoose.startSession();
  try {
    let userId = '';
    await session.withTransaction(async () => {
      const [user] = await User.create([{
        name: body.name, urduName: body.urduName, email: body.email, phone: body.phone, pinHash,
      }], { session });
      userId = String(user._id);
      await Account.create([{ userId: user._id, balancePaisa: WELCOME_BALANCE_PAISA }], { session });
      const rest = randomDigits(10);
      const pan = `4111 11${rest.slice(0, 2)} ${rest.slice(2, 6)} ${rest.slice(6, 10)}`;
      await Card.create([{ userId: user._id, pan, cvv: randomDigits(3), expiry: '09/29' }], { session });
      await OtpCode.create([{ userId: user._id, code, expiresAt: new Date(Date.now() + 5 * 60 * 1000) }], { session });
    });
    return ok(res, { userId, demoOtp: code }, 201);
  } catch (e: unknown) {
    if (typeof e === 'object' && e !== null && (e as { code?: number }).code === 11000)
      throw new ApiError(409, 'ALREADY_EXISTS', 'Email or phone already registered');
    throw e;
  } finally {
    await session.endSession();
  }
}

export async function verifyOtp(req: Request, res: Response) {
  const { userId, otp } = z.object({ userId: z.string(), otp: z.string() }).parse(req.body);
  const record = await OtpCode.findOne({ userId, code: otp, expiresAt: { $gt: new Date() } });
  if (!record) throw new ApiError(400, 'INVALID_OTP', 'Wrong or expired OTP');
  await OtpCode.deleteOne({ _id: record._id });
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, 'NOT_FOUND', 'User not found');
  return ok(res, { token: signToken(user), user: publicUser(user) });
}

export async function login(req: Request, res: Response) {
  const { email, pin } = z.object({ email: z.string().email(), pin: pinSchema }).parse(req.body);
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user || !(await bcrypt.compare(pin, user.pinHash)))
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Wrong email or PIN');
  return ok(res, { token: signToken(user), user: publicUser(user) });
}

export async function verifyPin(req: Request, res: Response) {
  const { pin } = z.object({ pin: pinSchema }).parse(req.body);
  const user = await User.findById(req.userId);
  if (!user || !(await bcrypt.compare(pin, user.pinHash)))
    throw new ApiError(401, 'INVALID_PIN', 'Wrong PIN');
  return ok(res, { valid: true });
}

export async function me(req: Request, res: Response) {
  const [user, account, card] = await Promise.all([
    User.findById(req.userId), Account.findOne({ userId: req.userId }), Card.findOne({ userId: req.userId }),
  ]);
  if (!user || !account || !card) throw new ApiError(404, 'NOT_FOUND', 'User not found');
  return ok(res, {
    user: publicUser(user),
    account: { id: String(account._id), balancePaisa: account.balancePaisa },
    card: { id: String(card._id), last4: card.pan.replace(/\s/g, '').slice(-4), frozen: card.frozen },
  });
}
