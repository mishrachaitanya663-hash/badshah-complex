import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { v2 as cloudinary } from 'cloudinary';
import { config } from '../config.js';

const EXTENSIONS = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['image/gif', 'gif'],
]);

let cloudinaryConfigured = false;

export function imageFileFilter(req, file, callback) {
  if (!EXTENSIONS.has(file.mimetype)) {
    callback(new Error('Only jpeg, png, webp and gif images are allowed'));
    return;
  }
  callback(null, true);
}

function ensureCloudinary() {
  if (!config.cloudinaryEnabled) {
    throw new Error('Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.');
  }
  if (!cloudinaryConfigured) {
    cloudinary.config({
      cloud_name: config.cloudinary.cloudName,
      api_key: config.cloudinary.apiKey,
      api_secret: config.cloudinary.apiSecret,
      secure: true,
    });
    cloudinaryConfigured = true;
  }
}

function isLocalUploadUrl(url) {
  return typeof url === 'string' && url.startsWith('/uploads/');
}

function isCloudinaryUrl(url) {
  return typeof url === 'string' && /res\.cloudinary\.com\//.test(url);
}

async function uploadToCloudinary(file, folder = 'badshah-complex') {
  ensureCloudinary();
  return await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'image' },
      (error, result) => {
        if (error) return reject(error);
        resolve({ url: result.secure_url, publicId: result.public_id });
      },
    );
    stream.end(file.buffer);
  });
}

function saveToLocal(file) {
  fs.mkdirSync(config.uploadDir, { recursive: true });
  const filename = `${crypto.randomUUID()}.${EXTENSIONS.get(file.mimetype)}`;
  fs.writeFileSync(path.join(config.uploadDir, filename), file.buffer);
  return { url: `/uploads/${filename}`, publicId: null };
}

export async function saveImages(files = [], options = {}) {
  const folder = options.folder || 'badshah-complex';
  const useCloudinary = options.provider === 'cloudinary' || (options.provider !== 'local' && config.cloudinaryEnabled);
  const out = [];
  for (const file of files) {
    if (useCloudinary) out.push(await uploadToCloudinary(file, folder));
    else out.push(saveToLocal(file));
  }
  return out;
}

export async function saveImage(file, options = {}) {
  const [saved] = await saveImages(file ? [file] : [], options);
  return saved ?? null;
}

function deleteLocalUrl(url) {
  if (!isLocalUploadUrl(url)) return;
  const filename = path.basename(url);
  if (filename !== url.slice('/uploads/'.length)) return;
  try {
    fs.rmSync(path.join(config.uploadDir, filename), { force: true });
  } catch {
    // ignore local cleanup errors
  }
}

export async function deleteImage({ url, publicId } = {}) {
  if (publicId && config.cloudinaryEnabled) {
    try {
      ensureCloudinary();
      await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
    } catch (error) {
      console.error('Cloudinary delete failed for', publicId, error.message);
    }
    return;
  }
  if (publicId && !config.cloudinaryEnabled) {
    // cannot delete remote asset without config; leave as-is
    return;
  }
  if (isLocalUploadUrl(url)) deleteLocalUrl(url);
}

export async function deleteImages(items = []) {
  for (const item of items) {
    if (!item) continue;
    if (typeof item === 'string') await deleteImage({ url: item, publicId: null });
    else await deleteImage(item);
  }
}

// Backward-compatible helpers for legacy callers/tests expecting localImageStorage-like API
export const localImageStorage = {
  saveMany(files = []) {
    fs.mkdirSync(config.uploadDir, { recursive: true });
    return files.map((file) => saveToLocal(file).url);
  },
  deleteMany(urls = []) {
    for (const url of urls) deleteLocalUrl(url);
  },
};

export const imageStorage = {
  enabledProvider: () => (config.cloudinaryEnabled ? 'cloudinary' : 'local'),
  saveImages,
  saveImage,
  deleteImage,
  deleteImages,
  isCloudinaryUrl,
  isLocalUploadUrl,
};
