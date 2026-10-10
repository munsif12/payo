import { Schema, model } from 'mongoose';

const recipientSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  nickname: { type: String, required: true },
  // v8: how the user says this person's name in Urdu (ابو, بلال). Seeded for the family;
  // a live save leaves it empty and the Urdu UI falls back to the linked user's Urdu name.
  urduNickname: { type: String },
  institutionId: { type: Schema.Types.ObjectId, ref: 'Institution', required: true },
  identifier: { type: String, required: true },
  title: { type: String, required: true },
  linkedUserId: { type: Schema.Types.ObjectId, ref: 'User' },
  lastUsedAt: { type: Date, required: true, default: Date.now },
}, { timestamps: true });

recipientSchema.index({ userId: 1, institutionId: 1, identifier: 1 }, { unique: true });

export const Recipient = model('Recipient', recipientSchema);
