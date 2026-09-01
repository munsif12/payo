import { Schema, model } from 'mongoose';

const bankSchema = new Schema({
  name: { type: String, required: true },
  urduName: { type: String, required: true },
});

export const Bank = model('Bank', bankSchema);
