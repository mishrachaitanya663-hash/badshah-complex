import dns from 'node:dns';
import { MongoClient } from 'mongodb';
import { config } from '../config.js';

if (!config.mongoUri.startsWith('mongodb+srv://')) dns.setDefaultResultOrder('ipv4first');

if (config.mongoUri.startsWith('mongodb+srv://')) {
  const servers = (process.env.MONGODB_DNS_SERVERS || '8.8.8.8,1.1.1.1')
    .split(',')
    .map((server) => server.trim())
    .filter(Boolean);
  if (servers.length) dns.setServers(servers);
}

let client;
let database;

const COLLECTIONS = ['admins', 'admin_sessions', 'categories', 'subcategories', 'products'];

function authLabel() {
  const match = config.mongoUri.match(/^mongodb(?:\+srv)?:\/\/([^@]+)@/);
  const username = (match?.[1] || '').split(':')[0] || '(none)';
  const authSourceMatch = config.mongoUri.match(/[?&]authSource=([^&]+)/);
  const authSource = authSourceMatch ? decodeURIComponent(authSourceMatch[1]) : 'admin';
  return `user "${username}" on authSource "${authSource}"`;
}

async function ensureIndexes(db) {
  await Promise.all([
    db.collection('admins').createIndex({ id: 1 }, { unique: true }),
    db.collection('admins').createIndex({ username: 1 }, { unique: true }),
    db.collection('admin_sessions').createIndex({ token_hash: 1 }, { unique: true }),
    db.collection('admin_sessions').createIndex({ expires_at: 1 }),
    db.collection('categories').createIndex({ id: 1 }, { unique: true }),
    db.collection('categories').createIndex({ slug: 1 }, { unique: true }),
    db.collection('categories').createIndex({ active: 1, display_order: 1 }),
    db.collection('subcategories').createIndex({ id: 1 }, { unique: true }),
    db.collection('subcategories').createIndex({ slug: 1 }, { unique: true }),
    db.collection('subcategories').createIndex({ name: 1 }, { unique: true }),
    db.collection('subcategories').createIndex({ category_id: 1, active: 1 }),
    db.collection('products').createIndex({ id: 1 }, { unique: true }),
    db.collection('products').createIndex({ slug: 1 }, { unique: true }),
    db.collection('products').createIndex({ category_id: 1, active: 1 }),
    db.collection('products').createIndex({ subcategory_id: 1, active: 1 }),
    db.collection('products').createIndex({ star_priority: -1, created_at: -1 }),
  ]);
}

export async function initMongo() {
  if (client && database) return database;
  if (!config.mongoUri) {
    throw new Error('MONGODB_URI is required when DB_DRIVER=mongo');
  }

  const clientOptions = {
    serverSelectionTimeoutMS: 15000,
    ...(config.mongoTlsServerName ? { servername: config.mongoTlsServerName } : {}),
  };
  client = new MongoClient(config.mongoUri, clientOptions);
  try {
    await client.connect();
    database = client.db(config.mongoDb);
    await database.command({ ping: 1 });
    await ensureIndexes(database);
  } catch (error) {
    await client.close();
    client = undefined;
    database = undefined;
    const message = error?.message || '';
    const authFailed = error?.code === 18 || error?.codeName === 'AuthenticationFailed' || /bad auth/i.test(message);
    const authzFailed = error?.code === 13 || error?.codeName === 'Unauthorized' || /not (allowed|authorized)/i.test(message);
    if (authFailed) {
      throw new Error(`MongoDB authentication failed for ${authLabel()}. Verify the Database Access password for this user in the Atlas project that hosts the cluster.`);
    }
    if (authzFailed) {
      throw new Error(`MongoDB user ${authLabel()} lacks privileges on database "${config.mongoDb}". Grant readWrite on that database.`);
    }
    throw error;
  }
  return database;
}

export function getDb() {
  if (!database) throw new Error('MongoDB has not been initialized. Call initDb() first.');
  return database;
}

export function getCollection(name) {
  if (!COLLECTIONS.includes(name)) throw new Error(`Unknown MongoDB collection "${name}"`);
  return getDb().collection(name);
}

export async function testMongoConnection() {
  const result = await getDb().command({ ping: 1 });
  return result?.ok === 1;
}

export async function closeMongo() {
  if (!client) return;
  const current = client;
  client = undefined;
  database = undefined;
  await current.close();
}
