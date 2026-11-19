import { query } from '../db/postgres.js';

const COLUMN_BY_FIELD = {
  name: 'name',
  slug: 'slug',
  description: 'description',
  imageUrl: 'image_url',
  imagePublicId: 'image_public_id',
  displayOrder: 'display_order',
  active: 'active',
};

const SELECT = `
  SELECT c.*,
    (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.active = 1) AS product_count,
    (SELECT COUNT(*) FROM subcategories s WHERE s.category_id = c.id AND s.active = 1) AS subcategory_count
  FROM categories c
`;

function toInt(value, fallback = 0) {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toCategory(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description ?? '',
    imageUrl: row.image_url ?? null,
    imagePublicId: row.image_public_id ?? null,
    displayOrder: toInt(row.display_order),
    active: Boolean(toInt(row.active, 1)),
    productCount: toInt(row.product_count),
    subcategoryCount: toInt(row.subcategory_count),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function serialize(field, value) {
  if (field === 'active') return value ? 1 : 0;
  if ((field === 'imageUrl' || field === 'imagePublicId') && value === '') return null;
  return value;
}

export async function listCategories({ includeInactive = false } = {}) {
  const sql = `${SELECT}${includeInactive ? '' : ' WHERE c.active = 1'} ORDER BY c.display_order ASC, LOWER(c.name) ASC`;
  const { rows } = await query(sql);
  return rows.map(toCategory);
}

export async function findCategoryById(id) {
  const { rows } = await query(`${SELECT} WHERE c.id = $1`, [id]);
  return toCategory(rows[0]);
}

export async function findCategoryBySlug(slug) {
  const { rows } = await query(`${SELECT} WHERE c.slug = $1`, [slug]);
  return toCategory(rows[0]);
}

export async function createCategory(data) {
  const columns = ['id', ...Object.values(COLUMN_BY_FIELD), 'created_at', 'updated_at'];
  const values = [data.id, ...Object.keys(COLUMN_BY_FIELD).map((f) => serialize(f, data[f])), data.createdAt, data.updatedAt];
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
  await query(`INSERT INTO categories (${columns.join(', ')}) VALUES (${placeholders})`, values);
  return findCategoryById(data.id);
}

export async function updateCategory(id, patch) {
  const entries = Object.entries(patch).filter(([field]) => COLUMN_BY_FIELD[field]);
  if (!entries.length) return findCategoryById(id);
  const assignments = entries.map(([field], i) => `${COLUMN_BY_FIELD[field]} = $${i + 1}`);
  const values = entries.map(([field, value]) => serialize(field, value));
  values.push(new Date().toISOString(), id);
  await query(`UPDATE categories SET ${assignments.join(', ')}, updated_at = $${values.length - 1} WHERE id = $${values.length}`, values);
  return findCategoryById(id);
}

export async function removeCategory(id) {
  const { rowCount } = await query('DELETE FROM categories WHERE id = $1', [id]);
  return rowCount > 0;
}

export async function countProductsInCategory(id) {
  const { rows } = await query('SELECT COUNT(*) AS total FROM products WHERE category_id = $1', [id]);
  return toInt(rows[0]?.total);
}

export async function countSubcategoriesInCategory(id) {
  const { rows } = await query('SELECT COUNT(*) AS total FROM subcategories WHERE category_id = $1', [id]);
  return toInt(rows[0]?.total);
}
