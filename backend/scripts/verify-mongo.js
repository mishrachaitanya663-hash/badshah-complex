import crypto from 'node:crypto';
import { config } from '../src/config.js';
import { initDb, closeCurrentDb } from '../src/db/index.js';
import { getDb } from '../src/db/mongo.js';

function authSummary() {
  const match = config.mongoUri.match(/^mongodb(?:\+srv)?:\/\/([^@]+)@/);
  const username = (match?.[1] || '').split(':')[0] || '(none)';
  const sourceMatch = config.mongoUri.match(/[?&]authSource=([^&]+)/);
  return {
    username,
    authSource: sourceMatch ? decodeURIComponent(sourceMatch[1]) : 'admin',
    passwordSet: Boolean(match?.[1]?.includes(':')),
  };
}

const report = {
  database: config.mongoDb,
  authentication: authSummary(),
  connection: 'pending',
  ping: false,
  collectionCounts: {},
  tempCrud: {},
};

let tempCollection;
try {
  await initDb();
  const db = getDb();
  report.connection = 'connected';
  report.ping = (await db.command({ ping: 1 }))?.ok === 1;

  for (const name of ['admins', 'admin_sessions', 'categories', 'subcategories', 'products']) {
    report.collectionCounts[name] = await db.collection(name).countDocuments();
  }

  const name = `__badshah_verify_${crypto.randomBytes(4).toString('hex')}__`;
  tempCollection = db.collection(name);
  await tempCollection.insertOne({ _id: 'verify', value: 'before', createdAt: new Date() });
  report.tempCrud.insert = (await tempCollection.findOne({ _id: 'verify' }))?.value === 'before';
  await tempCollection.updateOne({ _id: 'verify' }, { $set: { value: 'after' } });
  report.tempCrud.update = (await tempCollection.findOne({ _id: 'verify' }))?.value === 'after';
  report.tempCrud.read = (await tempCollection.find({}).toArray()).length === 1;
  await tempCollection.deleteOne({ _id: 'verify' });
  report.tempCrud.delete = (await tempCollection.countDocuments()) === 0;
  await tempCollection.drop();
  report.tempCrud.cleanup = true;
} catch (error) {
  report.connection = 'failed';
  report.error = error?.message || String(error);
} finally {
  if (report.connection === 'failed' && tempCollection) {
    try {
      await tempCollection.drop();
      report.tempCrud.cleanup = true;
    } catch {
      report.tempCrud.cleanup = false;
    }
  }
  await closeCurrentDb();
}

console.log(JSON.stringify(report, null, 2));
if (report.connection !== 'connected') process.exitCode = 1;
