import { getDb } from '../db/sqlite.js';

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

function toCategory(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description ?? '',
    imageUrl: row.image_url ?? null,
    imagePublicId: row.image_public_id ?? null,
    displayOrder: row.display_order ?? 0,
    active: Boolean(row.active),
    productCount: row.product_count ?? 0,
    subcategoryCount: row.subcategory_count ?? 0,
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
  const sql = `${SELECT}${includeInactive ? '' : ' WHERE c.active = 1'} ORDER BY c.display_order ASC, c.name COLLATE NOCASE ASC`;
  return getDb().prepare(sql).all().map(toCategory);
}

export async function findCategoryById(id) {
  return toCategory(getDb().prepare(`${SELECT} WHERE c.id = ?`).get(id));
}

export async function findCategoryBySlug(slug) {
  return toCategory(getDb().prepare(`${SELECT} WHERE c.slug = ?`).get(slug));
}

export async function createCategory(data) {
  const columns = ['id', ...Object.values(COLUMN_BY_FIELD), 'created_at', 'updated_at'];
  const values = [data.id, ...Object.keys(COLUMN_BY_FIELD).map((f) => serialize(f, data[f])), data.createdAt, data.updatedAt];
  const placeholders = columns.map(() => '?').join(', ');
  getDb().prepare(`INSERT INTO categories (${columns.join(', ')}) VALUES (${placeholders})`).run(...values);
  return findCategoryById(data.id);
}

export async function updateCategory(id, patch) {
  const entries = Object.entries(patch).filter(([field]) => COLUMN_BY_FIELD[field]);
  if (!entries.length) return findCategoryById(id);
  const assignments = entries.map(([field]) => `${COLUMN_BY_FIELD[field]} = ?`);
  const values = entries.map(([field, value]) => serialize(field, value));
  values.push(new Date().toISOString(), id);
  getDb().prepare(`UPDATE categories SET ${assignments.join(', ')}, updated_at = ? WHERE id = ?`).run(...values);
  return findCategoryById(id);
}

export async function removeCategory(id) {
  return getDb().prepare('DELETE FROM categories WHERE id = ?').run(id).changes > 0;
}

export async function countProductsInCategory(id) {
  return getDb().prepare('SELECT COUNT(*) AS total FROM products WHERE category_id = ?').get(id).total;
}

export async function countSubcategoriesInCategory(id) {
  return getDb().prepare('SELECT COUNT(*) AS total FROM subcategories WHERE category_id = ?').get(id).total;
}
