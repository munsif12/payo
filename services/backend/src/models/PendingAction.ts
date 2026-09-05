import { Schema, model } from 'mongoose';

export const RISK_FLAGS = ['pressure_language', 'new_recipient_large'] as const;

const pendingActionSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  kind: { type: String, required: true },
  payload: { type: Schema.Types.Mixed, required: true },
  amountPaisa: { type: Number, required: true, min: 0, validate: Number.isInteger },
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
  cancelReason: String,
  resultTxnId: { type: Schema.Types.ObjectId, ref: 'Transaction' },
  expiresAt: { type: Date, required: true },

  // Guardian gate. Present only when the rule engine decided this send needs approval.
  approval: {
    type: new Schema({
      required: { type: Boolean, required: true, default: true },
      guardianId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
      status: { type: String, required: true, default: 'waiting', enum: ['waiting', 'approved', 'declined'] },
      decidedAt: Date,
      reason: String,
      remindedAt: Date,
    }, { _id: false }),
    default: undefined,
  },
  riskFlags: { type: [String], required: true, default: [], enum: RISK_FLAGS },
  checkIn: {
    type: new Schema({
      answered: { type: Boolean, required: true, default: true },
      someoneAsked: { type: Boolean, required: true },
    }, { _id: false }),
    default: undefined,
  },
}, { timestamps: true });

pendingActionSchema.index({ status: 1, expiresAt: 1 });
// The guardian's approvals inbox: waiting actions addressed to me, newest first.
pendingActionSchema.index({ 'approval.guardianId': 1, 'approval.status': 1, createdAt: -1 });

export const PendingAction = model('PendingAction', pendingActionSchema);
