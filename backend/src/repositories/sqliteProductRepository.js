import { getDb } from '../db/sqlite.js';

const SORT_SQL = {
  priority: 'p.star_priority DESC, p.created_at DESC',
  newest: 'p.created_at DESC',
  'price-asc': 'p.price_paise ASC, p.created_at DESC',
  'price-desc': 'p.price_paise DESC, p.created_at DESC',
  name: 'p.name COLLATE NOCASE ASC',
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
    pricePaise: row.price_paise,
    price: row.price_paise / 100,
    costPaise: row.cost_paise ?? 0,
    cost: (row.cost_paise ?? 0) / 100,
    stock: row.stock,
    unit: row.unit ?? '',
    inStock: row.stock > 0,
    categoryId: row.category_id,
    category: row.category_id ? { id: row.category_id, name: row.category_name, slug: row.category_slug } : null,
    subcategoryId: row.subcategory_id ?? null,
    subcategory: row.subcategory_id ? { id: row.subcategory_id, name: row.subcategory_name, slug: row.subcategory_slug } : null,
    active: Boolean(row.active),
    starPriority: row.star_priority,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function buildWhere(query = {}) {
  const clauses = [];
  const params = [];

  if (!query.includeInactive) clauses.push('p.active = 1');
  if (query.category) {
    clauses.push('(c.slug = ? OR c.id = ?)');
    params.push(query.category, query.category);
  }
  if (query.subcategory) {
    clauses.push('(s.slug = ? OR s.id = ?)');
    params.push(query.subcategory, query.subcategory);
  }
  if (query.q) {
    const like = `%${query.q}%`;
    clauses.push('(p.name LIKE ? OR p.brand LIKE ? OR p.description LIKE ?)');
    params.push(like, like, like);
  }
  if (query.minPricePaise !== undefined) {
    clauses.push('p.price_paise >= ?');
    params.push(query.minPricePaise);
  }
  if (query.maxPricePaise !== undefined) {
    clauses.push('p.price_paise <= ?');
    params.push(query.maxPricePaise);
  }
  if (query.inStock === true) clauses.push('p.stock > 0');

  return { sql: clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '', params };
}

function serialize(field, value) {
  if (field === 'images' || field === 'imagePublicIds') return JSON.stringify(value ?? []);
  if (field === 'active') return value ? 1 : 0;
  return value;
}

export async function listProducts(query = {}) {
  const where = buildWhere(query);
  const order = SORT_SQL[query.sort] || SORT_SQL.priority;
  const limit = query.limit ?? 12;
  const offset = ((query.page ?? 1) - 1) * limit;
  const rows = getDb().prepare(`${SELECT}${where.sql} ORDER BY ${order} LIMIT ? OFFSET ?`).all(...where.params, limit, offset);
  return rows.map(toProduct);
}

export async function countProducts(query = {}) {
  const where = buildWhere(query);
  const row = getDb()
    .prepare(`SELECT COUNT(*) AS total FROM products p LEFT JOIN categories c ON c.id = p.category_id LEFT JOIN subcategories s ON s.id = p.subcategory_id${where.sql}`)
    .get(...where.params);
  return row.total;
}

export async function findProductById(id) {
  return toProduct(getDb().prepare(`${SELECT} WHERE p.id = ?`).get(id));
}

export async function findProductBySlug(slug) {
  return toProduct(getDb().prepare(`${SELECT} WHERE p.slug = ?`).get(slug));
}

export async function createProduct(data) {
  const columns = ['id', ...Object.values(COLUMN_BY_FIELD), 'created_at', 'updated_at'];
  const values = [data.id, ...Object.keys(COLUMN_BY_FIELD).map((f) => serialize(f, data[f])), data.createdAt, data.updatedAt];
  const placeholders = columns.map(() => '?').join(', ');
  getDb().prepare(`INSERT INTO products (${columns.join(', ')}) VALUES (${placeholders})`).run(...values);
  return findProductById(data.id);
}

export async function updateProduct(id, patch) {
  const entries = Object.entries(patch).filter(([field]) => COLUMN_BY_FIELD[field]);
  if (!entries.length) return findProductById(id);
  const assignments = entries.map(([field]) => `${COLUMN_BY_FIELD[field]} = ?`);
  const values = entries.map(([field, value]) => serialize(field, value));
  values.push(new Date().toISOString(), id);
  getDb().prepare(`UPDATE products SET ${assignments.join(', ')}, updated_at = ? WHERE id = ?`).run(...values);
  return findProductById(id);
}

export async function removeProduct(id) {
  return getDb().prepare('DELETE FROM products WHERE id = ?').run(id).changes > 0;
}

export async function moveProductsToCategory(fromCategoryId, toCategoryId) {
  return getDb()
    .prepare('UPDATE products SET category_id = ?, updated_at = ? WHERE category_id = ?')
    .run(toCategoryId, new Date().toISOString(), fromCategoryId).changes;
}

export async function countProductsInCategory(categoryId, includeInactive = false) {
  const sql = includeInactive
    ? 'SELECT COUNT(*) AS total FROM products WHERE category_id = ?'
    : 'SELECT COUNT(*) AS total FROM products WHERE category_id = ? AND active = 1';
  return getDb().prepare(sql).get(categoryId).total;
}

export async function countProductsInSubcategory(subcategoryId, includeInactive = false) {
  const sql = includeInactive
    ? 'SELECT COUNT(*) AS total FROM products WHERE subcategory_id = ?'
    : 'SELECT COUNT(*) AS total FROM products WHERE subcategory_id = ? AND active = 1';
  return getDb().prepare(sql).get(subcategoryId).total;
}
