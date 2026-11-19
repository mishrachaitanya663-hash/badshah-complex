import { query } from '../db/postgres.js';

const SORT_SQL = {
  priority: 'p.star_priority DESC, p.created_at DESC',
  newest: 'p.created_at DESC',
  'price-asc': 'p.price_paise ASC, p.created_at DESC',
  'price-desc': 'p.price_paise DESC, p.created_at DESC',
  name: 'LOWER(p.name) ASC',
};

const COLUMN_BY_FIELD = {
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

const SELECT = `
  SELECT p.*,
    c.name AS category_name,
    c.slug AS category_slug,
    s.name AS subcategory_name,
    s.slug AS subcategory_slug
  FROM products p
  LEFT JOIN categories c ON c.id = p.category_id
  LEFT JOIN subcategories s ON s.id = p.subcategory_id
`;

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

function toProduct(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    brand: row.brand ?? '',
    description: row.description ?? '',
    images: parseJsonArray(row.images),
    imagePublicIds: parseJsonArray(row.image_public_ids),
    pricePaise: toInt(row.price_paise),
    price: toInt(row.price_paise) / 100,
    costPaise: toInt(row.cost_paise),
    cost: toInt(row.cost_paise) / 100,
    stock: toInt(row.stock),
    unit: row.unit ?? '',
    inStock: toInt(row.stock) > 0,
    categoryId: row.category_id,
    category: row.category_id ? { id: row.category_id, name: row.category_name, slug: row.category_slug } : null,
    subcategoryId: row.subcategory_id ?? null,
    subcategory: row.subcategory_id ? { id: row.subcategory_id, name: row.subcategory_name, slug: row.subcategory_slug } : null,
    active: Boolean(toInt(row.active, 1)),
    starPriority: toInt(row.star_priority),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function buildWhere(queryParams = {}) {
  const clauses = [];
  const params = [];
  let i = 1;
  const p = (v) => {
    params.push(v);
    return `$${i++}`;
  };

  if (!queryParams.includeInactive) clauses.push('p.active = 1');
  if (queryParams.category) {
    const a = p(queryParams.category);
    const b = p(queryParams.category);
    clauses.push(`(c.slug = ${a} OR c.id = ${b})`);
  }
  if (queryParams.subcategory) {
    const a = p(queryParams.subcategory);
    const b = p(queryParams.subcategory);
    clauses.push(`(s.slug = ${a} OR s.id = ${b})`);
  }
  if (queryParams.q) {
    const like = `%${queryParams.q}%`;
    const a = p(like);
    const b = p(like);
    const c = p(like);
    clauses.push(`(p.name ILIKE ${a} OR p.brand ILIKE ${b} OR p.description ILIKE ${c})`);
  }
  if (queryParams.minPricePaise !== undefined) clauses.push(`p.price_paise >= ${p(queryParams.minPricePaise)}`);
  if (queryParams.maxPricePaise !== undefined) clauses.push(`p.price_paise <= ${p(queryParams.maxPricePaise)}`);
  if (queryParams.inStock === true) clauses.push('p.stock > 0');

  return { sql: clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '', params, next: i };
}

function serialize(field, value) {
  if (field === 'images' || field === 'imagePublicIds') return JSON.stringify(value ?? []);
  if (field === 'active') return value ? 1 : 0;
  return value;
}

export async function listProducts(queryParams = {}) {
  const where = buildWhere(queryParams);
  const order = SORT_SQL[queryParams.sort] || SORT_SQL.priority;
  const limit = queryParams.limit ?? 12;
  const offset = ((queryParams.page ?? 1) - 1) * limit;
  const params = [...where.params, limit, offset];
  const sql = `${SELECT}${where.sql} ORDER BY ${order} LIMIT $${where.next} OFFSET $${where.next + 1}`;
  const { rows } = await query(sql, params);
  return rows.map(toProduct);
}

export async function countProducts(queryParams = {}) {
  const where = buildWhere(queryParams);
  const sql = `SELECT COUNT(*) AS total FROM products p LEFT JOIN categories c ON c.id = p.category_id LEFT JOIN subcategories s ON s.id = p.subcategory_id${where.sql}`;
  const { rows } = await query(sql, where.params);
  return toInt(rows[0]?.total);
}

export async function findProductById(id) {
  const { rows } = await query(`${SELECT} WHERE p.id = $1`, [id]);
  return toProduct(rows[0]);
}

export async function findProductBySlug(slug) {
  const { rows } = await query(`${SELECT} WHERE p.slug = $1`, [slug]);
  return toProduct(rows[0]);
}

export async function createProduct(data) {
  const columns = ['id', ...Object.values(COLUMN_BY_FIELD), 'created_at', 'updated_at'];
  const values = [data.id, ...Object.keys(COLUMN_BY_FIELD).map((f) => serialize(f, data[f])), data.createdAt, data.updatedAt];
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
  await query(`INSERT INTO products (${columns.join(', ')}) VALUES (${placeholders})`, values);
  return findProductById(data.id);
}

export async function updateProduct(id, patch) {
  const entries = Object.entries(patch).filter(([field]) => COLUMN_BY_FIELD[field]);
  if (!entries.length) return findProductById(id);
  const assignments = entries.map(([field], i) => `${COLUMN_BY_FIELD[field]} = $${i + 1}`);
  const values = entries.map(([field, value]) => serialize(field, value));
  values.push(new Date().toISOString(), id);
  const sql = `UPDATE products SET ${assignments.join(', ')}, updated_at = $${values.length - 1} WHERE id = $${values.length}`;
  await query(sql, values);
  return findProductById(id);
}

export async function removeProduct(id) {
  const { rowCount } = await query('DELETE FROM products WHERE id = $1', [id]);
  return rowCount > 0;
}

export async function moveProductsToCategory(fromCategoryId, toCategoryId) {
  const { rowCount } = await query(
    'UPDATE products SET category_id = $1, updated_at = $2 WHERE category_id = $3',
    [toCategoryId, new Date().toISOString(), fromCategoryId],
  );
  return rowCount;
}

export async function countProductsInCategory(categoryId, includeInactive = false) {
  const sql = includeInactive
    ? 'SELECT COUNT(*) AS total FROM products WHERE category_id = $1'
    : 'SELECT COUNT(*) AS total FROM products WHERE category_id = $1 AND active = 1';
  const { rows } = await query(sql, [categoryId]);
  return toInt(rows[0]?.total);
}

export async function countProductsInSubcategory(subcategoryId, includeInactive = false) {
  const sql = includeInactive
    ? 'SELECT COUNT(*) AS total FROM products WHERE subcategory_id = $1'
    : 'SELECT COUNT(*) AS total FROM products WHERE subcategory_id = $1 AND active = 1';
  const { rows } = await query(sql, [subcategoryId]);
  return toInt(rows[0]?.total);
}
