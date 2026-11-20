import { config } from '../config.js';
import { initMongo, closeMongo, testMongoConnection } from './mongo.js';
import * as mongoProducts from '../repositories/mongoProductRepository.js';
import * as mongoCategories from '../repositories/mongoCategoryRepository.js';
import * as mongoSubcategories from '../repositories/mongoSubcategoryRepository.js';
import * as mongoAuth from '../repositories/mongoAuthRepository.js';

let drivers;
let initialized = false;

function selectDrivers() {
  if (config.dbDriver !== 'mongo') {
    throw new Error(`Unsupported DB_DRIVER "${config.dbDriver}". Supported: mongo.`);
  }
  return {
    kind: 'mongo',
    products: mongoProducts,
    categories: mongoCategories,
    subcategories: mongoSubcategories,
    auth: mongoAuth,
  };
}

export async function initDb() {
  if (initialized && drivers) return drivers;
  drivers = selectDrivers();
  await initMongo();
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
  return testMongoConnection();
}

export async function closeCurrentDb() {
  if (!drivers) return;
  await closeMongo();
  drivers = undefined;
  initialized = false;
}

export function getDbKind() {
  return 'mongo';
}
