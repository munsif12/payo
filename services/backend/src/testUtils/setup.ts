import { connectTestDb, clearDb, disconnectTestDb } from './db';
process.env.JWT_SECRET = 'test-secret';

beforeAll(async () => {
  await connectTestDb();
  // Register every model and build unique indexes before any test writes.
  const models = await import('../models');
  await Promise.all(Object.values(models).map((m) => m.syncIndexes()));
}, 120_000);
afterEach(clearDb);
afterAll(disconnectTestDb);
