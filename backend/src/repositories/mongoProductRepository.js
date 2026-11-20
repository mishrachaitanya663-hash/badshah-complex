import { getCollection } from '../db/mongo.js';

const SORT = {
  priority: { star_priority: -1, created_at: -1, id: 1 },
  newest: { created_at: -1, id: 1 },
  'price-asc': { price_paise: 1, created_at: -1, id: 1 },
  'price-desc': { price_paise: -1, created_at: -1, id: 1 },
  name: { name: 1, id: 1 },
};

const COLLATION = { locale: 'en', strength: 2 };

const FIELD_BY_FIELD = {
  name: 'name',
  slug: 'slug',
  brand: 'brand',
  description: 'description',
  images: 'images',
  imagePublicIds: 'image_public_ids',
  pricePaise: 'price_paise',
  costPaise: 'cost_paise',
  stock: 'stock',
  unit: 'unit',
  categoryId: 'category_id',
  subcategoryId: 'subcategory_id',
  active: 'active',
  starPriority: 'star_priority',
};

const WITH_RELATIONS = [
  {
    $lookup: {
      from: 'categories',
      localField: 'category_id',
      foreignField: 'id',
      as: '_category',
    },
  },
  {
    $set: {
      category_name: { $ifNull: [{ $arrayElemAt: ['$_category.name', 0] }, null] },
      category_slug: { $ifNull: [{ $arrayElemAt: ['$_category.slug', 0] }, null] },
    },
  },
  {
    $lookup: {
      from: 'subcategories',
      localField: 'subcategory_id',
      foreignField: 'id',
      as: '_subcategory',
    },
  },
  {
    $set: {
      subcategory_name: { $ifNull: [{ $arrayElemAt: ['$_subcategory.name', 0] }, null] },
      subcategory_slug: { $ifNull: [{ $arrayElemAt: ['$_subcategory.slug', 0] }, null] },
    },
  },
  { $unset: ['_category', '_subcategory'] },
];

function toInt(value, fallback = 0) {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function toProduct(doc) {
  if (!doc) return null;
  return {
    id: doc.id,
    name: doc.name,
    slug: doc.slug,
    brand: doc.brand ?? '',
    description: doc.description ?? '',
    images: parseJsonArray(doc.images),
    imagePublicIds: parseJsonArray(doc.image_public_ids),
    pricePaise: toInt(doc.price_paise),
    price: toInt(doc.price_paise) / 100,
    costPaise: toInt(doc.cost_paise),
    cost: toInt(doc.cost_paise) / 100,
    stock: toInt(doc.stock),
    unit: doc.unit ?? '',
    inStock: toInt(doc.stock) > 0,
    categoryId: doc.category_id,
    category: doc.category_id ? { id: doc.category_id, name: doc.category_name, slug: doc.category_slug } : null,
    subcategoryId: doc.subcategory_id ?? null,
    subcategory: doc.subcategory_id ? { id: doc.subcategory_id, name: doc.subcategory_name, slug: doc.subcategory_slug } : null,
    active: Boolean(doc.active),
    starPriority: toInt(doc.star_priority),
    createdAt: doc.created_at,
    updatedAt: doc.updated_at,
  };
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function buildMatch(query = {}) {
  const match = {};
  if (!query.includeInactive) match.active = true;

  if (query.category) {
    const category = await getCollection('categories').findOne(
      { $or: [{ slug: query.category }, { id: query.category }] },
      { projection: { id: 1 } },
    );
    if (!category) return null;
    match.category_id = category.id;
  }

  if (query.subcategory) {
    const subcategory = await getCollection('subcategories').findOne(
      { $or: [{ slug: query.subcategory }, { id: query.subcategory }] },
      { projection: { id: 1 } },
    );
    if (!subcategory) return null;
    match.subcategory_id = subcategory.id;
  }

  if (query.q) {
    const regex = new RegExp(escapeRegex(query.q), 'i');
    match.$or = [{ name: regex }, { brand: regex }, { description: regex }];
  }

  if (query.minPricePaise !== undefined || query.maxPricePaise !== undefined) {
    match.price_paise = {};
    if (query.minPricePaise !== undefined) match.price_paise.$gte = query.minPricePaise;
    if (query.maxPricePaise !== undefined) match.price_paise.$lte = query.maxPricePaise;
  }

  if (query.inStock !== undefined) match.stock = query.inStock ? { $gt: 0 } : { $lte: 0 };

  return match;
}

function toDocument(data) {
  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    brand: data.brand ?? '',
    description: data.description ?? '',
    images: data.images ?? [],
    image_public_ids: data.imagePublicIds ?? [],
    price_paise: data.pricePaise,
    cost_paise: data.costPaise ?? 0,
    stock: data.stock,
    unit: data.unit ?? '',
    category_id: data.categoryId,
    subcategory_id: data.subcategoryId ?? null,
    active: data.active !== false,
    star_priority: data.starPriority ?? 0,
    created_at: data.createdAt,
    updated_at: data.updatedAt,
  };
}

export async function listProducts(query = {}) {
  const match = await buildMatch(query);
  if (match === null) return [];
  const limit = query.limit ?? 12;
  const skip = ((query.page ?? 1) - 1) * limit;
  const sort = SORT[query.sort] || SORT.priority;
  const docs = await getCollection('products')
    .aggregate([...WITH_RELATIONS, { $match: match }, { $sort: sort }, { $skip: skip }, { $limit: limit }], { collation: COLLATION })
    .toArray();
  return docs.map(toProduct);
}

export async function countProducts(query = {}) {
  const match = await buildMatch(query);
  if (match === null) return 0;
  return getCollection('products').countDocuments(match, { collation: COLLATION });
}

export async function findProductById(id) {
  const [doc] = await getCollection('products')
    .aggregate([{ $match: { id } }, ...WITH_RELATIONS])
    .toArray();
  return toProduct(doc);
}

export async function findProductBySlug(slug) {
  const [doc] = await getCollection('products')
    .aggregate([{ $match: { slug } }, ...WITH_RELATIONS])
    .toArray();
  return toProduct(doc);
}

export async function createProduct(data) {
  await getCollection('products').insertOne(toDocument(data));
  return findProductById(data.id);
}

export async function updateProduct(id, patch) {
  const set = {};
  for (const [field, value] of Object.entries(patch)) {
    const column = FIELD_BY_FIELD[field];
    if (!column) continue;
    if (column === 'subcategory_id' && value === undefined) continue;
    set[column] = value === '' && (column === 'image_url' || column === 'image_public_id') ? null : value;
  }
  set.updated_at = new Date().toISOString();
  await getCollection('products').updateOne({ id }, { $set: set });
  return findProductById(id);
}

export async function removeProduct(id) {
  const result = await getCollection('products').deleteOne({ id });
  return result.deletedCount > 0;
}

export async function moveProductsToCategory(fromCategoryId, toCategoryId) {
  const result = await getCollection('products').updateMany(
    { category_id: fromCategoryId },
    { $set: { category_id: toCategoryId, updated_at: new Date().toISOString() } },
  );
  return result.matchedCount;
}

export async function countProductsInCategory(categoryId, includeInactive = false) {
  const match = { category_id: categoryId };
  if (!includeInactive) match.active = true;
  return getCollection('products').countDocuments(match);
}

export async function countProductsInSubcategory(subcategoryId, includeInactive = false) {
  const match = { subcategory_id: subcategoryId };
  if (!includeInactive) match.active = true;
  return getCollection('products').countDocuments(match);
}
