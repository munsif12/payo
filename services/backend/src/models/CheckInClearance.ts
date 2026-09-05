import { Schema, model } from 'mongoose';

/**
 * "I already asked you about this person, and you said it was your own idea."
 *
 * One row per (user, institution, identifier), refreshed each time a check-in is answered
 * `someoneAsked: false`. Seniors get the scam question on a new recipient, and without this
 * they would get it again on every retry of the same send — which is exactly how a safety
 * prompt turns into a reflex tap. Its own collection rather than an array on User so the
 * upsert is a single atomic write and the row count cannot grow the user document.
 */
const checkInClearanceSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  institutionId: { type: String, required: true },
  identifier: { type: String, required: true },
  clearedAt: { type: Date, required: true },
}, { timestamps: true });

checkInClearanceSchema.index({ userId: 1, institutionId: 1, identifier: 1 }, { unique: true });

export const CheckInClearance = model('CheckInClearance', checkInClearanceSchema);
