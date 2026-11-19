import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(backendRoot, '.env'), quiet: true });

const fromRoot = (value) => (path.isAbsolute(value) ? value : path.join(backendRoot, value));

const corsOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5175,http://localhost:5176')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const cloudinary = {
  cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
  apiKey: process.env.CLOUDINARY_API_KEY || '',
  apiSecret: process.env.CLOUDINARY_API_SECRET || '',
};

export const config = Object.freeze({
  root: backendRoot,
  port: Number(process.env.PORT || 4000),
  dbDriver: (process.env.DB_DRIVER || 'sqlite').toLowerCase(),
  databaseUrl: process.env.DATABASE_URL || '',
  sqliteFile: fromRoot(process.env.SQLITE_FILE || './data/badshah-customer.db'),
  uploadDir: fromRoot(process.env.UPLOAD_DIR || './uploads'),
  maxImageBytes: Number(process.env.MAX_IMAGE_MB || 5) * 1024 * 1024,
  corsOrigins,
  adminUsername: process.env.ADMIN_USERNAME || 'admin',
  adminPassword: process.env.ADMIN_PASSWORD || 'admin123',
  sessionTtlHours: Number(process.env.SESSION_TTL_HOURS || 8),
  cloudinary,
  cloudinaryEnabled: Boolean(cloudinary.cloudName && cloudinary.apiKey && cloudinary.apiSecret),
});
