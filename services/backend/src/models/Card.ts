import { Schema, model } from 'mongoose';

const cardSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  pan: { type: String, required: true },
  cvv: { type: String, required: true },
  expiry: { type: String, required: true },
  frozen: { type: Boolean, required: true, default: false },
}, { timestamps: true });

export const Card = model('Card', cardSchema);
