import mongoose from 'mongoose';

test('mongoose is connected to a replica-set memory server', async () => {
  expect(mongoose.connection.readyState).toBe(1);
  const session = await mongoose.startSession();           // throws if no replSet
  await session.withTransaction(async () => {});
  await session.endSession();
});
