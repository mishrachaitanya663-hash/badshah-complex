import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { MongoMemoryServer } from 'mongodb-memory-server';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'badshah-api-test-'));
process.env.DB_DRIVER = 'mongo';
process.env.UPLOAD_DIR = path.join(tempDir, 'uploads');
process.env.ADMIN_USERNAME = 'admin';
process.env.ADMIN_PASSWORD = 'test-password';
process.env.CORS_ORIGINS = 'http://localhost:5175,http://localhost:5176';
process.env.CLOUDINARY_CLOUD_NAME = '';
process.env.CLOUDINARY_API_KEY = '';
process.env.CLOUDINARY_API_SECRET = '';

let server;
let base;
let mongoServer;
let closeCurrentDb;
let categoryId;
let subcategoryId;
let productId;
let token = '';

function auth() {
  return { token };
}

async function api(requestPath, { method = 'GET', token: bearer, body, form } = {}) {
  const headers = {};
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  let payload;
  if (form) {
    payload = form;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const response = await fetch(`${base}${requestPath}`, { method, headers, body: payload });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongoServer.getUri('badshah-api-test');
  process.env.MONGODB_DB = 'badshah-api-test';
  const { initDb, closeCurrentDb: closeDb } = await import('../src/db/index.js');
  closeCurrentDb = closeDb;
  await initDb();
  const { createApp } = await import('../src/app.js');
  server = (await createApp()).listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (closeCurrentDb) await closeCurrentDb();
  if (mongoServer) await mongoServer.stop();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('health endpoint is public', async () => {
  const response = await api('/api/health');
  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.driver, 'mongo');
  assert.equal(response.body.database, 'connected');
});

test('admin endpoints require authentication', async () => {
  const response = await api('/api/admin/products');
  assert.equal(response.status, 401);
});

test('admin login validates credentials and issues a session', async () => {
  const bad = await api('/api/auth/login', {
    method: 'POST',
    body: { username: 'admin', password: 'wrong-password' },
  });
  assert.equal(bad.status, 401);

  const ok = await api('/api/auth/login', {
    method: 'POST',
    body: { username: 'admin', password: 'test-password' },
  });
  assert.equal(ok.status, 200);
  assert.ok(ok.body.token);
  assert.equal(ok.body.admin.role, 'admin');
  token = ok.body.token;

  const me = await api('/api/auth/me', auth());
  assert.equal(me.status, 200);
  assert.equal(me.body.admin.username, 'admin');
});

test('catalog flow: category, subcategory, product, filters, images and validation', async () => {
  const denied = await api('/api/admin/categories', { method: 'POST', body: { name: 'Cement' } });
  assert.equal(denied.status, 401);

  const category = await api('/api/admin/categories', {
    method: 'POST',
    ...auth(),
    body: { name: 'Cement', description: 'Test category', displayOrder: 4 },
  });
  assert.equal(category.status, 201);
  assert.equal(category.body.name, 'Cement');
  assert.equal(category.body.imageUrl, null);
  assert.equal(category.body.displayOrder, 4);
  assert.equal(category.body.active, true);
  categoryId = category.body.id;

  const duplicateName = await api('/api/admin/categories', {
    method: 'POST',
    ...auth(),
    body: { name: '  CEMENT  ' },
  });
  assert.equal(duplicateName.status, 409);

  const duplicateSlug = await api('/api/admin/categories', {
    method: 'POST',
    ...auth(),
    body: { name: 'Other category', slug: 'cement' },
  });
  assert.equal(duplicateSlug.status, 409);

  const subcategory = await api('/api/admin/subcategories', {
    method: 'POST',
    ...auth(),
    body: { categoryId, name: 'PPC Cement', description: 'Test subcategory', displayOrder: 1 },
  });
  assert.equal(subcategory.status, 201);
  assert.equal(subcategory.body.categoryId, categoryId);
  assert.equal(subcategory.body.name, 'PPC Cement');
  assert.equal(subcategory.body.active, true);
  subcategoryId = subcategory.body.id;

  const wrongParent = await api('/api/admin/subcategories', {
    method: 'POST',
    ...auth(),
    body: { categoryId: 'missing-category', name: 'OPC Cement' },
  });
  assert.equal(wrongParent.status, 400);

  const badProduct = await api('/api/admin/products', {
    method: 'POST',
    ...auth(),
    body: {
      name: 'Bad priority',
      pricePaise: 100,
      stock: 1,
      unit: 'bag',
      categoryId,
      subcategoryId,
      starPriority: 4,
    },
  });
  assert.equal(badProduct.status, 400);

  const categoryOnly = await api('/api/admin/products', {
    method: 'POST',
    ...auth(),
    body: { name: 'Category only', pricePaise: 100, stock: 1, unit: 'bag', categoryId },
  });
  assert.equal(categoryOnly.status, 201);
  assert.equal(categoryOnly.body.subcategoryId, null);
  await api(`/api/admin/products/${categoryOnly.body.id}`, { method: 'DELETE', ...auth() });

  const low = await api('/api/admin/products', {
    method: 'POST',
    ...auth(),
    body: {
      name: 'Low priority',
      pricePaise: 5000,
      costPaise: 3500,
      stock: 3,
      unit: 'bag',
      categoryId,
      subcategoryId,
      starPriority: 0,
    },
  });
  const high = await api('/api/admin/products', {
    method: 'POST',
    ...auth(),
    body: {
      name: 'High priority',
      pricePaise: 9000,
      stock: 0,
      unit: 'tonne',
      categoryId,
      subcategoryId,
      starPriority: 3,
    },
  });
  assert.equal(low.status, 201);
  assert.equal(high.status, 201);
  productId = low.body.id;
  assert.equal(low.body.costPaise, 3500);
  assert.equal(low.body.cost, 35);

  const publicDetail = await api(`/api/products/${low.body.slug}`);
  assert.equal(publicDetail.status, 200);
  assert.equal('costPaise' in publicDetail.body, false);
  assert.equal('cost' in publicDetail.body, false);

  const sorted = await api('/api/products?sort=priority');
  assert.equal(sorted.body.items[0].name, 'High priority');
  assert.equal('costPaise' in sorted.body.items[0], false);
  assert.equal('cost' in sorted.body.items[0], false);

  const inStock = await api('/api/products?inStock=true');
  assert.equal(inStock.body.items.length, 1);
  assert.equal(inStock.body.items[0].name, 'Low priority');

  const outOfStock = await api('/api/products?inStock=false');
  assert.equal(outOfStock.body.items.length, 1);
  assert.equal(outOfStock.body.items[0].name, 'High priority');

  const filtered = await api('/api/products?category=cement&subcategory=ppc-cement');
  assert.equal(filtered.body.total, 2);

  const priced = await api('/api/products?minPrice=60&maxPrice=100');
  assert.equal(priced.body.total, 1);
  assert.equal(priced.body.items[0].name, 'High priority');

  const repriced = await api(`/api/admin/products/${productId}`, {
    method: 'PATCH',
    ...auth(),
    body: { costPaise: 4200 },
  });
  assert.equal(repriced.body.costPaise, 4200);
  assert.equal(repriced.body.cost, 42);

  const deactivated = await api(`/api/admin/products/${productId}`, {
    method: 'PATCH',
    ...auth(),
    body: { active: false },
  });
  assert.equal(deactivated.body.active, false);

  const hidden = await api('/api/products?q=Low%20priority');
  assert.equal(hidden.body.total, 0);

  const adminList = await api('/api/admin/products?q=Low%20priority', auth());
  assert.equal(adminList.body.total, 1);

  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8AAAwAB/AF+9mJ9AAAAAElFTkSuQmCC',
    'base64',
  );
  const form = new FormData();
  form.append('images', new Blob([png], { type: 'image/png' }), 'test.png');
  const uploaded = await api(`/api/admin/products/${productId}/images`, {
    method: 'POST',
    ...auth(),
    form,
  });
  assert.equal(uploaded.status, 201);
  assert.equal(uploaded.body.images.length, 1);
  assert.match(uploaded.body.images[0], /^\/uploads\//);
  assert.ok(fs.existsSync(path.join(tempDir, 'uploads', path.basename(uploaded.body.images[0]))));

  const categoryForm = new FormData();
  categoryForm.append('image', new Blob([png], { type: 'image/png' }), 'cover.png');
  const cover = await api('/api/admin/categories/images', {
    method: 'POST',
    ...auth(),
    form: categoryForm,
  });
  assert.equal(cover.status, 201);
  assert.match(cover.body.url, /^\/uploads\//);

  const removed = await api(`/api/admin/products/${productId}/images/0`, {
    method: 'DELETE',
    ...auth(),
  });
  assert.equal(removed.body.images.length, 0);
  assert.equal(fs.existsSync(path.join(tempDir, 'uploads', path.basename(uploaded.body.images[0]))), false);

  const subcategoryConflict = await api(`/api/admin/subcategories/${subcategoryId}`, {
    method: 'DELETE',
    ...auth(),
  });
  assert.equal(subcategoryConflict.status, 409);

  const conflict = await api(`/api/admin/categories/${categoryId}`, {
    method: 'DELETE',
    ...auth(),
  });
  assert.equal(conflict.status, 409);

  const destination = await api('/api/admin/categories', {
    method: 'POST',
    ...auth(),
    body: { name: 'Moved', slug: 'moved', displayOrder: 5 },
  });
  assert.equal(destination.status, 201);

  const recategorized = await api(`/api/admin/subcategories/${subcategoryId}`, {
    method: 'PATCH',
    ...auth(),
    body: { categoryId: destination.body.id },
  });
  assert.equal(recategorized.status, 200);
  const recategorizedProduct = await api(`/api/admin/products/${productId}`, auth());
  assert.equal(recategorizedProduct.body.categoryId, destination.body.id);
  const restored = await api(`/api/admin/subcategories/${subcategoryId}`, {
    method: 'PATCH',
    ...auth(),
    body: { categoryId },
  });
  assert.equal(restored.status, 200);

  const movedDelete = await api(`/api/admin/categories/${categoryId}?moveTo=${destination.body.id}`, {
    method: 'DELETE',
    ...auth(),
  });
  assert.equal(movedDelete.status, 204);

  const movedProduct = await api(`/api/admin/products/${productId}`, auth());
  assert.equal(movedProduct.body.categoryId, destination.body.id);
  assert.equal(movedProduct.body.subcategoryId, subcategoryId);

  const movedSubcategory = await api(`/api/admin/subcategories/${subcategoryId}`, auth());
  assert.equal(movedSubcategory.body.categoryId, destination.body.id);

  const activeCategory = await api('/api/categories');
  assert.equal(activeCategory.body.length, 1);
  assert.equal(activeCategory.body[0].name, 'Moved');
  assert.equal(activeCategory.body[0].productCount, 1);
  assert.equal(activeCategory.body[0].subcategoryCount, 1);
  assert.equal(activeCategory.body[0].displayOrder, 5);
});

test('admin dashboard stats reflect the shared database', async () => {
  const stats = await api('/api/admin/stats', auth());
  assert.equal(stats.status, 200);
  assert.equal(stats.body.products, 2);
  assert.equal(stats.body.categories, 1);
  assert.equal(stats.body.subcategories, 1);
  assert.equal(stats.body.activeProducts, 1);
  assert.equal(stats.body.inactiveProducts, 1);
  assert.equal(stats.body.totalStock, 3);
  assert.equal(stats.body.outOfStock, 1);
});

test('logout revokes the session', async () => {
  const out = await api('/api/auth/logout', { method: 'POST', ...auth() });
  assert.equal(out.status, 204);
  const me = await api('/api/auth/me', auth());
  assert.equal(me.status, 401);
});
