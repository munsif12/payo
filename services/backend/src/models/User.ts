import { Schema, model } from 'mongoose';

export const DEFAULT_CEILING_PAISA = 10_000_000; // ₨1,00,000

const userSchema = new Schema({
  name: { type: String, required: true },
  urduName: String,
  email: { type: String, lowercase: true, trim: true, index: { unique: true, sparse: true } },
  phone: { type: String, required: true, unique: true },
  pinHash: String,
  pinSet: { type: Boolean, required: true, default: false },
  pinAttempts: { type: Number, required: true, default: 0 },
  pinLockedUntil: Date,
  avatar: String,
  language: { type: String, enum: ['ur', 'en'], default: 'en' },

  // The one nominated trusted contact. Denormalised phone/name so an approvals list or a
  // guardian card never needs a second read just to render who it is.
  guardian: {
    type: new Schema({
      userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
      phone: { type: String, required: true },
      name: { type: String, required: true },
      ceilingPaisa: { type: Number, required: true, default: DEFAULT_CEILING_PAISA, min: 0, validate: Number.isInteger },
      since: { type: Date, required: true, default: Date.now },
    }, { _id: false }),
    default: undefined,
  },
  // A scheduled LOOSENING (remove / replace / raise). Applied lazily on read — no cron.
  // `userId`/`phone`/`name` carry the incoming guardian for a 'replace'.
  guardianPending: {
    type: new Schema({
      change: { type: String, required: true, enum: ['remove', 'replace', 'raise'] },
      ceilingPaisa: { type: Number, min: 0, validate: Number.isInteger },
      userId: { type: Schema.Types.ObjectId, ref: 'User' },
      phone: String,
      name: String,
      effectiveAt: { type: Date, required: true },
    }, { _id: false }),
    default: undefined,
  },
  preferences: {
    type: new Schema({
      proactiveGreeting: { type: Boolean, required: true, default: true },
    }, { _id: false }),
    required: true,
    default: () => ({ proactiveGreeting: true }),
  },
  lastDigestAt: Date,
}, { timestamps: true });

export const User = model('User', userSchema);
