import { Schema, model } from 'mongoose';

const userSchema = new Schema({
  name: { type: String, required: true },
  urduName: String,
  email: { type: String, lowercase: true, trim: true, index: { unique: true, sparse: true } },
  phone: { type: String, required: true, unique: true },
  pinHash: String,
  pinSet: { type: Boolean, required: true, default: false },
  pinAttempts: { type: Number, required: true, default: 0 },
  pinLockedUntil: Date,
  avatar: String,
  language: { type: String, enum: ['ur', 'en'], default: 'ur' },
}, { timestamps: true });

export const User = model('User', userSchema);
