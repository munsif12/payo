import { connectTestDb, clearDb, disconnectTestDb } from './db';
process.env.JWT_SECRET = 'test-secret';
beforeAll(connectTestDb, 120_000);
afterEach(clearDb);
afterAll(disconnectTestDb);
