import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MongoMemoryServer } from 'mongodb-memory-server';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dbPath = path.join(backendRoot, 'data', 'mongo');
fs.mkdirSync(dbPath, { recursive: true });

const server = new MongoMemoryServer({
  instance: { port: 27017, dbPath, storageEngine: 'wiredTiger' },
  cleanup: { doCleanup: false },
});

async function shutdown() {
  try {
    await server.stop();
  } finally {
    process.exit(0);
  }
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

try {
  await server.start(true);
  console.log('[mongo] Local MongoDB ready at mongodb://127.0.0.1:27017');
  console.log('[mongo] Data is stored in ' + dbPath);
} catch (error) {
  console.error('[mongo] Failed to start local MongoDB:', error?.message || error);
  process.exit(1);
}
