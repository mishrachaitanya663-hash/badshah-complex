import fs from 'node:fs';
import path from 'node:path';
import { config } from '../src/config.js';
import { initDb, closeCurrentDb, getDbKind } from '../src/db/index.js';
import { getDb } from '../src/db/sqlite.js';
import { query } from '../src/db/postgres.js';
import { imageStorage } from '../src/storage/imageStorage.js';

const dryRun = process.argv.includes('--dry-run');
const deleteLocal = process.argv.includes('--delete-local');

const MIME_BY_EXT = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

function log(message) {
  console.log('[cloudinary] ' + message);
}

if (!config.cloudinaryEnabled) {
  console.error('[cloudinary] Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET first.');
  process.exit(1);
}

function parseArray(value) {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function localFileName(url) {
  if (typeof url !== 'string' || !url.startsWith('/uploads/')) return null;
  const name = path.basename(url);
  return name && name === url.slice('/uploads/'.length) ? name : null;
}

async function fetchRows(table) {
  if (getDbKind() === 'sqlite') return getDb().prepare(`SELECT * FROM ${table}`).all();
  const { rows } = await query(`SELECT * FROM ${table}`);
  return rows;
}

async function updateProductRow(id, images, imagePublicIds) {
  const values = [JSON.stringify(images), JSON.stringify(imagePublicIds), new Date().toISOString(), id];
  if (getDbKind() === 'sqlite') {
    getDb().prepare('UPDATE products SET images = ?, image_public_ids = ?, updated_at = ? WHERE id = ?').run(...values);
  } else {
    await query('UPDATE products SET images = $1, image_public_ids = $2, updated_at = $3 WHERE id = $4', values);
  }
}

async function updateImageRow(table, id, url, publicId) {
  const values = [url, publicId, new Date().toISOString(), id];
  if (getDbKind() === 'sqlite') {
    getDb().prepare(`UPDATE ${table} SET image_url = ?, image_public_id = ?, updated_at = ? WHERE id = ?`).run(...values);
  } else {
    await query(`UPDATE ${table} SET image_url = $1, image_public_id = $2, updated_at = $3 WHERE id = $4`, values);
  }
}

async function uploadLocal(name, folder) {
  const filePath = path.join(config.uploadDir, name);
  const mimetype = MIME_BY_EXT[path.extname(name).toLowerCase()];
  if (!mimetype || !fs.existsSync(filePath)) return null;
  return imageStorage.saveImage({ buffer: fs.readFileSync(filePath), mimetype }, { folder });
}

function removeLocal(name) {
  if (deleteLocal) fs.rmSync(path.join(config.uploadDir, name), { force: true });
}

async function run() {
  await initDb();
  const summary = { found: 0, uploaded: 0, missing: 0, failed: 0 };

  for (const row of await fetchRows('products')) {
    const images = parseArray(row.images);
    const publicIds = parseArray(row.image_public_ids);
    let changed = false;
    for (let index = 0; index < images.length; index += 1) {
      const name = localFileName(images[index]);
      if (!name) continue;
      summary.found += 1;
      if (dryRun) continue;
      try {
        const saved = await uploadLocal(name, 'badshah-complex/products');
        if (!saved) {
          summary.missing += 1;
          continue;
        }
        images[index] = saved.url;
        publicIds[index] = saved.publicId;
        changed = true;
        summary.uploaded += 1;
        removeLocal(name);
      } catch (error) {
        summary.failed += 1;
        console.error('[cloudinary] product image failed', name, error?.message);
      }
    }
    if (changed) {
      while (publicIds.length < images.length) publicIds.push(null);
      await updateProductRow(row.id, images, publicIds.slice(0, images.length));
    }
  }

  const imageTables = [
    ['categories', 'badshah-complex/categories'],
    ['subcategories', 'badshah-complex/subcategories'],
  ];
  for (const [table, folder] of imageTables) {
    for (const row of await fetchRows(table)) {
      const name = localFileName(row.image_url);
      if (!name) continue;
      summary.found += 1;
      if (dryRun) continue;
      try {
        const saved = await uploadLocal(name, folder);
        if (!saved) {
          summary.missing += 1;
          continue;
        }
        await updateImageRow(table, row.id, saved.url, saved.publicId);
        summary.uploaded += 1;
        removeLocal(name);
      } catch (error) {
        summary.failed += 1;
        console.error('[cloudinary] ' + table + ' image failed', name, error?.message);
      }
    }
  }

  log(`driver=${getDbKind()} mode=${dryRun ? 'dry-run' : 'upload'} found=${summary.found} uploaded=${summary.uploaded} missing=${summary.missing} failed=${summary.failed}`);
  if (summary.failed > 0) process.exitCode = 1;
}

try {
  await run();
} catch (error) {
  console.error('[cloudinary] migration failed:', error?.message);
  process.exitCode = 1;
} finally {
  await closeCurrentDb();
}
