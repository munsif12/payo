import request from 'supertest';
import type { Express } from 'express';

let n = 0;
export async function createVerifiedUser(app: Express, overrides: Record<string, string> = {}) {
  n += 1;
  const body = { name: `User${n}`, email: `u${n}@payo.demo`, phone: `+92300111${String(n).padStart(4, '0')}`, pin: '1234', ...overrides };
  const s = await request(app).post('/api/v1/auth/signup').send(body);
  const v = await request(app).post('/api/v1/auth/verify-otp').send({ userId: s.body.data.userId, otp: s.body.data.demoOtp });
  return { token: v.body.data.token as string, userId: s.body.data.userId as string, user: v.body.data.user };
}
