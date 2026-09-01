import { Schema, model } from 'mongoose';

const chatMessageSchema = new Schema({
  sessionId: { type: Schema.Types.ObjectId, ref: 'ChatSession', required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  role: { type: String, required: true, enum: ['user', 'assistant'] },
  text: { type: String, required: true },
  cards: [Schema.Types.Mixed],
}, { timestamps: true });

export const ChatMessage = model('ChatMessage', chatMessageSchema);
