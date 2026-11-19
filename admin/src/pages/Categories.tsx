import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { Category } from '../types';
import { ConfirmDialog, ErrorNote, Loading, Toast } from '../components/States';
import Icon from '../components/Icon';
import ImagePicker, { type PendingImage } from '../components/ImagePicker';

type CategoryForm = {
  id: string;
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  imagePublicId: string | null;
  displayOrder: number;
  active: boolean;
};

const emptyForm: CategoryForm = {
  id: crypto.randomUUID(),
  name: '',
  slug: '',
  description: '',
  imageUrl: '',
  imagePublicId: null,
  displayOrder: 0,
  active: true,
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function toForm(category: Category): CategoryForm {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description ?? '',
    imageUrl: category.imageUrl ?? '',
    imagePublicId: category.imagePublicId ?? null,
    displayOrder: category.displayOrder ?? 0,
    active: category.active,
  };
}

export default function Categories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [search, setSearch] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CategoryForm>(emptyForm);
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [slugTouched, setSlugTouched] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [moveTarget, setMoveTarget] = useState('');

  async function load() {
    setError('');
    try {
      const data = await api.admin.categories();
      setCategories(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load categories.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function openCreate() {
    setEditingId(null);
    setForm({ ...emptyForm, id: crypto.randomUUID() });
    setPendingImages([]);
    setSlugTouched(false);
    setDrawerOpen(true);
  }

  function startEdit(category: Category) {
    setEditingId(category.id);
    setForm(toForm(category));
    setPendingImages([]);
    setSlugTouched(true);
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setEditingId(null);
    setPendingImages([]);
  }

  function changeName(value: string) {
    setForm((current) => ({
      ...current,
      name: value,
      slug: slugTouched ? current.slug : slugify(value),
    }));
  }

  async function run(action: () => Promise<unknown>, success: string) {
    setSaving(true);
    setError('');
    try {
      await action();
      setToast(success);
      await load();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save category.');
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const payload = {
      id: editingId ? undefined : form.id,
      name: form.name.trim(),
      slug: form.slug.trim(),
      description: form.description.trim(),
      imageUrl: form.imageUrl || null,
      imagePublicId: form.imagePublicId || null,
      displayOrder: Number(form.displayOrder) || 0,
      active: form.active,
    };

    const ok = await run(
      async () => {
        let imageUrl = payload.imageUrl;
        let imagePublicId = payload.imagePublicId;
        if (pendingImages.length > 0) {
          const fd = new FormData();
          fd.append('image', pendingImages[0].file);
          const uploaded = await api.admin.uploadCategoryImage(fd);
          imageUrl = uploaded.url;
          imagePublicId = uploaded.publicId ?? null;
        }
        await api.admin.saveCategory({ ...payload, imageUrl, imagePublicId }, editingId ?? undefined);
      },
      editingId ? 'Category updated.' : 'Category created.',
    );
    if (ok) closeDrawer();
  }

  function askDelete(category: Category) {
    const fallback = categories.find((item) => item.id !== category.id)?.id ?? '';
    setDeleteTarget(category);
    setMoveTarget(fallback);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const deleting = deleteTarget;
    const hasContent = deleting.productCount > 0 || deleting.subcategoryCount > 0;
    const target = hasContent ? moveTarget : undefined;
    setDeleteTarget(null);
    await run(
      () => api.admin.deleteCategory(deleting.id, target),
      hasContent ? 'Category deleted and its content moved.' : 'Category deleted.',
    );
  }

  const filtered = categories.filter((category) =>
    `${category.name} ${category.slug}`.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <div className="page categories-page">
      <div className="page-heading-row">
        <div>
          <p className="eyebrow">Catalogue</p>
          <h1>Categories</h1>
          <p className="muted">Main categories appear on the customer homepage and organise subcategories.</p>
        </div>
        <button className="button primary" type="button" onClick={openCreate}>
          <Icon name="plus" size={16} />
          Add category
        </button>
      </div>

      {error && <ErrorNote message={error} />}
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
      {loading && <Loading label="Loading categories." />}

      <section className="panel table-panel">
        <div className="toolbar">
          <label className="search-field">
            <Icon name="search" size={16} />
            <input
              aria-label="Search categories"
              placeholder="Search categories."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Subcategories</th>
                <th>Products</th>
                <th>Order</th>
                <th>Status</th>
                <th className="align-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((category) => (
                <tr key={category.id}>
                  <td>
                    <div className="table-product">
                      <span className="table-thumb category-thumb">
                        {category.imageUrl ? <img src={category.imageUrl} alt="" /> : <Icon name="categories" size={16} />}
                      </span>
                      <span>
                        <strong>{category.name}</strong>
                        <small>/{category.slug}</small>
                      </span>
                    </div>
                  </td>
                  <td>{category.subcategoryCount}</td>
                  <td>{category.productCount}</td>
                  <td>{category.displayOrder}</td>
                  <td>
                    <span className={category.active ? 'status-pill in' : 'status-pill out'}>
                      {category.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <Link className="icon-button" to={`/subcategories?category=${category.slug}`} aria-label={`View subcategories in ${category.name}`}>
                        <Icon name="grid" size={16} />
                      </Link>
                      <button className="icon-button" type="button" onClick={() => startEdit(category)} aria-label={`Edit ${category.name}`}>
                        <Icon name="edit" size={16} />
                      </button>
                      <button className="icon-button danger" type="button" onClick={() => askDelete(category)} aria-label={`Delete ${category.name}`}>
                        <Icon name="trash" size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6}><div className="empty-inline">No categories found.</div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {drawerOpen && (
        <div className="drawer-backdrop" onMouseDown={(event) => event.target === event.currentTarget && closeDrawer()}>
          <aside className="editor-drawer" role="dialog" aria-modal="true" aria-label={editingId ? 'Edit category' : 'Add category'}>
            <div className="drawer-header">
              <div>
                <h2>{editingId ? 'Edit category' : 'New category'}</h2>
                <p className="muted">Only active categories are shown to customers.</p>
              </div>
              <button className="icon-button" type="button" onClick={closeDrawer} aria-label="Close">
                <Icon name="close" size={18} />
              </button>
            </div>

            <form className="drawer-form" onSubmit={submit}>
              {!editingId && (
                <label className="field">
                  <span>Category ID (UUID)</span>
                  <input value={form.id} onChange={(event) => setForm({ ...form, id: event.target.value })} required />
                </label>
              )}
              <label className="field">
                <span>Name</span>
                <input value={form.name} onChange={(event) => changeName(event.target.value)} required />
              </label>
              <label className="field">
                <span>Slug</span>
                <input
                  value={form.slug}
                  onChange={(event) => {
                    setSlugTouched(true);
                    setForm({ ...form, slug: slugify(event.target.value) });
                  }}
                  required
                />
              </label>
              <label className="field">
                <span>Description</span>
                <textarea rows={4} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
              </label>
              <label className="field">
                <span>Display order</span>
                <input
                  type="number"
                  min={0}
                  value={form.displayOrder}
                  onChange={(event) => setForm({ ...form, displayOrder: Number(event.target.value) })}
                />
              </label>

              <div className="field">
                <span>Cover image</span>
                <ImagePicker
                  images={pendingImages}
                  onChange={setPendingImages}
                  savedImages={form.imageUrl ? [form.imageUrl] : []}
                  onRemoveSaved={() => setForm({ ...form, imageUrl: '', imagePublicId: null })}
                  maxImages={1}
                  hint="Shown on the customer homepage and category page."
                />
              </div>

              <label className="check-field">
                <input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} />
                <span>Active (visible to customers)</span>
              </label>

              <div className="drawer-footer">
                <button className="button ghost" type="button" onClick={closeDrawer}>Cancel</button>
                <button className="button primary" type="submit" disabled={saving}>
                  {saving ? 'Saving.' : editingId ? 'Save changes' : 'Create category'}
                </button>
              </div>
            </form>
          </aside>
        </div>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete category?"
          message={
            deleteTarget.productCount > 0 || deleteTarget.subcategoryCount > 0
              ? `"${deleteTarget.name}" has ${deleteTarget.subcategoryCount} subcategories and ${deleteTarget.productCount} products. Move them to another category before deleting.`
              : `"${deleteTarget.name}" will be removed. This cannot be undone.`
          }
          confirmLabel="Delete category"
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        >
          {(deleteTarget.productCount > 0 || deleteTarget.subcategoryCount > 0) && (
            <label className="field confirm-field">
              <span>Move content to</span>
              <select value={moveTarget} onChange={(event) => setMoveTarget(event.target.value)}>
                {categories.filter((item) => item.id !== deleteTarget.id).map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </label>
          )}
        </ConfirmDialog>
      )}
    </div>
  );
}
