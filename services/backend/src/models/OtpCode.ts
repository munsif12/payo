import { Schema, model } from 'mongoose';

const otpCodeSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  code: { type: String, required: true },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

export const OtpCode = model('OtpCode', otpCodeSchema);
