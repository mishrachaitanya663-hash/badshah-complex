import { randomUUID } from 'node:crypto';
import { productRepository } from '../repositories/productRepository.js';
import { categoryRepository } from '../repositories/categoryRepository.js';
import { subcategoryRepository } from '../repositories/subcategoryRepository.js';
import { imageStorage } from '../storage/imageStorage.js';
import { HttpError } from '../errors.js';

function makeSlug(value) {
  const slug = String(value ?? '')
    .normalize('NFKD')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70);
  return slug || `item-${randomUUID().slice(0, 8)}`;
}

async function uniqueSlug(value, finder, excludeId) {
  const base = makeSlug(value);
  let slug = base;
  let suffix = 2;
  while (true) {
    const existing = await finder(slug);
    if (!existing || existing.id === excludeId) return slug;
    slug = `${base}-${suffix++}`;
  }
}

function normalizeImageUrl(value) {
  const url = typeof value === 'string' ? value.trim() : '';
  return url || null;
}

function normalizePublicId(value) {
  const id = typeof value === 'string' ? value.trim() : '';
  return id || null;
}

function normalizeImageArray(values) {
  return Array.isArray(values) ? values.map((v) => (typeof v === 'string' ? v.trim() : '')).filter(Boolean) : [];
}

function normalizePublicIdArray(values, length) {
  const arr = Array.isArray(values) ? values.slice(0, length).map((v) => (v == null ? null : (String(v).trim() || null))) : [];
  while (arr.length < length) arr.push(null);
  return arr;
}

export function toPublicProduct(product) {
  if (!product) return product;
  const { costPaise, cost, ...publicProduct } = product;
  return publicProduct;
}


async function requireCategory(categoryId) {
  const category = await categoryRepository.findById(categoryId);
  if (!category) throw new HttpError(400, `Category "${categoryId}" does not exist`);
  return category;
}

async function requireSubcategory(subcategoryId) {
  const subcategory = await subcategoryRepository.findById(subcategoryId);
  if (!subcategory) throw new HttpError(400, `Subcategory "${subcategoryId}" does not exist`);
  return subcategory;
}

async function assertProductRelations(input, existing = null) {
  const categoryId = input.categoryId ?? existing?.categoryId;
  const subcategoryId = input.subcategoryId ?? existing?.subcategoryId;
  if (!categoryId) throw new HttpError(400, 'Category is required');
  if (!subcategoryId) throw new HttpError(400, 'Subcategory is required');

  await requireCategory(categoryId);
  const subcategory = await requireSubcategory(subcategoryId);
  if (subcategory.categoryId !== categoryId) {
    throw new HttpError(400, 'This subcategory does not belong to the selected category');
  }
}

function assertUniqueName(items, name, excludeId, label) {
  const needle = String(name ?? '').trim().toLowerCase();
  const duplicate = items.find((item) => item.id !== excludeId && String(item.name ?? '').trim().toLowerCase() === needle);
  if (duplicate) throw new HttpError(409, `A ${label} with this name already exists`);
}

function assertUniqueSlugValue(existing, slug, excludeId) {
  if (existing && existing.id !== excludeId) {
    throw new HttpError(409, `Slug "${slug}" is already in use`);
  }
}

async function uniqueId(requestedId, finder) {
  if (requestedId) {
    const existing = await finder(requestedId);
    if (!existing) return requestedId;
  }
  let id = randomUUID();
  while (await finder(id)) id = randomUUID();
  return id;
}

function nextOrder(items) {
  const orders = items.map((item) => Number(item.displayOrder ?? 0));
  return orders.length ? Math.max(...orders) + 1 : 0;
}

export async function listProducts(query = {}) {
  const repoQuery = {
    includeInactive: query.includeInactive === true,
    category: query.category,
    subcategory: query.subcategory,
    q: query.q,
    minPricePaise: query.minPrice === undefined ? undefined : Math.round(Number(query.minPrice) * 100),
    maxPricePaise: query.maxPrice === undefined ? undefined : Math.round(Number(query.maxPrice) * 100),
    inStock: query.inStock,
    sort: query.sort,
    page: query.page,
    limit: query.limit,
  };
  const [items, total] = await Promise.all([
    productRepository.list(repoQuery),
    productRepository.count(repoQuery),
  ]);
  const page = repoQuery.page ?? 1;
  const limit = repoQuery.limit ?? 12;
  return { items, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) };
}

