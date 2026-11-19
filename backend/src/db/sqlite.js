import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from '../config.js';

let connection;

function ensureColumn(db, table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some((entry) => entry.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
  }
}

export function getDb() {
  if (connection) return connection;

  fs.mkdirSync(path.dirname(config.sqliteFile), { recursive: true });
  fs.mkdirSync(config.uploadDir, { recursive: true });

  connection = new DatabaseSync(config.sqliteFile);
  connection.exec('PRAGMA foreign_keys = ON;');
  connection.exec(fs.readFileSync(path.join(config.root, 'src/db/schema.sql'), 'utf8'));

  // Backward-compatible migrations for existing DBs
  ensureColumn(connection, 'categories', 'display_order', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(connection, 'categories', 'image_public_id', 'TEXT');
  ensureColumn(connection, 'subcategories', 'image_public_id', 'TEXT');
  ensureColumn(connection, 'products', 'unit', "TEXT NOT NULL DEFAULT ''");
  ensureColumn(connection, 'products', 'subcategory_id', 'TEXT REFERENCES subcategories(id) ON DELETE SET NULL');
  ensureColumn(connection, 'products', 'image_public_ids', "TEXT NOT NULL DEFAULT '[]'");
  ensureColumn(connection, 'products', 'cost_paise', 'INTEGER NOT NULL DEFAULT 0 CHECK (cost_paise >= 0)');

  connection.exec('CREATE INDEX IF NOT EXISTS idx_products_subcategory_active ON products (subcategory_id, active);');

  return connection;
}

export async function initSqlite() {
  getDb();
  return connection;
}

export function closeDb() {
  if (connection) {
    connection.close();
    connection = undefined;
  }
}

export async function testSqliteConnection() {
  const row = getDb().prepare('SELECT 1 AS ok').get();
  return row?.ok === 1;
}
