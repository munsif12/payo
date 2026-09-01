import { Schema, model } from 'mongoose';

const contactSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true },
  urduName: String,
  kind: { type: String, required: true, enum: ['payo', 'bank'] },
  phone: String,
  bankId: { type: Schema.Types.ObjectId, ref: 'Bank' },
  iban: String,
  linkedUserId: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

export const Contact = model('Contact', contactSchema);
