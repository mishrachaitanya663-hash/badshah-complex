import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, type ProductInput } from '../api/client';
import type { Category, Product, ProductPage, Subcategory } from '../types';
import { ConfirmDialog, ErrorNote, Loading, Toast } from '../components/States';
import ImagePicker, { type PendingImage } from '../components/ImagePicker';
import Icon from '../components/Icon';
import { formatPrice, toMessage } from '../utils';

type ProductForm = {
  name: string;
  brand: string;
  description: string;
  price: string;
  cost: string;
  stock: string;
  unit: string;
  categoryId: string;
  subcategoryId: string;
  active: boolean;
  starPriority: string;
};

type Filters = {
  q: string;
  category: string;
  subcategory: string;
  status: 'all' | 'active' | 'inactive';
  stock: 'all' | 'in' | 'low' | 'out';
  sort: string;
};

type PendingAction = { title: string; message: string; run: () => void };

const emptyProductForm: ProductForm = {
  name: '',
  brand: '',
  description: '',
  price: '',
  cost: '',
  stock: '0',
  unit: '',
  categoryId: '',
  subcategoryId: '',
  active: true,
  starPriority: '0',
};

const emptyFilters: Filters = {
  q: '',
  category: '',
  subcategory: '',
  status: 'all',
  stock: 'all',
  sort: 'priority',
};
const pageSize = 10;

function toInput(product: Product): ProductInput {
  return {
    name: product.name,
    brand: product.brand,
    description: product.description,
    pricePaise: product.pricePaise,
    costPaise: product.costPaise,
    stock: product.stock,
    unit: product.unit,
    categoryId: product.category?.id ?? '',
    subcategoryId: product.subcategory?.id ?? '',
    active: product.active,
    starPriority: product.starPriority,
    images: product.images,
  };
}