export async function listPublicProducts(query = {}) {
  const result = await listProducts(query);
  return { ...result, items: result.items.map(toPublicProduct) };
}

export async function listAllProducts(query = {}) {
  return listProducts({ ...query, includeInactive: true });
}

export async function getStats() {
  const [products, categories, subcategories] = await Promise.all([
    productRepository.list({ includeInactive: true, page: 1, limit: 100000, sort: 'newest' }),
    categoryRepository.list({ includeInactive: true }),
    subcategoryRepository.list({ includeInactive: true }),
  ]);
  const activeProducts = products.filter((product) => product.active).length;
  return {
    products: products.length,
    categories: categories.length,
    subcategories: subcategories.length,
    activeProducts,
    inactiveProducts: products.length - activeProducts,
    activeCategories: categories.filter((category) => category.active).length,
    activeSubcategories: subcategories.filter((subcategory) => subcategory.active).length,
    totalStock: products.reduce((sum, product) => sum + (product.stock || 0), 0),
    outOfStock: products.filter((product) => (product.stock || 0) === 0).length,
  };
}

export async function getPublicProductBySlug(slug) {
  const product = await productRepository.findBySlug(slug);
  if (!product || !product.active) throw new HttpError(404, 'Product not found');
  return toPublicProduct(product);
}

export async function getProductById(id) {
  const product = await productRepository.findById(id);
  if (!product) throw new HttpError(404, 'Product not found');
  return product;
}

export async function createProduct(input) {
  await assertProductRelations(input);
  const now = new Date().toISOString();
  const images = normalizeImageArray(input.images);
  const imagePublicIds = normalizePublicIdArray(input.imagePublicIds, images.length);
  return productRepository.create({
    id: randomUUID(),
    slug: await uniqueSlug(input.name, productRepository.findBySlug),
    name: input.name,
    brand: input.brand ?? '',
    description: input.description ?? '',
    images,
    imagePublicIds,
    pricePaise: input.pricePaise,
    costPaise: input.costPaise ?? 0,
    stock: input.stock,
    unit: input.unit ?? '',
    categoryId: input.categoryId,
    subcategoryId: input.subcategoryId,
    active: input.active !== false,
    starPriority: input.starPriority ?? 0,
    createdAt: now,
    updatedAt: now,
  });
}

export async function updateProduct(id, input) {
  const existing = await getProductById(id);
  if (input.categoryId !== undefined || input.subcategoryId !== undefined) {
    await assertProductRelations(input, existing);
  }

  const patch = { ...input };
  if (patch.name && patch.name !== existing.name) {
    patch.slug = await uniqueSlug(patch.name, productRepository.findBySlug, id);
  }
  if (patch.images !== undefined) {
    const images = normalizeImageArray(patch.images);
    patch.images = images;
    patch.imagePublicIds = normalizePublicIdArray(patch.imagePublicIds ?? existing.imagePublicIds, images.length);
  }
  return productRepository.update(id, patch);
}

export async function deleteProduct(id) {
  const existing = await getProductById(id);
  const assets = (existing.images || []).map((url, index) => ({ url, publicId: existing.imagePublicIds?.[index] || null }));
  await imageStorage.deleteImages(assets);
  await productRepository.remove(id);
}

export async function addProductImages(id, files = []) {
  const existing = await getProductById(id);
  if (!files.length) return existing;
  const saved = await imageStorage.saveImages(files, { folder: 'badshah-complex/products' });
  const images = [...(existing.images || []), ...saved.map((item) => item.url)];
  const imagePublicIds = [...(existing.imagePublicIds || []), ...saved.map((item) => item.publicId || null)];
  return productRepository.update(id, { images, imagePublicIds });
}

export async function removeProductImage(id, index) {
  const existing = await getProductById(id);
  if (!Number.isInteger(index) || index < 0 || index >= (existing.images || []).length) {
    throw new HttpError(404, 'Image not found');
  }
  const images = [...existing.images];
  const imagePublicIds = [...(existing.imagePublicIds || [])];
  const [removedUrl] = images.splice(index, 1);
  const [removedPublicId] = imagePublicIds.splice(index, 1);
  const updated = await productRepository.update(id, { images, imagePublicIds });
  await imageStorage.deleteImage({ url: removedUrl, publicId: removedPublicId || null });
  return updated;
}

