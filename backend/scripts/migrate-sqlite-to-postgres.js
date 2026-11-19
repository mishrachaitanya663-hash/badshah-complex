import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { DatabaseSync } from 'node:sqlite';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(backendRoot, '.env'), quiet: true });

const args = process.argv.slice(2);
const has = (name) => args.includes(name);
const getArg = (name, fallback) => {
  const idx = args.indexOf(name);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : fallback;
};

const dryRun = has('--dry-run');
const skipBackup = has('--no-backup');
const allowOverwrite = has('--allow-overwrite');
const fromPath = getArg('--from', process.env.SQLITE_FILE || './data/badshah-customer.db');
const toUrl = getArg('--to', process.env.DATABASE_URL || '');
const sqlitePath = path.isAbsolute(fromPath) ? fromPath : path.join(backendRoot, fromPath);

const TABLES = ['admins', 'admin_sessions', 'categories', 'subcategories', 'products'];
const COLUMNS = {
  admins: ['id', 'username', 'password_hash', 'role', 'created_at'],
  admin_sessions: ['token_hash', 'admin_id', 'expires_at', 'created_at'],
  categories: ['id', 'name', 'slug', 'description', 'image_url', 'image_public_id', 'display_order', 'active', 'created_at', 'updated_at'],
  subcategories: ['id', 'category_id', 'name', 'slug', 'description', 'image_url', 'image_public_id', 'display_order', 'active', 'created_at', 'updated_at'],
  products: ['id', 'name', 'slug', 'brand', 'description', 'images', 'image_public_ids', 'price_paise', 'cost_paise', 'stock', 'unit', 'category_id', 'subcategory_id', 'active', 'star_priority', 'created_at', 'updated_at'],
};

function log(msg) { console.log('[migrate] ' + msg); }
function redactUrl(url) {
  if (!url) return '';
  return url.replace(/:\/\/([^:@/\s]+):([^@/\s]+)@/, '://$1:***@');
}

function normalizeRow(table, row) {
  if (table === 'products') {
    return {
      ...row,
      images: row.images ?? '[]',
      image_public_ids: row.image_public_ids ?? '[]',
      brand: row.brand ?? '',
      description: row.description ?? '',
      unit: row.unit ?? '',
      stock: row.stock ?? 0,
      active: row.active ?? 1,
      star_priority: row.star_priority ?? 0,
      cost_paise: row.cost_paise ?? 0,
      subcategory_id: row.subcategory_id ?? null,
    };
  }
  if (table === 'categories' || table === 'subcategories') {
    return {
      ...row,
      description: row.description ?? '',
      image_url: row.image_url ?? null,
      image_public_id: row.image_public_id ?? null,
      display_order: row.display_order ?? 0,
      active: row.active ?? 1,
    };
  }
  if (table === 'admins') {
    return { ...row, role: row.role ?? 'admin' };
  }
  return row;
}

function splitStatements(sql) {
  return sql.split(/;\s*(?:\r?\n|$)/g).map((s) => s.trim()).filter(Boolean);
}

async function main() {
  if (!fs.existsSync(sqlitePath)) throw new Error('SQLite source not found: ' + sqlitePath);
  if (!toUrl && !dryRun) throw new Error('Target DATABASE_URL is required (set env DATABASE_URL or pass --to).');

  log('Source SQLite: ' + sqlitePath);
  log('Target Postgres: ' + (dryRun ? '(dry-run, not connected)' : redactUrl(toUrl)));

  let backupPath;
  if (!skipBackup) {
    const backupsDir = path.join(backendRoot, 'data', 'backups');
    fs.mkdirSync(backupsDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    backupPath = path.join(backupsDir, 'sqlite-pre-migration-' + stamp + '.db');
    fs.copyFileSync(sqlitePath, backupPath);
    log('SQLite backup created: ' + backupPath);
  } else {
    log('Backup skipped (--no-backup).');
  }

  const sqlite = new DatabaseSync(sqlitePath);
  const data = {};
  for (const table of TABLES) {
    const cols = COLUMNS[table].join(', ');
    let rows = [];
    try {
      rows = sqlite.prepare('SELECT ' + cols + ' FROM ' + table).all();
    } catch {
      const available = new Set(sqlite.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name));
      const safeCols = COLUMNS[table].filter((c) => available.has(c));
      rows = sqlite.prepare('SELECT ' + safeCols.join(', ') + ' FROM ' + table).all();
    }
    data[table] = rows.map((r) => normalizeRow(table, r));
    log('Read ' + data[table].length + ' rows from ' + table);
  }
  sqlite.close();

  if (dryRun) {
    log('Dry run complete. No data written to PostgreSQL.');
    return;
  }

  const { Pool } = pg;
  const pool = new Pool({ connectionString: toUrl, ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false } });
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
    const schemaPath = path.join(backendRoot, 'src/db/schema.postgres.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    for (const stmt of splitStatements(schemaSql)) await client.query(stmt);
    await client.query('ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_paise INTEGER NOT NULL DEFAULT 0 CHECK (cost_paise >= 0)');
    log('PostgreSQL schema ensured.');

    await client.query('BEGIN');

    const existing = {};
    for (const table of TABLES) {
      const res = await client.query('SELECT COUNT(*)::int AS c FROM ' + table);
      existing[table] = res.rows[0].c;
    }

    const tablesWithData = TABLES.filter((t) => existing[t] > 0);
    if (tablesWithData.length) {
      if (!allowOverwrite) {
        const summary = tablesWithData.map((t) => t + ':' + existing[t]).join(', ');
        throw new Error('Target tables are not empty (' + summary + '). Aborting to avoid overwrite. Re-run with --allow-overwrite only if intentional.');
      }
      log('--allow-overwrite set; truncating target tables: ' + tablesWithData.join(', '));
      await client.query('TRUNCATE TABLE products, subcategories, categories, admin_sessions, admins RESTART IDENTITY CASCADE');
    }

    for (const table of TABLES) {
      const rows = data[table];
      if (!rows.length) continue;
      const cols = COLUMNS[table];
      const colSql = cols.join(', ');
      const placeholders = cols.map((_, i) => '$' + (i + 1)).join(', ');
      const insertSql = 'INSERT INTO ' + table + ' (' + colSql + ') VALUES (' + placeholders + ') ON CONFLICT DO NOTHING';
      for (const row of rows) {
        const values = cols.map((c) => (row[c] === undefined ? null : row[c]));
        await client.query(insertSql, values);
      }
      log('Inserted ' + rows.length + ' rows into ' + table);
    }

    for (const table of TABLES) {
      const srcCount = data[table].length;
      const res = await client.query('SELECT COUNT(*)::int AS c FROM ' + table);
      const dstCount = res.rows[0].c;
      if (dstCount < srcCount) {
        throw new Error('Count mismatch after insert for ' + table + ': source=' + srcCount + ', target=' + dstCount);
      }
      log('Verified ' + table + ': source=' + srcCount + ', target=' + dstCount);
    }

    await client.query('COMMIT');
    log('Migration committed successfully.');
    if (backupPath) log('Backup retained at: ' + backupPath);
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('[migrate] FAILED: ' + (error && error.message ? error.message : String(error)));
  process.exit(1);
});
