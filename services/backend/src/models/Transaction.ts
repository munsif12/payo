import { Schema, model } from 'mongoose';

const transactionSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  type: {
    type: String, required: true,
    enum: ['p2p', 'bank_transfer', 'bill', 'recharge', 'pocket_deposit', 'pocket_withdraw', 'request_settlement'],
  },
  direction: { type: String, required: true, enum: ['in', 'out'] },
  amountPaisa: { type: Number, required: true, min: 1, validate: Number.isInteger },
  feePaisa: { type: Number, required: true, default: 0, min: 0, validate: Number.isInteger },
  counterparty: {
    name: { type: String, required: true },
    urduName: String,
    detail: { type: String, required: true },
  },
  category: { type: String, required: true },
  status: { type: String, required: true, default: 'completed', enum: ['completed'] },
  refNo: { type: String, required: true, unique: true },
}, { timestamps: true });

transactionSchema.index({ userId: 1, createdAt: -1 });

export const Transaction = model('Transaction', transactionSchema);
