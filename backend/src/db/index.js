import { config } from '../config.js';
import { initSqlite, closeDb, testSqliteConnection } from './sqlite.js';
import { initPostgres, closePostgres, testPostgresConnection } from './postgres.js';
import * as sqliteProducts from '../repositories/sqliteProductRepository.js';
import * as sqliteCategories from '../repositories/sqliteCategoryRepository.js';
import * as sqliteSubcategories from '../repositories/sqliteSubcategoryRepository.js';
import * as sqliteAuth from '../repositories/sqliteAuthRepository.js';
import * as pgProducts from '../repositories/postgresProductRepository.js';
import * as pgCategories from '../repositories/postgresCategoryRepository.js';
import * as pgSubcategories from '../repositories/postgresSubcategoryRepository.js';
import * as pgAuth from '../repositories/postgresAuthRepository.js';

let drivers;
let initialized = false;

function selectDrivers() {
  if (config.dbDriver === 'sqlite') {
    return {
      kind: 'sqlite',
      products: sqliteProducts,
      categories: sqliteCategories,
      subcategories: sqliteSubcategories,
      auth: sqliteAuth,
    };
  }
  if (config.dbDriver === 'postgres' || config.dbDriver === 'postgresql') {
    return {
      kind: 'postgres',
      products: pgProducts,
      categories: pgCategories,
      subcategories: pgSubcategories,
      auth: pgAuth,
    };
  }
  throw new Error(`Unsupported DB_DRIVER "${config.dbDriver}". Supported: sqlite, postgres.`);
}

export async function initDb() {
  if (initialized && drivers) return drivers;
  drivers = selectDrivers();
  if (drivers.kind === 'sqlite') {
    await initSqlite();
  } else {
    await initPostgres();
  }
  initialized = true;
  return drivers;
}

export function getDrivers() {
  if (!drivers || !initialized) {
    throw new Error('Database not initialized. Call initDb() before handling requests.');
  }
  return drivers;
}

export async function testDbConnection() {
  if (!drivers || !initialized) await initDb();
  if (drivers.kind === 'sqlite') return testSqliteConnection();
  return testPostgresConnection();
}

export async function closeCurrentDb() {
  if (!drivers) return;
  if (drivers.kind === 'sqlite') closeDb();
  else await closePostgres();
  drivers = undefined;
  initialized = false;
}

export function getDbKind() {
  return config.dbDriver === 'postgresql' ? 'postgres' : config.dbDriver;
}
