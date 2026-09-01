import { Schema, model } from 'mongoose';

const pocketSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true },
  urduName: String,
  emoji: { type: String, required: true },
  goalPaisa: { type: Number, min: 0, validate: Number.isInteger },
  balancePaisa: { type: Number, required: true, default: 0, min: 0, validate: Number.isInteger },
}, { timestamps: true });

export const Pocket = model('Pocket', pocketSchema);
