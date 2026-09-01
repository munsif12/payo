import jwt from 'jsonwebtoken';
import { config } from '../config';
export const signToken = (u: { _id: unknown; email: string }) =>
  jwt.sign({ sub: String(u._id), email: u.email }, config.jwtSecret, { expiresIn: '30d' });
