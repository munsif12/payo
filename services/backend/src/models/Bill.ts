import { Schema, model } from 'mongoose';

const billSchema = new Schema({
  billerId: { type: Schema.Types.ObjectId, ref: 'Biller', required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  consumerNo: { type: String, required: true },
  consumerName: { type: String, required: true },
  amountPaisa: { type: Number, required: true, min: 1, validate: Number.isInteger },
  dueDate: { type: Date, required: true },
  month: { type: String, required: true },
  status: { type: String, required: true, default: 'due', enum: ['due', 'paid'] },
}, { timestamps: true });

// Partial unique index: only ONE due bill per (user, biller, consumerNo) at a time —
// a paid bill doesn't block a later re-lookup creating a fresh due one. Also the
// concurrency guard: two racing ensureDueBill() calls both try to insert; one wins,
// the other gets a duplicate-key error and re-reads the winner's document.
billSchema.index(
  { userId: 1, billerId: 1, consumerNo: 1 },
  { unique: true, partialFilterExpression: { status: 'due' } },
);

export const Bill = model('Bill', billSchema);
