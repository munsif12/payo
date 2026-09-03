import { Schema, model } from 'mongoose';

const savedBillerSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  nickname: { type: String, required: true },
  billerId: { type: Schema.Types.ObjectId, ref: 'Biller', required: true },
  consumerNo: { type: String, required: true },
  consumerName: { type: String, required: true },
}, { timestamps: true });

savedBillerSchema.index({ userId: 1, billerId: 1, consumerNo: 1 }, { unique: true });

export const SavedBiller = model('SavedBiller', savedBillerSchema);
