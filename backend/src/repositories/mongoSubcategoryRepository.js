import { getCollection } from '../db/mongo.js';

const COLLATION = { locale: 'en', strength: 2 };

const FIELD_BY_FIELD = {
  categoryId: 'category_id',
  name: 'name',
  slug: 'slug',
  description: 'description',
  imageUrl: 'image_url',
  imagePublicId: 'image_public_id',
  displayOrder: 'display_order',
  active: 'active',
};

function toInt(value, fallback = 0) {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function withRelations(includeInactive) {
  const productPipeline = includeInactive ? [] : [{ $match: { active: true } }];
  return [
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
        category_display_order: { $ifNull: [{ $arrayElemAt: ['$_category.display_order', 0] }, 0] },
      },
    },
    {
      $lookup: {
        from: 'products',
        localField: 'id',
        foreignField: 'subcategory_id',
        pipeline: productPipeline,
        as: '_products',
      },
    },
    {
      $set: {
        product_count: { $size: '$_products' },
      },
    },
    { $unset: ['_category', '_products'] },
  ];
}

function toSubcategory(doc) {
  if (!doc) return null;
  return {
    id: doc.id,
    categoryId: doc.category_id,
    category: doc.category_id ? { id: doc.category_id, name: doc.category_name, slug: doc.category_slug } : null,
    name: doc.name,
    slug: doc.slug,
    description: doc.description ?? '',
    imageUrl: doc.image_url ?? null,
    imagePublicId: doc.image_public_id ?? null,
    displayOrder: toInt(doc.display_order),
    active: Boolean(doc.active),
    productCount: toInt(doc.product_count),
    createdAt: doc.created_at,
    updatedAt: doc.updated_at,
  };
}

function toDocument(data) {
  return {
    id: data.id,
    category_id: data.categoryId,
    name: data.name,
    slug: data.slug,
    description: data.description ?? '',
    image_url: data.imageUrl ?? null,
    image_public_id: data.imagePublicId ?? null,
    display_order: data.displayOrder ?? 0,
    active: data.active !== false,
    created_at: data.createdAt,
    updated_at: data.updatedAt,
  };
}

export async function listSubcategories(query = {}) {
  const match = {};
  if (!query.includeInactive) match.active = true;
  if (query.category) {
    const category = await getCollection('categories').findOne(
      { $or: [{ slug: query.category }, { id: query.category }] },
      { projection: { id: 1 } },
    );
    if (!category) return [];
    match.category_id = category.id;
  }

  const docs = await getCollection('subcategories')
    .aggregate([
      { $match: match },
      ...withRelations(query.includeInactive === true),
      { $sort: { category_display_order: 1, display_order: 1, name: 1, id: 1 } },
      { $unset: 'category_display_order' },
    ], { collation: COLLATION })
    .toArray();
  return docs.map(toSubcategory);
}

export async function findSubcategoryById(id) {
  const [doc] = await getCollection('subcategories')
    .aggregate([{ $match: { id } }, ...withRelations(false)])
    .toArray();
  return toSubcategory(doc);
}

export async function findSubcategoryBySlug(slug) {
  const [doc] = await getCollection('subcategories')
    .aggregate([{ $match: { slug } }, ...withRelations(false)])
    .toArray();
  return toSubcategory(doc);
}

export async function createSubcategory(data) {
  await getCollection('subcategories').insertOne(toDocument(data));
  return findSubcategoryById(data.id);
}

export async function updateSubcategory(id, patch) {
  const set = {};
  for (const [field, value] of Object.entries(patch)) {
    const column = FIELD_BY_FIELD[field];
    if (!column) continue;
    set[column] = value === '' && (column === 'image_url' || column === 'image_public_id') ? null : value;
  }
  set.updated_at = new Date().toISOString();
  await getCollection('subcategories').updateOne({ id }, { $set: set });
  return findSubcategoryById(id);
}

export async function syncProductCategoryForSubcategory(subcategoryId, categoryId) {
  await getCollection('products').updateMany(
    { subcategory_id: subcategoryId },
    { $set: { category_id: categoryId, updated_at: new Date().toISOString() } },
  );
}

export async function removeSubcategory(id) {
  const result = await getCollection('subcategories').deleteOne({ id });
  if (result.deletedCount > 0) {
    await getCollection('products').updateMany(
      { subcategory_id: id },
      { $set: { subcategory_id: null, updated_at: new Date().toISOString() } },
    );
  }
  return result.deletedCount > 0;
}

export async function countProductsInSubcategory(id, includeInactive = false) {
  const match = { subcategory_id: id };
  if (!includeInactive) match.active = true;
  return getCollection('products').countDocuments(match);
}

export async function moveProductsToSubcategory(fromSubcategoryId, toSubcategoryId) {
  const target = await getCollection('subcategories').findOne(
    { id: toSubcategoryId },
    { projection: { category_id: 1 } },
  );
  if (!target) return 0;
  const result = await getCollection('products').updateMany(
    { subcategory_id: fromSubcategoryId },
    { $set: { subcategory_id: toSubcategoryId, category_id: target.category_id, updated_at: new Date().toISOString() } },
  );
  return result.matchedCount;
}

export async function moveSubcategoriesToCategory(fromCategoryId, toCategoryId) {
  const result = await getCollection('subcategories').updateMany(
    { category_id: fromCategoryId },
    { $set: { category_id: toCategoryId, updated_at: new Date().toISOString() } },
  );
  return result.matchedCount;
}
