import { Schema, model } from 'mongoose';

const statementSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  year: { type: Number, required: true },
  month: Number,
  totalInPaisa: { type: Number, required: true },
  totalOutPaisa: { type: Number, required: true },
  byCategory: [{ category: String, totalPaisa: Number, count: Number }],
  txnCount: { type: Number, required: true },
}, { timestamps: true });

statementSchema.index({ userId: 1, year: 1, month: 1 }, { unique: true });

export const Statement = model('Statement', statementSchema);
