import { query } from '../db/postgres.js';

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

const ADMIN_SELECT = `
  SELECT s.*,
    c.name AS category_name,
    c.slug AS category_slug,
    (SELECT COUNT(*) FROM products p WHERE p.subcategory_id = s.id) AS product_count
  FROM subcategories s
  LEFT JOIN categories c ON c.id = s.category_id
`;

function toInt(value, fallback = 0) {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

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
    displayOrder: toInt(row.display_order),
    active: Boolean(toInt(row.active, 1)),
    productCount: toInt(row.product_count),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function serialize(field, value) {
  if (field === 'active') return value ? 1 : 0;
  if ((field === 'imageUrl' || field === 'imagePublicId') && value === '') return null;
  return value;
}

function buildWhere(queryObj = {}) {
  const clauses = [];
  const params = [];
  if (!queryObj.includeInactive) clauses.push('s.active = 1');
  if (queryObj.category) {
    clauses.push('(c.slug = $1 OR c.id = $2)');
    params.push(queryObj.category, queryObj.category);
  }
  return { sql: clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '', params };
}

export async function listSubcategories(queryObj = {}) {
  const where = buildWhere(queryObj);
  const sql = `${queryObj.includeInactive ? ADMIN_SELECT : SELECT}${where.sql} ORDER BY c.display_order ASC, s.display_order ASC, LOWER(s.name) ASC`;
  const { rows } = await query(sql, where.params);
  return rows.map(toSubcategory);
}

export async function findSubcategoryById(id) {
  const { rows } = await query(`${SELECT} WHERE s.id = $1`, [id]);
  return toSubcategory(rows[0]);
}

export async function findSubcategoryBySlug(slug) {
  const { rows } = await query(`${SELECT} WHERE s.slug = $1`, [slug]);
  return toSubcategory(rows[0]);
}

export async function createSubcategory(data) {
  const columns = ['id', ...Object.values(COLUMN_BY_FIELD), 'created_at', 'updated_at'];
  const values = [data.id, ...Object.keys(COLUMN_BY_FIELD).map((f) => serialize(f, data[f])), data.createdAt, data.updatedAt];
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
  await query(`INSERT INTO subcategories (${columns.join(', ')}) VALUES (${placeholders})`, values);
  return findSubcategoryById(data.id);
}

export async function updateSubcategory(id, patch) {
  const entries = Object.entries(patch).filter(([field]) => COLUMN_BY_FIELD[field]);
  if (!entries.length) return findSubcategoryById(id);
  const assignments = entries.map(([field], i) => `${COLUMN_BY_FIELD[field]} = $${i + 1}`);
  const values = entries.map(([field, value]) => serialize(field, value));
  values.push(new Date().toISOString(), id);
  await query(`UPDATE subcategories SET ${assignments.join(', ')}, updated_at = $${values.length - 1} WHERE id = $${values.length}`, values);
  return findSubcategoryById(id);
}

export async function removeSubcategory(id) {
  const { rowCount } = await query('DELETE FROM subcategories WHERE id = $1', [id]);
  return rowCount > 0;
}

export async function countProductsInSubcategory(id, includeInactive = false) {
  const sql = includeInactive
    ? 'SELECT COUNT(*) AS total FROM products WHERE subcategory_id = $1'
    : 'SELECT COUNT(*) AS total FROM products WHERE subcategory_id = $1 AND active = 1';
  const { rows } = await query(sql, [id]);
  return toInt(rows[0]?.total);
}

export async function moveProductsToSubcategory(fromSubcategoryId, toSubcategoryId) {
  const target = await findSubcategoryById(toSubcategoryId);
  if (!target) return 0;
  const { rowCount } = await query(
    'UPDATE products SET subcategory_id = $1, category_id = $2, updated_at = $3 WHERE subcategory_id = $4',
    [toSubcategoryId, target.categoryId, new Date().toISOString(), fromSubcategoryId],
  );
  return rowCount;
}

export async function moveSubcategoriesToCategory(fromCategoryId, toCategoryId) {
  const { rowCount } = await query(
    'UPDATE subcategories SET category_id = $1, updated_at = $2 WHERE category_id = $3',
    [toCategoryId, new Date().toISOString(), fromCategoryId],
  );
  return rowCount;
}
