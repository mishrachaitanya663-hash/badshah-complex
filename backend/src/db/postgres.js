import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { config } from '../config.js';

const { Pool } = pg;

let pool;

function splitStatements(sql) {
  return sql
    .split(/;\s*(?:\r?\n|$)/g)
    .map((statement) => statement.trim())
    .filter(Boolean);
}

export async function initPostgres() {
  if (pool) return pool;
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL is required when DB_DRIVER=postgres');
  }

  pool = new Pool({
    connectionString: config.databaseUrl,
    ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false },
  });

  pool.on('error', (error) => {
    console.error('Unexpected PostgreSQL pool error', error);
  });

  // Verify connectivity early
  await pool.query('SELECT 1');

  const schemaPath = path.join(config.root, 'src/db/schema.postgres.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  for (const statement of splitStatements(schemaSql)) {
    await pool.query(statement);
  }
  await pool.query('ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_paise INTEGER NOT NULL DEFAULT 0 CHECK (cost_paise >= 0)');

  return pool;
}

export function getPool() {
  if (!pool) throw new Error('PostgreSQL has not been initialized. Call initDb() first.');
  return pool;
}

export async function query(text, params = []) {
  return getPool().query(text, params);
}

export async function withTransaction(fn) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* ignore rollback errors */ }
    throw error;
  } finally {
    client.release();
  }
}

export async function closePostgres() {
  if (pool) {
    const current = pool;
    pool = undefined;
    await current.end();
  }
}

export async function testPostgresConnection() {
  const result = await query('SELECT 1 AS ok');
  return result.rows[0]?.ok === 1;
}
