import { Schema, model } from 'mongoose';

const billSchema = new Schema({
  billerId: { type: Schema.Types.ObjectId, ref: 'Biller', required: true },
  consumerNo: { type: String, required: true },
  consumerName: { type: String, required: true },
  amountPaisa: { type: Number, required: true, min: 1, validate: Number.isInteger },
  dueDate: { type: Date, required: true },
  month: { type: String, required: true },
  status: { type: String, required: true, default: 'due', enum: ['due', 'paid'] },
}, { timestamps: true });

billSchema.index({ billerId: 1, consumerNo: 1 });

export const Bill = model('Bill', billSchema);
