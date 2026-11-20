import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(backendRoot, '.env'), quiet: true });

const fromRoot = (value) => (path.isAbsolute(value) ? value : path.join(backendRoot, value));
const isProduction = process.env.NODE_ENV === 'production';

function positiveNumber(name, fallback) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be a positive number`);
  return value;
}

const dbDriver = (process.env.DB_DRIVER || (isProduction ? 'postgres' : 'sqlite')).toLowerCase();
const databaseUrl = process.env.DATABASE_URL || '';
const corsOrigins = (process.env.CORS_ORIGINS || (isProduction ? '' : 'http://localhost:5175,http://localhost:5176'))
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const cloudinary = {
  cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
  apiKey: process.env.CLOUDINARY_API_KEY || '',
  apiSecret: process.env.CLOUDINARY_API_SECRET || '',
};
const cloudinaryEnabled = Boolean(cloudinary.cloudName && cloudinary.apiKey && cloudinary.apiSecret);

const adminUsername = process.env.ADMIN_USERNAME || (isProduction ? '' : 'admin');
const adminPassword = process.env.ADMIN_PASSWORD || (isProduction ? '' : 'admin123');

if (isProduction) {
  const problems = [];
  if (dbDriver !== 'postgres' && dbDriver !== 'postgresql') problems.push('DB_DRIVER must be postgres');
  if (!databaseUrl) problems.push('DATABASE_URL is required');
  if (!adminUsername) problems.push('ADMIN_USERNAME is required');
  if (!adminPassword) problems.push('ADMIN_PASSWORD is required');
  else if (adminPassword.length < 12) problems.push('ADMIN_PASSWORD must be at least 12 characters');
  if (corsOrigins.length === 0 || corsOrigins.includes('*')) problems.push('CORS_ORIGINS must list exact origins');
  if (!cloudinaryEnabled) problems.push('All CLOUDINARY_* values are required');
  if (problems.length) throw new Error(`Invalid production configuration: ${problems.join('; ')}`);
}

export const config = Object.freeze({
  root: backendRoot,
  port: positiveNumber('PORT', 4000),
  dbDriver,
  databaseUrl,
  sqliteFile: fromRoot(process.env.SQLITE_FILE || './data/badshah-customer.db'),
  uploadDir: fromRoot(process.env.UPLOAD_DIR || './uploads'),
  maxImageBytes: positiveNumber('MAX_IMAGE_MB', 5) * 1024 * 1024,
  corsOrigins,
  adminUsername,
  adminPassword,
  sessionTtlHours: positiveNumber('SESSION_TTL_HOURS', 8),
  cloudinary,
  cloudinaryEnabled,
});