export async function listCategories(includeInactive = false) {
  return categoryRepository.list({ includeInactive });
}

export async function getPublicCategoryBySlug(slug) {
  const category = await categoryRepository.findBySlug(slug);
  if (!category || !category.active) throw new HttpError(404, 'Category not found');
  return category;
}

export async function getCategoryById(id) {
  const category = await categoryRepository.findById(id);
  if (!category) throw new HttpError(404, 'Category not found');
  return category;
}

export async function createCategory(input) {
  const now = new Date().toISOString();
  const categories = await categoryRepository.list({ includeInactive: true });
  assertUniqueName(categories, input.name, undefined, 'category');

  const slug = makeSlug(input.slug ?? input.name);
  assertUniqueSlugValue(await categoryRepository.findBySlug(slug), slug);

  return categoryRepository.create({
    id: await uniqueId(input.id, categoryRepository.findById),
    name: String(input.name ?? '').trim(),
    slug,
    description: input.description ?? '',
    imageUrl: normalizeImageUrl(input.imageUrl),
    imagePublicId: normalizePublicId(input.imagePublicId),
    displayOrder: input.displayOrder ?? nextOrder(categories),
    active: input.active !== false,
    createdAt: now,
    updatedAt: now,
  });
}

export async function updateCategory(id, input) {
  const existing = await getCategoryById(id);
  const patch = { ...input };

  if (patch.name !== undefined) {
    patch.name = String(patch.name).trim();
    assertUniqueName(await categoryRepository.list({ includeInactive: true }), patch.name, id, 'category');
  }

  if (patch.slug !== undefined) {
    patch.slug = makeSlug(patch.slug);
    assertUniqueSlugValue(await categoryRepository.findBySlug(patch.slug), patch.slug, id);
  } else if (patch.name && patch.name !== existing.name) {
    patch.slug = makeSlug(patch.name);
    assertUniqueSlugValue(await categoryRepository.findBySlug(patch.slug), patch.slug, id);
  }

  if (patch.imageUrl !== undefined) {
    patch.imageUrl = normalizeImageUrl(patch.imageUrl);
    patch.imagePublicId = patch.imageUrl ? normalizePublicId(patch.imagePublicId ?? (patch.imageUrl === existing.imageUrl ? existing.imagePublicId : null)) : null;
    if (patch.imageUrl !== existing.imageUrl || patch.imagePublicId !== (existing.imagePublicId ?? null)) {
      await imageStorage.deleteImage({ url: existing.imageUrl, publicId: existing.imagePublicId || null });
    }
  } else if (patch.imagePublicId !== undefined) {
    patch.imagePublicId = normalizePublicId(patch.imagePublicId);
  }

  return categoryRepository.update(id, patch);
}

export async function uploadCategoryImage(files = []) {
  const file = files[0];
  if (!file) throw new HttpError(400, 'Choose an image to upload');
  const saved = await imageStorage.saveImage(file, { folder: 'badshah-complex/categories' });
  return { url: saved.url, publicId: saved.publicId };
}

export async function uploadSubcategoryImage(files = []) {
  const file = files[0];
  if (!file) throw new HttpError(400, 'Choose an image to upload');
  const saved = await imageStorage.saveImage(file, { folder: 'badshah-complex/subcategories' });
  return { url: saved.url, publicId: saved.publicId };
}

export async function listSubcategories(query = {}) {
  const items = await subcategoryRepository.list({
    includeInactive: query.includeInactive === true,
    category: query.category,
  });
  const search = query.q?.trim().toLowerCase();
  if (!search) return items;
  return items.filter((item) => `${item.name} ${item.description}`.toLowerCase().includes(search));
}

export async function getPublicSubcategoryBySlug(slug) {
  const subcategory = await subcategoryRepository.findBySlug(slug);
  if (!subcategory || !subcategory.active) throw new HttpError(404, 'Subcategory not found');
  return subcategory;
}

export async function getSubcategoryById(id) {
  const subcategory = await subcategoryRepository.findById(id);
  if (!subcategory) throw new HttpError(404, 'Subcategory not found');
  return subcategory;
}

