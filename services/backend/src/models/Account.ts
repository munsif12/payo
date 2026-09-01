import { Schema, model } from 'mongoose';

const accountSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  balancePaisa: { type: Number, required: true, default: 0, min: 0, validate: Number.isInteger },
}, { timestamps: true });

export const Account = model('Account', accountSchema);
