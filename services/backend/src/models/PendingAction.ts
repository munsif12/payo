import { Schema, model } from 'mongoose';

const pendingActionSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  kind: { type: String, required: true },
  payload: { type: Schema.Types.Mixed, required: true },
  amountPaisa: { type: Number, required: true, min: 1, validate: Number.isInteger },
  feePaisa: { type: Number, required: true, default: 0, min: 0, validate: Number.isInteger },
  summary: {
    en: { type: String, required: true },
    ur: { type: String, required: true },
  },
  lines: [{
    label: { en: String, ur: String },
    value: String,
  }],
  requiresPin: { type: Boolean, required: true, default: true },
  status: { type: String, required: true, default: 'pending', enum: ['pending', 'processing', 'completed', 'cancelled'] },
  resultTxnId: { type: Schema.Types.ObjectId, ref: 'Transaction' },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

pendingActionSchema.index({ status: 1, expiresAt: 1 });

export const PendingAction = model('PendingAction', pendingActionSchema);