export default function Products() {
  const [data, setData] = useState<ProductPage | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState<Filters>(() => ({
    ...emptyFilters,
    category: searchParams.get('category') ?? '',
    subcategory: searchParams.get('subcategory') ?? '',
    q: searchParams.get('q') ?? '',
  }));
  const [page, setPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyProductForm);
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [pending, setPending] = useState<PendingAction | null>(null);

  async function load() {
    const [next, categoryList, subcategoryList] = await Promise.all([
      api.admin.listProducts({
        q: filters.q.trim() || undefined,
        category: filters.category || undefined,
        subcategory: filters.subcategory || undefined,
        sort: filters.sort,
        limit: 60,
      }),
      api.admin.categories(),
      api.admin.subcategories(),
    ]);
    setData(next);
    setCategories(categoryList);
    setSubcategories(subcategoryList);
  }

  useEffect(() => {
    let alive = true;
    setLoading(true);
    load()
      .catch((reason: unknown) => {
        if (alive) setError(toMessage(reason));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [filters.q, filters.category, filters.subcategory, filters.sort]);

  useEffect(() => setPage(1), [filters.q, filters.category, filters.subcategory, filters.status, filters.stock, filters.sort]);

  useEffect(() => {
    const fromUrl = {
      category: searchParams.get('category') ?? '',
      subcategory: searchParams.get('subcategory') ?? '',
      q: searchParams.get('q') ?? '',
    };
    setFilters((current) => {
      if (
        current.category === fromUrl.category &&
        current.subcategory === fromUrl.subcategory &&
        current.q === fromUrl.q
      ) {
        return current;
      }
      return { ...current, ...fromUrl };
    });
  }, [searchParams]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (filters.q) next.set('q', filters.q);
    else next.delete('q');
    if (filters.category) next.set('category', filters.category);
    else next.delete('category');
    if (filters.subcategory) next.set('subcategory', filters.subcategory);
    else next.delete('subcategory');
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [filters.q, filters.category, filters.subcategory, searchParams, setSearchParams]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function run(action: () => Promise<unknown>, message: string) {
    setError('');
    setToast('');
    try {
      await action();
      setToast(message);
      await load();
      return true;
    } catch (reason) {
      setError(toMessage(reason));
      return false;
    }
  }

  function firstSubcategory(categoryId: string): string {
    return subcategories.find((subcategory) => subcategory.categoryId === categoryId)?.id ?? '';
  }

  function formSubcategoryOptions(): Subcategory[] {
    return subcategories.filter((subcategory) => subcategory.categoryId === form.categoryId);
  }

  function filterSubcategoryOptions(): Subcategory[] {
    const category = categories.find(
      (item) => item.slug === filters.category || item.id === filters.category,
    );
    if (!filters.category) return subcategories;
    return subcategories.filter((subcategory) => subcategory.categoryId === category?.id);
  }

  function openCreate() {
    const categoryId = categories[0]?.id ?? '';
    setEditingId(null);
    setForm({ ...emptyProductForm, categoryId, subcategoryId: firstSubcategory(categoryId) });
    setPendingImages([]);
    setError('');
    setDrawerOpen(true);
  }

  function startEdit(product: Product) {
    setEditingId(product.id);
    setForm({
      name: product.name,
      brand: product.brand,
      description: product.description,
      price: String(product.price),
      cost: String(product.cost),
      stock: String(product.stock),
      unit: product.unit,
      categoryId: product.category?.id ?? '',
      subcategoryId: product.subcategory?.id ?? '',
      active: product.active,
      starPriority: String(product.starPriority),
    });
    setPendingImages([]);
    setError('');
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setEditingId(null);
    setPendingImages([]);
    setError('');
  }

  function savedProductImages(): string[] {
    if (!editingId) return [];
    return data?.items.find((product) => product.id === editingId)?.images ?? [];
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const pricePaise = Math.round(Number(form.price) * 100);
      const costPaise = form.cost.trim() === '' ? 0 : Math.round(Number(form.cost) * 100);
      const stock = Number(form.stock);
      if (!form.subcategoryId) {
        setError('Choose a subcategory for this product.');
        return;
      }
      if (!form.unit.trim()) {
        setError('Enter the selling unit, for example bag, kg, tonne or piece.');
        return;
      }
      if (!Number.isFinite(pricePaise) || pricePaise < 0 || !Number.isFinite(costPaise) || costPaise < 0 || !Number.isInteger(stock) || stock < 0) {
        setError('Enter a valid selling price, cost price and stock quantity.');
        return;
      }

      const body: ProductInput = {
        name: form.name.trim(),
        brand: form.brand.trim(),
        description: form.description.trim(),
        pricePaise,
        costPaise,
        stock,
        unit: form.unit.trim(),
        categoryId: form.categoryId,
        subcategoryId: form.subcategoryId,
        active: form.active,
        starPriority: Number(form.starPriority),
        images: savedProductImages(),
      };

      const saved = await run(async () => {
        const result = await api.admin.saveProduct(body, editingId ?? undefined);
        if (pendingImages.length > 0) {
          const upload = new FormData();
          pendingImages.forEach((image) => upload.append('images', image.file));
          await api.admin.uploadImages(result.id, upload);
        }
      }, editingId ? 'Product updated.' : 'Product created.');

      if (saved) closeDrawer();
    } finally {
      setSaving(false);
    }
  }

  function askDelete(product: Product) {
    setPending({
      title: 'Delete product?',
      message: `"${product.name}" will be removed from the catalogue. This cannot be undone.`,
      run: () => {
        void run(() => api.admin.deleteProduct(product.id), 'Product deleted.');
      },
    });
  }

  async function toggleActive(product: Product) {
    await run(
      () => api.admin.saveProduct({ ...toInput(product), active: !product.active }, product.id),
      product.active ? 'Product hidden from customers.' : 'Product now visible.',
    );
  }

  async function removeImage(product: Product, index: number) {
    await run(() => api.admin.removeImage(product.id, index), 'Image removed.');
  }

  const allItems = data?.items ?? [];
  const visible = allItems.filter((product) => {
    if (filters.status === 'active' && !product.active) return false;
    if (filters.status === 'inactive' && product.active) return false;
    if (filters.stock === 'in' && product.stock <= 0) return false;
    if (filters.stock === 'out' && product.stock > 0) return false;
    if (filters.stock === 'low' && (product.stock <= 0 || product.stock > 10)) return false;
    return true;
  });
  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const rows = visible.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const activeChips = [
    filters.q && { label: `“${filters.q}”`, clear: () => setFilters({ ...filters, q: '' }) },
    filters.category && {
      label: categories.find((category) => category.slug === filters.category || category.id === filters.category)?.name ?? 'Category',
      clear: () => setFilters({ ...filters, category: '', subcategory: '' }),
    },
    filters.subcategory && {
      label: subcategories.find((subcategory) => subcategory.slug === filters.subcategory || subcategory.id === filters.subcategory)?.name ?? 'Subcategory',
      clear: () => setFilters({ ...filters, subcategory: '' }),
    },
    filters.status !== 'all' && { label: filters.status, clear: () => setFilters({ ...filters, status: 'all' }) },
    filters.stock !== 'all' && {
      label: filters.stock === 'low' ? 'Low stock' : filters.stock === 'out' ? 'Out of stock' : 'In stock',
      clear: () => setFilters({ ...filters, stock: 'all' }),
    },
  ].filter(Boolean) as { label: string; clear: () => void }[];

  return (
    <div className="page products-page">
      <div className="page-heading-row">
        <div>
          <p className="eyebrow">Catalogue</p>
          <h1>Products</h1>
          <p className="muted">Manage real product details, pricing, stock and storefront visibility.</p>
        </div>
        <button className="button primary" type="button" onClick={openCreate}>
          <Icon name="plus" size={16} />
          Add product
        </button>
      </div>

      {error && <ErrorNote message={error} />}
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
      {loading && <Loading label="Loading products…" />}

      <section className="panel table-panel">
        <div className="toolbar">
          <label className="search-field">
            <Icon name="search" size={16} />
            <input
              aria-label="Search products"
              placeholder="Search name or brand…"
              value={filters.q}
              onChange={(event) => setFilters({ ...filters, q: event.target.value })}
            />
          </label>
          <select
            aria-label="Category"
            value={filters.category}
            onChange={(event) => setFilters({ ...filters, category: event.target.value, subcategory: '' })}
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.slug}>{category.name}</option>
            ))}
          </select>
          <select
            aria-label="Subcategory"
            value={filters.subcategory}
            onChange={(event) => setFilters({ ...filters, subcategory: event.target.value })}
          >
            <option value="">All subcategories</option>
            {filterSubcategoryOptions().map((subcategory) => (
              <option key={subcategory.id} value={subcategory.slug}>{subcategory.name}</option>
            ))}
          </select>
          <select
            aria-label="Sort"
            value={filters.sort}
            onChange={(event) => setFilters({ ...filters, sort: event.target.value })}
          >
            <option value="priority">Priority first</option>
            <option value="newest">Newest</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
            <option value="name">Name A–Z</option>
          </select>
          <button className="button ghost" type="button" onClick={() => setFiltersOpen(!filtersOpen)}>
            <Icon name="grid" size={15} />
            More filters
          </button>
        </div>

        {filtersOpen && (
          <div className="filter-drawer-inline">
            <label className="field">
              <span>Status</span>
              <select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value as Filters['status'] })}>
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
            <label className="field">
              <span>Stock</span>
              <select value={filters.stock} onChange={(event) => setFilters({ ...filters, stock: event.target.value as Filters['stock'] })}>
                <option value="all">All</option>
                <option value="in">In stock</option>
                <option value="low">Low stock (1–10)</option>
                <option value="out">Out of stock</option>
              </select>
            </label>
            <button className="button ghost" type="button" onClick={() => setFilters(emptyFilters)}>
              Clear all
            </button>
          </div>
        )}

        {activeChips.length > 0 && (
          <div className="filter-chips">
            {activeChips.map((chip) => (
              <button className="filter-chip" key={chip.label} type="button" onClick={chip.clear}>
                {chip.label} <Icon name="close" size={12} />
              </button>
            ))}
          </div>
        )}

        <div className="table-meta">
          <span>{visible.length} of {allItems.length} products</span>
          <span className="muted">Page {currentPage} / {pageCount}</span>
        </div>

        <div className="table-wrap">
          <table className="data-table product-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th>Price</th>
                <th>Cost / Profit</th>
                <th>Stock</th>
                <th>Priority</th>
                <th>Status</th>
                <th className="align-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((product) => (
                <tr key={product.id}>
                  <td>
                    <div className="table-product">
                      {product.images[0] ? <img src={product.images[0]} alt="" /> : <span className="table-thumb">BC</span>}
                      <span>
                        <strong>{product.name}</strong>
                        <small>{product.subcategory?.name ?? 'No subcategory'}</small>
                      </span>
                    </div>
                  </td>
                  <td>
                    <strong>{product.category?.name ?? 'Uncategorised'}</strong>
                    <small className="table-subtext">{product.subcategory?.name ?? 'No subcategory'}</small>
                  </td>
                  <td><strong>{formatPrice(product.price)}</strong><small className="table-subtext">per {product.unit || 'unit'}</small></td>
                  <td><strong>{formatPrice(product.cost)}</strong><small className="table-subtext">profit {formatPrice(product.price - product.cost)}</small></td>
                  <td>
                    <span className={product.stock === 0 ? 'stock-text out' : product.stock <= 10 ? 'stock-text low' : 'stock-text'}>
                      {product.stock}
                    </span>
                  </td>
                  <td>
                    <span className="stars-mini">{product.starPriority ? '★'.repeat(product.starPriority) : '—'}</span>
                  </td>
                  <td>
                    <button className="switch-row" type="button" onClick={() => void toggleActive(product)} aria-label="Toggle active state">
                      <span className={product.active ? 'switch on' : 'switch'}><i /></span>
                      <span>{product.active ? 'Active' : 'Inactive'}</span>
                    </button>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button className="icon-button" type="button" onClick={() => startEdit(product)} aria-label={`Edit ${product.name}`}>
                        <Icon name="edit" size={16} />
                      </button>
                      <button className="icon-button danger" type="button" onClick={() => askDelete(product)} aria-label={`Delete ${product.name}`}>
                        <Icon name="trash" size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={8}><div className="empty-inline">No products match these filters.</div></td></tr>
              )}
            </tbody>
          </table>
        </div>

        {pageCount > 1 && (
          <div className="pagination admin-pagination">
            <button className="button ghost small" type="button" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>
              Previous
            </button>
            <span className="muted">{currentPage} / {pageCount}</span>
            <button className="button ghost small" type="button" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}>
              Next
            </button>
          </div>
        )}
      </section>

      {drawerOpen && (
        <div className="drawer-backdrop" onMouseDown={(event) => event.target === event.currentTarget && closeDrawer()}>
          <aside className="editor-drawer" role="dialog" aria-modal="true" aria-label={editingId ? 'Edit product' : 'Add product'}>
            <div className="drawer-head">
              <div>
                <p className="eyebrow">Product editor</p>
                <h2>{editingId ? 'Edit product' : 'Add product'}</h2>
              </div>
              <button className="icon-button" type="button" onClick={closeDrawer} aria-label="Close editor">
                <Icon name="close" />
              </button>
            </div>

            <form className="drawer-body" onSubmit={submit} id="product-form">
              <section className="form-section">
                <h3>Basic details</h3>
                <div className="field-row">
                  <label className="field">
                    <span>Product name</span>
                    <input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
                  </label>
                  <label className="field">
                    <span>Brand</span>
                    <input value={form.brand} onChange={(event) => setForm({ ...form, brand: event.target.value })} />
                  </label>
                </div>
                <div className="field-row">
                  <label className="field">
                    <span>Category</span>
                    <select
                      required
                      value={form.categoryId}
                      onChange={(event) => {
                        const categoryId = event.target.value;
                        setForm((current) => ({ ...current, categoryId, subcategoryId: firstSubcategory(categoryId) }));
                      }}
                    >
                      <option value="">Select…</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>{category.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Subcategory</span>
                    <select required value={form.subcategoryId} onChange={(event) => setForm({ ...form, subcategoryId: event.target.value })}>
                      <option value="">Select…</option>
                      {formSubcategoryOptions().map((subcategory) => (
                        <option key={subcategory.id} value={subcategory.id}>{subcategory.name}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="field">
                  <span>Description</span>
                  <textarea rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
                </label>
              </section>

              <section className="form-section">
                <h3>Pricing & stock</h3>
                <div className="field-row">
                  <label className="field">
                    <span>Price (₹)</span>
                    <div className="input-prefix"><span>₹</span><input required type="number" min="0" step="0.01" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} /></div>
                  </label>
                  <label className="field">
                    <span>Selling unit</span>
                    <input required value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} placeholder="e.g. bag, kg, tonne, piece" />
                  </label>
                </div>
                <div className="field-row">
                  <label className="field">
                    <span>Cost price / CP (₹)</span>
                    <div className="input-prefix"><span>₹</span><input type="number" min="0" step="0.01" value={form.cost} onChange={(event) => setForm({ ...form, cost: event.target.value })} /></div>
                  </label>
                  <label className="field">
                    <span>Profit per unit (₹)</span>
                    <div className="input-prefix"><span>₹</span><input readOnly value={((Number(form.price) || 0) - (Number(form.cost) || 0)).toFixed(2)} /></div>
                  </label>
                </div>
                <p className="field-hint">CP is private — only admins see it. Customers never see your cost price.</p>
                <div className="field-row">
                  <label className="field">
                    <span>Stock quantity</span>
                    <div className="stepper">
                      <button type="button" onClick={() => setForm({ ...form, stock: String(Math.max(0, Number(form.stock) - 1)) })}>−</button>
                      <input required type="number" min="0" step="1" value={form.stock} onChange={(event) => setForm({ ...form, stock: event.target.value })} />
                      <button type="button" onClick={() => setForm({ ...form, stock: String(Number(form.stock) + 1) })}>+</button>
                    </div>
                  </label>
                </div>
                <p className="field-hint">Customers see this product as in stock while quantity is above zero.</p>
              </section>

              <section className="form-section">
                <h3>Merchandising</h3>
                <div className="field">
                  <span>Star priority</span>
                  <div className="segmented">
                    {[0, 1, 2, 3].map((level) => (
                      <button
                        type="button"
                        key={level}
                        className={Number(form.starPriority) === level ? 'active' : ''}
                        onClick={() => setForm({ ...form, starPriority: String(level) })}
                      >
                        {level === 0 ? 'None' : '★'.repeat(level)}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="switch-field">
                  <span className={form.active ? 'switch on' : 'switch'}><i /></span>
                  <input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} />
                  <span><strong>Active on customer site</strong><small>Hide the product by switching this off.</small></span>
                </label>
              </section>

              <section className="form-section">
                <h3>Product images</h3>
                <ImagePicker
                  images={pendingImages}
                  onChange={setPendingImages}
                  multiple
                  maxImages={8}
                  hint="Camera or gallery — tap again to add more. Up to 8 images per product."
                  savedImages={savedProductImages()}
                  onRemoveSaved={(index) => {
                    const product = data?.items.find((item) => item.id === editingId);
                    if (product) void removeImage(product, index);
                  }}
                />
              </section>
            </form>

            <div className="drawer-foot">
              <button className="button ghost" type="button" onClick={closeDrawer}>Cancel</button>
              <button className="button primary" type="submit" form="product-form" disabled={saving}>
                {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add product'}
              </button>
            </div>
          </aside>
        </div>
      )}

      {pending && (
        <ConfirmDialog
          title={pending.title}
          message={pending.message}
          onCancel={() => setPending(null)}
          onConfirm={() => {
            pending.run();
            setPending(null);
          }}
        />
      )}
    </div>
  );
}
