import { Schema, model } from 'mongoose';

const moneyRequestSchema = new Schema({
  requesterId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  payerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  amountPaisa: { type: Number, required: true, min: 1, validate: Number.isInteger },
  note: String,
  status: { type: String, required: true, default: 'pending', enum: ['pending', 'approved', 'declined'] },
}, { timestamps: true });

export const MoneyRequest = model('MoneyRequest', moneyRequestSchema);
