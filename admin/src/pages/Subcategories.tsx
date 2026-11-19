import { FormEvent, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import type { Category, Subcategory } from '../types';
import { ConfirmDialog, ErrorNote, Loading, Toast } from '../components/States';
import Icon from '../components/Icon';
import ImagePicker, { type PendingImage } from '../components/ImagePicker';

type SubcategoryForm = {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  imagePublicId: string | null;
  displayOrder: number;
  active: boolean;
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function emptyForm(categoryId = ''): SubcategoryForm {
  return {
    id: crypto.randomUUID(),
    categoryId,
    name: '',
    slug: '',
    description: '',
    imageUrl: '',
    imagePublicId: null,
    displayOrder: 0,
    active: true,
  };
}

function toForm(subcategory: Subcategory): SubcategoryForm {
  return {
    id: subcategory.id,
    categoryId: subcategory.categoryId,
    name: subcategory.name,
    slug: subcategory.slug,
    description: subcategory.description ?? '',
    imageUrl: subcategory.imageUrl ?? '',
    imagePublicId: subcategory.imagePublicId ?? null,
    displayOrder: subcategory.displayOrder ?? 0,
    active: subcategory.active,
  };
}

export function SubcategoriesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get('category') ?? '');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SubcategoryForm>(emptyForm());
  const [images, setImages] = useState<PendingImage[]>([]);
  const [slugTouched, setSlugTouched] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Subcategory | null>(null);
  const [moveTarget, setMoveTarget] = useState('');

  async function load() {
    setError('');
    try {
      const [categoryData, subcategoryData] = await Promise.all([
        api.admin.categories(),
        api.admin.subcategories(),
      ]);
      setCategories(categoryData);
      setSubcategories(subcategoryData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load subcategories.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    setCategoryFilter(searchParams.get('category') ?? '');
  }, [searchParams]);

  function openCreate() {
    const selected = categories.find((item) => item.slug === categoryFilter || item.id === categoryFilter);
    setEditingId(null);
    setForm(emptyForm(selected?.id ?? categories[0]?.id ?? ''));
    setImages([]);
    setSlugTouched(false);
    setDrawerOpen(true);
  }

  function startEdit(subcategory: Subcategory) {
    setEditingId(subcategory.id);
    setForm(toForm(subcategory));
    setImages([]);
    setSlugTouched(true);
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setEditingId(null);
    setImages([]);
  }

  function changeName(value: string) {
    setForm((current) => ({
      ...current,
      name: value,
      slug: slugTouched ? current.slug : slugify(value),
    }));
  }

  function changeFormCategory(categoryId: string) {
    setForm((current) => ({ ...current, categoryId }));
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
      setError(err instanceof Error ? err.message : 'Unable to save subcategory.');
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const payload = {
      id: editingId ? undefined : form.id,
      categoryId: form.categoryId,
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
        if (images.length > 0) {
          const formData = new FormData();
          formData.append('image', images[0].file);
          const uploaded = await api.admin.uploadSubcategoryImage(formData);
          imageUrl = uploaded.url;
          imagePublicId = uploaded.publicId ?? null;
        }
        await api.admin.saveSubcategory({ ...payload, imageUrl, imagePublicId }, editingId ?? undefined);
      },
      editingId ? 'Subcategory updated.' : 'Subcategory created.',
    );
    if (ok) closeDrawer();
  }

  function askDelete(subcategory: Subcategory) {
    const fallback = subcategories.find((item) => item.id !== subcategory.id && item.categoryId === subcategory.categoryId)?.id
      ?? subcategories.find((item) => item.id !== subcategory.id)?.id
      ?? '';
    setDeleteTarget(subcategory);
    setMoveTarget(fallback);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const deleting = deleteTarget;
    const hasProducts = deleting.productCount > 0;
    const target = hasProducts ? moveTarget : undefined;
    setDeleteTarget(null);
    await run(
      () => api.admin.deleteSubcategory(deleting.id, target),
      hasProducts ? 'Subcategory deleted and its products moved.' : 'Subcategory deleted.',
    );
  }

  function applyCategoryFilter(value: string) {
    setCategoryFilter(value);
    const next = new URLSearchParams(searchParams);
    if (value) next.set('category', value); else next.delete('category');
    setSearchParams(next, { replace: true });
  }

  const filtered = subcategories.filter((subcategory) => {
    const category = categories.find((item) => item.slug === categoryFilter || item.id === categoryFilter);
    if (categoryFilter && subcategory.categoryId !== category?.id) return false;
    const haystack = `${subcategory.name} ${subcategory.category?.name ?? ''}`.toLowerCase();
    return haystack.includes(search.trim().toLowerCase());
  });

  return (
    <div className="page subcategories-page">
      <div className="page-heading-row">
        <div>
          <p className="eyebrow">Catalogue</p>
          <h1>Subcategories</h1>
          <p className="muted">Subcategories sit under a main category and contain products.</p>
        </div>
        <button className="button primary" type="button" onClick={openCreate}>
          <Icon name="plus" size={16} />
          Add subcategory
        </button>
      </div>

      {error && <ErrorNote message={error} />}
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
      {loading && <Loading label="Loading subcategories." />}

      <section className="panel table-panel">
        <div className="toolbar">
          <label className="search-field">
            <Icon name="search" size={16} />
            <input
              aria-label="Search subcategories"
              placeholder="Search subcategories."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <select aria-label="Main category" value={categoryFilter} onChange={(event) => applyCategoryFilter(event.target.value)}>
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.slug}>{category.name}</option>
            ))}
          </select>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Subcategory</th>
                <th>Main category</th>
                <th>Products</th>
                <th>Order</th>
                <th>Status</th>
                <th className="align-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((subcategory) => (
                <tr key={subcategory.id}>
                  <td>
                    <div className="table-product">
                      <span className="table-thumb category-thumb">
                        {subcategory.imageUrl ? <img src={subcategory.imageUrl} alt="" /> : <Icon name="grid" size={16} />}
                      </span>
                      <span>
                        <strong>{subcategory.name}</strong>
                        <small>/{subcategory.slug}</small>
                      </span>
                    </div>
                  </td>
                  <td>{subcategory.category?.name ?? '-'}</td>
                  <td>{subcategory.productCount}</td>
                  <td>{subcategory.displayOrder}</td>
                  <td>
                    <span className={subcategory.active ? 'status-pill in' : 'status-pill out'}>
                      {subcategory.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <Link className="icon-button" to={`/products?subcategory=${subcategory.slug}`} aria-label={`View products in ${subcategory.name}`}>
                        <Icon name="products" size={16} />
                      </Link>
                      <button className="icon-button" type="button" onClick={() => startEdit(subcategory)} aria-label={`Edit ${subcategory.name}`}>
                        <Icon name="edit" size={16} />
                      </button>
                      <button className="icon-button danger" type="button" onClick={() => askDelete(subcategory)} aria-label={`Delete ${subcategory.name}`}>
                        <Icon name="trash" size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6}><div className="empty-inline">No subcategories found.</div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {drawerOpen && (
        <div className="drawer-backdrop" onMouseDown={(event) => event.target === event.currentTarget && closeDrawer()}>
          <aside className="editor-drawer" role="dialog" aria-modal="true" aria-label={editingId ? 'Edit subcategory' : 'Add subcategory'}>
            <div className="drawer-header">
              <div>
                <h2>{editingId ? 'Edit subcategory' : 'New subcategory'}</h2>
                <p className="muted">Every product belongs to one subcategory.</p>
              </div>
              <button className="icon-button" type="button" onClick={closeDrawer} aria-label="Close">
                <Icon name="close" size={18} />
              </button>
            </div>

            <form className="drawer-form" onSubmit={submit}>
              {!editingId && (
                <label className="field">
                  <span>Subcategory ID (UUID)</span>
                  <input value={form.id} onChange={(event) => setForm({ ...form, id: event.target.value })} required />
                </label>
              )}
              <label className="field">
                <span>Main category</span>
                <select value={form.categoryId} onChange={(event) => changeFormCategory(event.target.value)} required>
                  <option value="">Choose category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
              </label>
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
                  images={images}
                  onChange={setImages}
                  savedImages={form.imageUrl ? [form.imageUrl] : []}
                  onRemoveSaved={() => setForm({ ...form, imageUrl: '', imagePublicId: null })}
                  hint="Shown on the customer subcategory listing."
                />
              </div>

              <label className="check-field">
                <input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} />
                <span>Active (visible to customers)</span>
              </label>

              <div className="drawer-footer">
                <button className="button ghost" type="button" onClick={closeDrawer}>Cancel</button>
                <button className="button primary" type="submit" disabled={saving}>
                  {saving ? 'Saving.' : editingId ? 'Save changes' : 'Create subcategory'}
                </button>
              </div>
            </form>
          </aside>
        </div>
      )}

      {deleteTarget && (
      <ConfirmDialog
        title="Delete subcategory?"
        message={
          deleteTarget && deleteTarget.productCount > 0
            ? `"${deleteTarget.name}" has ${deleteTarget.productCount} products. Move them to another subcategory before deleting.`
            : `"${deleteTarget?.name ?? 'This subcategory'}" will be removed. This cannot be undone.`
        }
        confirmLabel="Delete subcategory"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      >
        {deleteTarget && deleteTarget.productCount > 0 && (
          <label className="field confirm-field">
            <span>Move products to</span>
            <select value={moveTarget} onChange={(event) => setMoveTarget(event.target.value)}>
              {subcategories.filter((item) => item.id !== deleteTarget.id).map((item) => (
                <option key={item.id} value={item.id}>{item.name} ({item.category?.name ?? 'Category'})</option>
              ))}
            </select>
          </label>
        )}
      </ConfirmDialog>
      )}
    </div>
  );
}
