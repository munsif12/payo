import { Schema, model } from 'mongoose';

const userSchema = new Schema({
  name: { type: String, required: true },
  urduName: String,
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, required: true, unique: true },
  pinHash: { type: String, required: true },
  avatar: String,
  language: { type: String, enum: ['ur', 'en'], default: 'ur' },
}, { timestamps: true });

export const User = model('User', userSchema);
