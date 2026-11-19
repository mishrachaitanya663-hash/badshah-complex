import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, type ProductFilters } from '../api/client';
import type { Category, ProductPage, Subcategory } from '../types';
import { toMessage } from '../utils';
import ProductCard from '../components/ProductCard';
import Icon from '../components/Icon';
import { EmptyState, ErrorNote, LoadingGrid } from '../components/States';

type FilterForm = {
  q: string;
  category: string;
  subcategory: string;
  sort: string;
  inStock: boolean;
  minPrice: string;
  maxPrice: string;
};

function filtersFrom(params: URLSearchParams): ProductFilters {
  return {
    q: params.get('q') || undefined,
    category: params.get('category') || undefined,
    subcategory: params.get('subcategory') || undefined,
    sort: params.get('sort') || 'priority',
    inStock: params.get('inStock') === 'true' || undefined,
    minPrice: params.has('minPrice') ? Number(params.get('minPrice')) : undefined,
    maxPrice: params.has('maxPrice') ? Number(params.get('maxPrice')) : undefined,
    page: Number(params.get('page') || 1),
    limit: 12,
  };
}

export default function Products() {
  const [params, setParams] = useSearchParams();
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [data, setData] = useState<ProductPage | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [filterOpen, setFilterOpen] = useState(false);
  const [form, setForm] = useState<FilterForm>({
    q: params.get('q') || '',
    category: params.get('category') || '',
    subcategory: params.get('subcategory') || '',
    sort: params.get('sort') || 'priority',
    inStock: params.get('inStock') === 'true',
    minPrice: params.get('minPrice') || '',
    maxPrice: params.get('maxPrice') || '',
  });

  const paramKey = params.toString();

  useEffect(() => {
    Promise.all([api.categories(), api.subcategories()])
      .then(([categoryList, subcategoryList]) => {
        setCategories(categoryList);
        setSubcategories(subcategoryList);
      })
      .catch((reason: unknown) => setError(toMessage(reason)));
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api.products(filtersFrom(new URLSearchParams(paramKey)))
      .then((page) => {
        if (alive) {
          setData(page);
          setError('');
        }
      })
      .catch((reason: unknown) => {
        if (alive) setError(toMessage(reason));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [paramKey, categories]);

  function apply(event: FormEvent) {
    event.preventDefault();
    const next = new URLSearchParams();
    if (form.q.trim()) next.set('q', form.q.trim());
    if (form.category) next.set('category', form.category);
    if (form.subcategory) next.set('subcategory', form.subcategory);
    if (form.sort && form.sort !== 'priority') next.set('sort', form.sort);
    if (form.inStock) next.set('inStock', 'true');
    if (form.minPrice) next.set('minPrice', form.minPrice);
    if (form.maxPrice) next.set('maxPrice', form.maxPrice);
    setParams(next);
    setFilterOpen(false);
  }

  function clear() {
    setForm({ q: '', category: '', subcategory: '', sort: 'priority', inStock: false, minPrice: '', maxPrice: '' });
    setParams(new URLSearchParams());
  }

  function goTo(page: number) {
    const next = new URLSearchParams(paramKey);
    next.set('page', String(page));
    setParams(next);
  }

  const chips = [
    params.get('q') && { label: `Search: ${params.get('q')}`, key: 'q' },
    params.get('category') && {
      label: categories.find((category) => category.slug === params.get('category'))?.name ?? 'Category',
      key: 'category',
    },
    params.get('subcategory') && {
      label: subcategories.find((subcategory) => subcategory.slug === params.get('subcategory'))?.name ?? 'Subcategory',
      key: 'subcategory',
    },
    params.get('inStock') === 'true' && { label: 'In stock', key: 'inStock' },
    params.get('minPrice') && { label: `Min ₹${params.get('minPrice')}`, key: 'minPrice' },
    params.get('maxPrice') && { label: `Max ₹${params.get('maxPrice')}`, key: 'maxPrice' },
  ].filter(Boolean) as { label: string; key: string }[];

  function removeChip(key: string) {
    const next = new URLSearchParams(paramKey);
    next.delete(key);
    if (key === 'q') setForm((current) => ({ ...current, q: '' }));
    if (key === 'category') setForm((current) => ({ ...current, category: '', subcategory: '' }));
    if (key === 'subcategory') setForm((current) => ({ ...current, subcategory: '' }));
    if (key === 'inStock') setForm((current) => ({ ...current, inStock: false }));
    if (key === 'minPrice') setForm((current) => ({ ...current, minPrice: '' }));
    if (key === 'maxPrice') setForm((current) => ({ ...current, maxPrice: '' }));
    setParams(next);
  }

  return (
    <div className="page">
      <div className="page-heading">
        <p className="eyebrow">Catalogue</p>
        <h1>Shop products</h1>
        <p className="muted">Search, filter and sort the full Badshah Complex collection.</p>
      </div>

      <button className="button ghost small mobile-filter-toggle" type="button" onClick={() => setFilterOpen(!filterOpen)}>
        <Icon name="grid" size={15} /> {filterOpen ? 'Hide filters' : 'Show filters'}
      </button>

      <div className="catalog-layout">
        <aside className={`filter-panel${filterOpen ? ' open' : ''}`}>
          <div className="filter-head">
            <h2>Filters</h2>
            <button className="text-link" type="button" onClick={clear}>Clear</button>
          </div>
          <form className="filter-form" onSubmit={apply}>
            <label className="field">
              <span>Search</span>
              <input
                aria-label="Search products"
                placeholder="Name or brand…"
                value={form.q}
                onChange={(event) => setForm({ ...form, q: event.target.value })}
              />
            </label>
            <label className="field">
              <span>Category</span>
              <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value, subcategory: '' })}>
                <option value="">All categories</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.slug}>{category.name}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Subcategory</span>
              <select value={form.subcategory} onChange={(event) => setForm({ ...form, subcategory: event.target.value })}>
                <option value="">All subcategories</option>
                {subcategories
                  .filter((subcategory) => {
                    if (!form.category) return true;
                    const category = categories.find((item) => item.slug === form.category);
                    return subcategory.categoryId === category?.id;
                  })
                  .map((subcategory) => (
                    <option key={subcategory.id} value={subcategory.slug}>{subcategory.name}</option>
                  ))}
              </select>
            </label>
            <label className="field">
              <span>Sort by</span>
              <select value={form.sort} onChange={(event) => setForm({ ...form, sort: event.target.value })}>
                <option value="priority">Priority</option>
                <option value="newest">Newest</option>
                <option value="price-asc">Price: low to high</option>
                <option value="price-desc">Price: high to low</option>
                <option value="name">Name A–Z</option>
              </select>
            </label>
            <div className="field-row">
              <label className="field">
                <span>Min ₹</span>
                <input type="number" min="0" step="0.01" placeholder="0" value={form.minPrice} onChange={(event) => setForm({ ...form, minPrice: event.target.value })} />
              </label>
              <label className="field">
                <span>Max ₹</span>
                <input type="number" min="0" step="0.01" placeholder="Any" value={form.maxPrice} onChange={(event) => setForm({ ...form, maxPrice: event.target.value })} />
              </label>
            </div>
            <label className="checkbox">
              <input type="checkbox" checked={form.inStock} onChange={(event) => setForm({ ...form, inStock: event.target.checked })} />
              In stock only
            </label>
            <div className="filter-actions">
              <button className="button primary full" type="submit">Apply filters</button>
            </div>
          </form>
        </aside>

        <div className="catalog-results">
          <div className="results-bar">
            <span className="muted">
              {data ? `${data.total} product${data.total === 1 ? '' : 's'}` : 'Loading catalogue…'}
            </span>
            {data && data.pages > 1 && <span className="muted">Page {data.page} of {data.pages}</span>}
          </div>

          {chips.length > 0 && (
            <div className="active-chips">
              {chips.map((chip) => (
                <button className="chip" key={chip.key} type="button" onClick={() => removeChip(chip.key)}>
                  {chip.label} <Icon name="close" size={12} />
                </button>
              ))}
            </div>
          )}

          {error ? (
            <ErrorNote message={error} />
          ) : loading ? (
            <LoadingGrid />
          ) : !data || data.items.length === 0 ? (
            <EmptyState>No products match these filters. Try clearing a filter.</EmptyState>
          ) : (
            <>
              <div className="product-grid">
                {data.items.map((product) => <ProductCard key={product.id} product={product} />)}
              </div>
              {data.pages > 1 && (
                <div className="pagination">
                  <button className="button ghost small" disabled={data.page <= 1} onClick={() => goTo(data.page - 1)}>
                    Previous
                  </button>
                  <button className="button ghost small" disabled={data.page >= data.pages} onClick={() => goTo(data.page + 1)}>
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
