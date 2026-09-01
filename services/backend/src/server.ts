import mongoose from 'mongoose';
import { createApp } from './app';
import { config } from './config';

async function main() {
  await mongoose.connect(config.mongoUri);
  createApp().listen(config.port, () => console.log(`payo-backend on :${config.port}`));
}
main().catch((e) => { console.error(e); process.exit(1); });
