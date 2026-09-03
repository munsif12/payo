import { Schema, model } from 'mongoose';

const recipientSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  nickname: { type: String, required: true },
  institutionId: { type: Schema.Types.ObjectId, ref: 'Institution', required: true },
  identifier: { type: String, required: true },
  title: { type: String, required: true },
  linkedUserId: { type: Schema.Types.ObjectId, ref: 'User' },
  lastUsedAt: { type: Date, required: true, default: Date.now },
}, { timestamps: true });

recipientSchema.index({ userId: 1, institutionId: 1, identifier: 1 }, { unique: true });

export const Recipient = model('Recipient', recipientSchema);
