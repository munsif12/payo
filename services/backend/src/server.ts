import mongoose from 'mongoose';
import { createApp } from './app';
import { config } from './config';
import './models'; // register every model's schema before syncIndexes below

async function main() {
  await mongoose.connect(config.mongoUri);
  // Drop/rebuild indexes that no longer match the schema (e.g. a stale plain-unique
  // index left behind by an old model version) so they don't silently reject valid
  // writes — for every registered model, not just User/Bill.
  await Promise.all(mongoose.modelNames().map((n) => mongoose.model(n).syncIndexes()));
  createApp().listen(config.port, () => console.log(`payo-backend on :${config.port}`));
}
main().catch((e) => { console.error(e); process.exit(1); });
