import { Schema, model } from 'mongoose';

const billerSchema = new Schema({
  name: { type: String, required: true },
  urduName: { type: String, required: true },
  category: { type: String, required: true, enum: ['electricity', 'gas', 'internet', 'water', 'mobile'] },
});

export const Biller = model('Biller', billerSchema);
