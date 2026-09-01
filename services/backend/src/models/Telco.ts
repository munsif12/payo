import { Schema, model } from 'mongoose';

const telcoSchema = new Schema({
  name: { type: String, required: true },
  urduName: { type: String, required: true },
});

export const Telco = model('Telco', telcoSchema);
