import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { DatabaseSync } from 'node:sqlite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(backendRoot, '.env'), quiet: true });

const args = process.argv.slice(2);
const has = (name) => args.includes(name);
const getArg = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const dryRun = has('--dry-run');
const skipBackup = has('--no-backup');
const replace = has('--replace');
const fromPath = getArg('--from', process.env.SQLITE_FILE || './data/badshah-customer.db');
const toUrl = getArg('--to', process.env.MONGODB_URI || '');
const toDb = getArg('--db', process.env.MONGODB_DB || 'badshah_custmer');
const sqlitePath = path.isAbsolute(fromPath) ? fromPath : path.join(backendRoot, fromPath);

const TABLES = ['admins', 'admin_sessions', 'categories', 'subcategories', 'products'];
const COLUMNS = {
  admins: ['id', 'username', 'password_hash', 'role', 'created_at'],
  admin_sessions: ['token_hash', 'admin_id', 'expires_at', 'created_at'],
  categories: ['id', 'name', 'slug', 'description', 'image_url', 'image_public_id', 'display_order', 'active', 'created_at', 'updated_at'],
  subcategories: ['id', 'category_id', 'name', 'slug', 'description', 'image_url', 'image_public_id', 'display_order', 'active', 'created_at', 'updated_at'],
  products: ['id', 'name', 'slug', 'brand', 'description', 'images', 'image_public_ids', 'price_paise', 'cost_paise', 'stock', 'unit', 'category_id', 'subcategory_id', 'active', 'star_priority', 'created_at', 'updated_at'],
};

function log(message) {
  console.log('[migrate] ' + message);
}

function redactUrl(url) {
  if (!url) return '';
  return url.replace(/:\/\/([^:@/\s]+):([^@/\s]+)@/, '://$1:***@');
}

function parseArray(value) {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeRow(table, row) {
  if (table === 'products') {
    return {
      ...row,
      images: parseArray(row.images),
      image_public_ids: parseArray(row.image_public_ids),
      brand: row.brand ?? '',
      description: row.description ?? '',
      unit: row.unit ?? '',
      stock: row.stock ?? 0,
      cost_paise: row.cost_paise ?? 0,
      subcategory_id: row.subcategory_id ?? null,
      star_priority: row.star_priority ?? 0,
      active: Boolean(row.active),
    };
  }
  if (table === 'categories' || table === 'subcategories') {
    return {
      ...row,
      description: row.description ?? '',
      image_url: row.image_url ?? null,
      image_public_id: row.image_public_id ?? null,
      display_order: row.display_order ?? 0,
      active: Boolean(row.active),
    };
  }
  if (table === 'admins') return { ...row, role: row.role ?? 'admin' };
  return row;
}

async function main() {
  if (!fs.existsSync(sqlitePath)) throw new Error('SQLite source not found: ' + sqlitePath);
  if (!toUrl && !dryRun) throw new Error('Target MONGODB_URI is required (set env MONGODB_URI or pass --to).');

  log('Source SQLite: ' + sqlitePath);
  log('Target MongoDB: ' + (dryRun ? '(dry-run, not connected)' : `${redactUrl(toUrl)}/${toDb}`));

  if (!skipBackup) {
    const backupsDir = path.join(backendRoot, 'data', 'backups');
    fs.mkdirSync(backupsDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupsDir, 'sqlite-pre-mongo-' + stamp + '.db');
    fs.copyFileSync(sqlitePath, backupPath);
    log('SQLite backup created: ' + backupPath);
  } else {
    log('Backup skipped (--no-backup).');
  }

  const sqlite = new DatabaseSync(sqlitePath);
  const data = {};
  for (const table of TABLES) {
    const columns = COLUMNS[table].join(', ');
    let rows = [];
    try {
      rows = sqlite.prepare('SELECT ' + columns + ' FROM ' + table).all();
    } catch {
      const available = new Set(sqlite.prepare(`PRAGMA table_info(${table})`).all().map((column) => column.name));
      const safeColumns = COLUMNS[table].filter((column) => available.has(column));
      rows = sqlite.prepare('SELECT ' + safeColumns.join(', ') + ' FROM ' + table).all();
    }
    data[table] = rows.map((row) => normalizeRow(table, row));
    log('Read ' + data[table].length + ' rows from ' + table);
  }
  sqlite.close();

  if (dryRun) {
    log('Dry run complete. No data written to MongoDB.');
    return;
  }

  process.env.DB_DRIVER = 'mongo';
  process.env.MONGODB_URI = toUrl;
  process.env.MONGODB_DB = toDb;
  const { initMongo, getCollection, closeMongo } = await import('../src/db/mongo.js');
  await initMongo();
  try {
    for (const table of TABLES) {
      const collection = getCollection(table);
      if (replace) {
        const cleared = await collection.deleteMany({});
        log('Cleared ' + cleared.deletedCount + ' documents from ' + table);
      }
      const operations = data[table].map((doc) => ({
        replaceOne: {
          filter: table === 'admin_sessions' ? { token_hash: doc.token_hash } : { id: doc.id },
          replacement: doc,
          upsert: true,
        },
      }));
      if (!operations.length) continue;
      await collection.bulkWrite(operations, { ordered: false });
      const total = await collection.countDocuments();
      log('Upserted ' + operations.length + ' documents into ' + table + ' (total ' + total + ')');
    }
  } finally {
    await closeMongo();
  }
}

main()
  .then(() => log('Migration complete.'))
  .catch((error) => {
    console.error('[migrate] failed:', error?.message || error);
    process.exitCode = 1;
  });
