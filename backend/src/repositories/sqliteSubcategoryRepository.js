import { getDb } from '../db/sqlite.js';

const COLUMN_BY_FIELD = {
  categoryId: 'category_id',
  name: 'name',
  slug: 'slug',
  description: 'description',
  imageUrl: 'image_url',
  imagePublicId: 'image_public_id',
  displayOrder: 'display_order',
  active: 'active',
};

const SELECT = `
  SELECT s.*,
    c.name AS category_name,
    c.slug AS category_slug,
    (SELECT COUNT(*) FROM products p WHERE p.subcategory_id = s.id AND p.active = 1) AS product_count
  FROM subcategories s
  LEFT JOIN categories c ON c.id = s.category_id
`;

function toSubcategory(row) {
  if (!row) return null;
  return {
    id: row.id,
    categoryId: row.category_id,
    category: row.category_id ? { id: row.category_id, name: row.category_name, slug: row.category_slug } : null,
    name: row.name,
    slug: row.slug,
    description: row.description ?? '',
    imageUrl: row.image_url ?? null,
    imagePublicId: row.image_public_id ?? null,
    displayOrder: row.display_order ?? 0,
    active: Boolean(row.active),
    productCount: row.product_count ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function serialize(field, value) {
  if (field === 'active') return value ? 1 : 0;
  if ((field === 'imageUrl' || field === 'imagePublicId') && value === '') return null;
  return value;
}

function buildWhere(query = {}) {
  const clauses = [];
  const params = [];
  if (!query.includeInactive) clauses.push('s.active = 1');
  if (query.category) {
    clauses.push('(c.slug = ? OR c.id = ?)');
    params.push(query.category, query.category);
  }
  return { sql: clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '', params };
}

export async function listSubcategories(query = {}) {
  const where = buildWhere(query);
  const sql = `${SELECT}${where.sql} ORDER BY c.display_order ASC, s.display_order ASC, s.name COLLATE NOCASE ASC`;
  return getDb().prepare(sql).all(...where.params).map(toSubcategory);
}

export async function findSubcategoryById(id) {
  return toSubcategory(getDb().prepare(`${SELECT} WHERE s.id = ?`).get(id));
}

export async function findSubcategoryBySlug(slug) {
  return toSubcategory(getDb().prepare(`${SELECT} WHERE s.slug = ?`).get(slug));
}

export async function createSubcategory(data) {
  const columns = ['id', ...Object.values(COLUMN_BY_FIELD), 'created_at', 'updated_at'];
  const values = [data.id, ...Object.keys(COLUMN_BY_FIELD).map((f) => serialize(f, data[f])), data.createdAt, data.updatedAt];
  const placeholders = columns.map(() => '?').join(', ');
  getDb().prepare(`INSERT INTO subcategories (${columns.join(', ')}) VALUES (${placeholders})`).run(...values);
  return findSubcategoryById(data.id);
}

export async function updateSubcategory(id, patch) {
  const entries = Object.entries(patch).filter(([field]) => COLUMN_BY_FIELD[field]);
  if (!entries.length) return findSubcategoryById(id);
  const assignments = entries.map(([field]) => `${COLUMN_BY_FIELD[field]} = ?`);
  const values = entries.map(([field, value]) => serialize(field, value));
  values.push(new Date().toISOString(), id);
  getDb().prepare(`UPDATE subcategories SET ${assignments.join(', ')}, updated_at = ? WHERE id = ?`).run(...values);
  return findSubcategoryById(id);
}

export async function removeSubcategory(id) {
  return getDb().prepare('DELETE FROM subcategories WHERE id = ?').run(id).changes > 0;
}

export async function countProductsInSubcategory(id, includeInactive = false) {
  const sql = includeInactive
    ? 'SELECT COUNT(*) AS total FROM products WHERE subcategory_id = ?'
    : 'SELECT COUNT(*) AS total FROM products WHERE subcategory_id = ? AND active = 1';
  return getDb().prepare(sql).get(id).total;
}

export async function moveProductsToSubcategory(fromSubcategoryId, toSubcategoryId) {
  const target = await findSubcategoryById(toSubcategoryId);
  if (!target) return 0;
  return getDb()
    .prepare('UPDATE products SET subcategory_id = ?, category_id = ?, updated_at = ? WHERE subcategory_id = ?')
    .run(toSubcategoryId, target.categoryId, new Date().toISOString(), fromSubcategoryId).changes;
}

export async function moveSubcategoriesToCategory(fromCategoryId, toCategoryId) {
  return getDb()
    .prepare('UPDATE subcategories SET category_id = ?, updated_at = ? WHERE category_id = ?')
    .run(toCategoryId, new Date().toISOString(), fromCategoryId).changes;
}