export async function createSubcategory(input) {
  await requireCategory(input.categoryId);
  const now = new Date().toISOString();
  const subcategories = await subcategoryRepository.list({ includeInactive: true });
  assertUniqueName(subcategories, input.name, undefined, 'subcategory');

  const slug = makeSlug(input.slug ?? input.name);
  assertUniqueSlugValue(await subcategoryRepository.findBySlug(slug), slug);

  return subcategoryRepository.create({
    id: await uniqueId(input.id, subcategoryRepository.findById),
    categoryId: input.categoryId,
    name: String(input.name ?? '').trim(),
    slug,
    description: input.description ?? '',
    imageUrl: normalizeImageUrl(input.imageUrl),
    imagePublicId: normalizePublicId(input.imagePublicId),
    displayOrder: input.displayOrder ?? nextOrder(subcategories.filter((item) => item.categoryId === input.categoryId)),
    active: input.active !== false,
    createdAt: now,
    updatedAt: now,
  });
}

export async function updateSubcategory(id, input) {
  const existing = await getSubcategoryById(id);
  const patch = { ...input };

  if (patch.categoryId !== undefined) await requireCategory(patch.categoryId);
  if (patch.name !== undefined) {
    patch.name = String(patch.name).trim();
    assertUniqueName(await subcategoryRepository.list({ includeInactive: true }), patch.name, id, 'subcategory');
  }

  if (patch.slug !== undefined) {
    patch.slug = makeSlug(patch.slug);
    assertUniqueSlugValue(await subcategoryRepository.findBySlug(patch.slug), patch.slug, id);
  } else if (patch.name && patch.name !== existing.name) {
    patch.slug = makeSlug(patch.name);
    assertUniqueSlugValue(await subcategoryRepository.findBySlug(patch.slug), patch.slug, id);
  }

  if (patch.imageUrl !== undefined) {
    patch.imageUrl = normalizeImageUrl(patch.imageUrl);
    patch.imagePublicId = patch.imageUrl ? normalizePublicId(patch.imagePublicId ?? (patch.imageUrl === existing.imageUrl ? existing.imagePublicId : null)) : null;
    if (patch.imageUrl !== existing.imageUrl || patch.imagePublicId !== (existing.imagePublicId ?? null)) {
      await imageStorage.deleteImage({ url: existing.imageUrl, publicId: existing.imagePublicId || null });
    }
  } else if (patch.imagePublicId !== undefined) {
    patch.imagePublicId = normalizePublicId(patch.imagePublicId);
  }

  return subcategoryRepository.update(id, patch);
}

export async function deleteSubcategory(id, options = {}) {
  const existing = await getSubcategoryById(id);
  const productCount = await subcategoryRepository.productCount(id);
  if (productCount > 0) {
    const moveTo = options.moveTo;
    if (!moveTo) {
      throw new HttpError(409, `Subcategory still has ${productCount} products. Choose another subcategory to move them to, or delete the products first.`);
    }
    if (moveTo === id) throw new HttpError(400, 'Choose a different destination subcategory');
    await requireSubcategory(moveTo);
    await subcategoryRepository.moveProducts(id, moveTo);
  }
  await imageStorage.deleteImage({ url: existing.imageUrl, publicId: existing.imagePublicId || null });
  await subcategoryRepository.remove(id);
}

export async function deleteCategory(id, options = {}) {
  const existing = await getCategoryById(id);
  const [productCount, subcategoryCount] = await Promise.all([
    categoryRepository.productCount(id),
    categoryRepository.subcategoryCount(id),
  ]);
  if (productCount > 0 || subcategoryCount > 0) {
    const moveTo = options.moveTo;
    if (!moveTo) {
      throw new HttpError(409, `Category still has ${subcategoryCount} subcategories and ${productCount} products. Choose another category to move them to, or delete them first.`);
    }
    if (moveTo === id) throw new HttpError(400, 'Choose a different destination category');
    await requireCategory(moveTo);
    await subcategoryRepository.moveToCategory(id, moveTo);
    await productRepository.moveToCategory(id, moveTo);
  }
  await imageStorage.deleteImage({ url: existing.imageUrl, publicId: existing.imagePublicId || null });
  await categoryRepository.remove(id);
}
