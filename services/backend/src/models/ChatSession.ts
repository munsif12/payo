import { Schema, model } from 'mongoose';

const chatSessionSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, default: null },
}, { timestamps: true });

export const ChatSession = model('ChatSession', chatSessionSchema);
