import { Schema, model } from 'mongoose';
import { logoUrlFor } from '../lib/logos';

const billerSchema = new Schema({
  name: { type: String, required: true },
  urduName: { type: String, required: true },
  category: { type: String, required: true, enum: ['electricity', 'gas', 'internet', 'water', 'mobile'] },
  domain: { type: String, required: true },
});

// DTO convenience only — controllers build response shapes by hand rather than relying
// on document serialization, so this virtual exists for callers that want it off the doc.
billerSchema.virtual('logoUrl').get(function (this: { domain: string }) {
  return logoUrlFor(this.domain);
});

export const Biller = model('Biller', billerSchema);
