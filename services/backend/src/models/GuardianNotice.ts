import { Schema, model } from 'mongoose';

/**
 * "Your protection is being loosened" — raised for the GUARDIAN when the person they
 * protect schedules a removal or a ceiling raise. Kept as its own small collection rather
 * than embedded on the guardian's User doc so the digest can window it by `createdAt`
 * (same `since` cursor as every other digest item) and so several notices can coexist.
 */
const guardianNoticeSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true }, // the guardian
  payerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  payerName: { type: String, required: true },
  payerPhone: { type: String, required: true },
  change: { type: String, required: true, enum: ['remove', 'replace', 'raise', 'reminder'] },
  ceilingPaisa: { type: Number, min: 0, validate: Number.isInteger },
  // Set on a 'reminder' — the action the payer is nudging the guardian about.
  actionId: { type: Schema.Types.ObjectId, ref: 'PendingAction' },
  effectiveAt: { type: Date, required: true },
}, { timestamps: true });

guardianNoticeSchema.index({ userId: 1, createdAt: -1 });

export const GuardianNotice = model('GuardianNotice', guardianNoticeSchema);
