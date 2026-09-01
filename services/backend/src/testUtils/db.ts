import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let replSet: MongoMemoryReplSet;

export async function connectTestDb() {
  // Pin to Mongo 7 to match docker-compose (and avoid handshake breakage with newer mongod).
  // downloadDir is project-local because ~/.cache is not writable on this machine.
  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
    binary: { version: '7.0.14', downloadDir: `${__dirname}/../../node_modules/.cache/mongodb-binaries` },
  });
  await mongoose.connect(replSet.getUri('payo-test'));
}
export async function clearDb() {
  await Promise.all(Object.values(mongoose.connection.collections).map(c => c.deleteMany({})));
}
export async function disconnectTestDb() {
  await mongoose.disconnect();
  await replSet.stop();
}
