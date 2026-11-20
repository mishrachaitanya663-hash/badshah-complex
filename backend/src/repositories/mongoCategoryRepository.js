import { getCollection } from '../db/mongo.js';

const COLLATION = { locale: 'en', strength: 2 };

const FIELD_BY_FIELD = {
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

function withCounts(includeInactive) {
  const productPipeline = includeInactive ? [] : [{ $match: { active: true } }];
  const subcategoryPipeline = includeInactive ? [] : [{ $match: { active: true } }];
  return [
    {
      $lookup: {
        from: 'products',
        localField: 'id',
        foreignField: 'category_id',
        pipeline: productPipeline,
        as: '_products',
      },
    },
    {
      $lookup: {
        from: 'subcategories',
        localField: 'id',
        foreignField: 'category_id',
        pipeline: subcategoryPipeline,
        as: '_subcategories',
      },
    },
    {
      $set: {
        product_count: { $size: '$_products' },
        subcategory_count: { $size: '$_subcategories' },
      },
    },
    { $unset: ['_products', '_subcategories'] },
  ];
}

function toCategory(doc) {
  if (!doc) return null;
  return {
    id: doc.id,
    name: doc.name,
    slug: doc.slug,
    description: doc.description ?? '',
    imageUrl: doc.image_url ?? null,
    imagePublicId: doc.image_public_id ?? null,
    displayOrder: toInt(doc.display_order),
    active: Boolean(doc.active),
    productCount: toInt(doc.product_count),
    subcategoryCount: toInt(doc.subcategory_count),
    createdAt: doc.created_at,
    updatedAt: doc.updated_at,
  };
}

function toDocument(data) {
  return {
    id: data.id,
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

export async function listCategories({ includeInactive = false } = {}) {
  const match = includeInactive ? {} : { active: true };
  const docs = await getCollection('categories')
    .aggregate([
      { $match: match },
      ...withCounts(includeInactive),
      { $sort: { display_order: 1, name: 1, id: 1 } },
    ], { collation: COLLATION })
    .toArray();
  return docs.map(toCategory);
}

export async function findCategoryById(id) {
  const [doc] = await getCollection('categories')
    .aggregate([{ $match: { id } }, ...withCounts(false)])
    .toArray();
  return toCategory(doc);
}

export async function findCategoryBySlug(slug) {
  const [doc] = await getCollection('categories')
    .aggregate([{ $match: { slug } }, ...withCounts(false)])
    .toArray();
  return toCategory(doc);
}

export async function createCategory(data) {
  await getCollection('categories').insertOne(toDocument(data));
  return findCategoryById(data.id);
}

export async function updateCategory(id, patch) {
  const set = {};
  for (const [field, value] of Object.entries(patch)) {
    const column = FIELD_BY_FIELD[field];
    if (!column) continue;
    set[column] = value === '' && (column === 'image_url' || column === 'image_public_id') ? null : value;
  }
  set.updated_at = new Date().toISOString();
  await getCollection('categories').updateOne({ id }, { $set: set });
  return findCategoryById(id);
}

export async function removeCategory(id) {
  const result = await getCollection('categories').deleteOne({ id });
  return result.deletedCount > 0;
}

export async function countProductsInCategory(id) {
  return getCollection('products').countDocuments({ category_id: id });
}

export async function countSubcategoriesInCategory(id) {
  return getCollection('subcategories').countDocuments({ category_id: id });
}
