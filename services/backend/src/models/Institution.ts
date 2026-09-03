import { Schema, model } from 'mongoose';

const institutionSchema = new Schema({
  name: { type: String, required: true },
  urduName: { type: String, required: true },
  kind: { type: String, required: true, enum: ['wallet', 'bank'] },
  code: { type: String, required: true, unique: true },
  popular: { type: Boolean, required: true, default: false },
}, { timestamps: true });

institutionSchema.index({ name: 1 });

export const Institution = model('Institution', institutionSchema);
