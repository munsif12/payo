import { Schema, model } from 'mongoose';

const otpCodeSchema = new Schema({
  phone: { type: String, required: true, unique: true },
  code: { type: String, required: true },
  attempts: { type: Number, required: true, default: 0 },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

export const OtpCode = model('OtpCode', otpCodeSchema);
