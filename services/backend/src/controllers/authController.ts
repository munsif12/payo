import { Request, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { User, Account, Card, OtpCode } from '../models';
import { ApiError } from '../lib/apiError';
import { ok } from '../lib/respond';
import { signSession, signOtpToken } from '../lib/tokens';
import { assertPinOk } from '../lib/pinAuth';

const pinSchema = z.string().regex(/^\d{4}$/, 'PIN must be 4 digits');
const phoneSchema = z.string().regex(/^\+92\d{10}$/, 'Phone must be +92XXXXXXXXXX');

const WELCOME_BALANCE_PAISA = 1_000_000; // ₨10,000
const OTP_EXPIRY_MS = 5 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

const randomDigits = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join('');

export function publicUser(u: InstanceType<typeof User>) {
  return {
    id: String(u._id), name: u.name, urduName: u.urduName ?? undefined,
    email: u.email ?? undefined, phone: u.phone, avatar: u.avatar ?? undefined,
    language: u.language, pinSet: u.pinSet,
  };
}

/** POST /auth/request-otp — find-or-create the user (unknown phone = new account, welcome
 * balance + card, all in one transaction), then (re)issue a fresh demo OTP for the phone. */
export async function requestOtp(req: Request, res: Response) {
  const { phone } = z.object({ phone: phoneSchema }).parse(req.body);

  const isNewUser = !(await User.findOne({ phone }));
  if (isNewUser) {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const [created] = await User.create([{ name: 'PAYO user', phone, pinSet: false }], { session });
        if (!created) throw new Error('User.create returned no document');
        await Account.create([{ userId: created._id, balancePaisa: WELCOME_BALANCE_PAISA }], { session });
        const rest = randomDigits(10);
        const pan = `4111 11${rest.slice(0, 2)} ${rest.slice(2, 6)} ${rest.slice(6, 10)}`;
        await Card.create([{ userId: created._id, pan, cvv: randomDigits(3), expiry: '09/29' }], { session });
      });
    } catch (e: unknown) {
      // Lost the create race to a concurrent request-otp for the same (until-now unknown)
      // phone — the unique index on User.phone rejects the loser. The winner already
      // created the user + account + card, so just fall through instead of 500ing.
      const isDupKey = typeof e === 'object' && e !== null && (e as { code?: number }).code === 11000;
      if (!isDupKey) throw e;
    } finally {
      await session.endSession();
    }
  }

  const code = randomDigits(6);
  await OtpCode.findOneAndUpdate(
    { phone },
    { $set: { code, attempts: 0, expiresAt: new Date(Date.now() + OTP_EXPIRY_MS) } },
    { upsert: true },
  );
  return ok(res, { demoOtp: code, isNewUser }, 201);
}

/** POST /auth/verify-otp — 5-minute expiry, max 5 wrong attempts before a lockout. On success
 * the code is consumed and a short-lived otp-scope token is issued for set-pin/verify-pin. */
export async function verifyOtp(req: Request, res: Response) {
  const { phone, otp } = z.object({ phone: phoneSchema, otp: z.string() }).parse(req.body);

  const record = await OtpCode.findOne({ phone });
  if (!record || record.expiresAt < new Date()) throw new ApiError(400, 'INVALID_OTP', 'Wrong or expired OTP');
  if (record.attempts >= MAX_OTP_ATTEMPTS)
    throw new ApiError(429, 'OTP_LOCKED', 'Too many wrong attempts — request a new code');

  if (record.code !== otp) {
    record.attempts += 1;
    await record.save();
    if (record.attempts >= MAX_OTP_ATTEMPTS)
      throw new ApiError(429, 'OTP_LOCKED', 'Too many wrong attempts — request a new code');
    throw new ApiError(400, 'INVALID_OTP', 'Wrong or expired OTP');
  }

  await OtpCode.deleteOne({ _id: record._id });
  const user = await User.findOne({ phone });
  if (!user) throw new ApiError(404, 'NOT_FOUND', 'User not found');
  return ok(res, { otpToken: signOtpToken(user), isNewUser: !user.pinSet, pinSet: user.pinSet });
}

/** POST /auth/set-pin — otp-scope only, first-time PIN creation. */
export async function setPin(req: Request, res: Response) {
  if (req.tokenScope !== 'otp') throw new ApiError(401, 'OTP_SCOPE', 'Use the OTP token');
  const { pin } = z.object({ pin: pinSchema }).parse(req.body);
  const user = await User.findById(req.userId);
  if (!user) throw new ApiError(404, 'NOT_FOUND', 'User not found');
  if (user.pinSet) throw new ApiError(409, 'PIN_ALREADY_SET', 'PIN already set');

  user.pinHash = await bcrypt.hash(pin, 10);
  user.pinSet = true;
  await user.save();
  return ok(res, { token: signSession(user), user: publicUser(user) });
}

/** POST /auth/verify-pin — with an otp-scope token this completes login (returns a full
 * session); with a session token it's the existing in-app PIN re-check ({ valid: true }). */
export async function verifyPin(req: Request, res: Response) {
  const { pin } = z.object({ pin: pinSchema }).parse(req.body);
  const user = await User.findById(req.userId);
  if (!user) throw new ApiError(401, 'INVALID_PIN', 'Wrong PIN');
  await assertPinOk(user, pin);

  if (req.tokenScope === 'otp') return ok(res, { token: signSession(user), user: publicUser(user) });
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
