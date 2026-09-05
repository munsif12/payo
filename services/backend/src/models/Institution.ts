import { Schema, model } from 'mongoose';
import { logoUrlFor } from '../lib/logos';

const institutionSchema = new Schema({
  name: { type: String, required: true },
  urduName: { type: String, required: true },
  kind: { type: String, required: true, enum: ['wallet', 'bank'] },
  code: { type: String, required: true, unique: true },
  popular: { type: Boolean, required: true, default: false },
  domain: { type: String, required: true },
}, { timestamps: true });

institutionSchema.index({ name: 1 });

// DTO convenience only — controllers build response shapes by hand rather than relying
// on document serialization, so this virtual exists for callers that want it off the doc.
institutionSchema.virtual('logoUrl').get(function (this: { domain: string }) {
  return logoUrlFor(this.domain);
});

export const Institution = model('Institution', institutionSchema);
