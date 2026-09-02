import request from 'supertest';
import type { Express } from 'express';

let n = 0;
export async function createVerifiedUser(app: Express, overrides: Record<string, string> = {}) {
  n += 1;
  const phone = overrides.phone ?? `+92300111${String(n).padStart(4, '0')}`;
  const pin = overrides.pin ?? '1234';

  const r = await request(app).post('/api/v1/auth/request-otp').send({ phone });
  const v = await request(app).post('/api/v1/auth/verify-otp').send({ phone, otp: r.body.data.demoOtp });
  const sp = await request(app).post('/api/v1/auth/set-pin')
    .set('Authorization', `Bearer ${v.body.data.otpToken}`).send({ pin });

  return { token: sp.body.data.token as string, userId: sp.body.data.user.id as string, user: sp.body.data.user };
}
