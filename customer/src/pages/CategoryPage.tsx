import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import type { Category, ProductPage, Subcategory } from '../types';
import { toMessage } from '../utils';
import ProductCard from '../components/ProductCard';
import Icon from '../components/Icon';
import { EmptyState, ErrorNote, Loading } from '../components/States';

function setParam(params: URLSearchParams, key: string, value: string, setParams: (next: URLSearchParams) => void) {
  const updated = new URLSearchParams(params);
  if (value) updated.set(key, value);
  else updated.delete(key);
  updated.delete('page');
  setParams(updated);
}

export default function CategoryPage() {
  const { slug = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const [category, setCategory] = useState<Category | null>(null);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [products, setProducts] = useState<ProductPage | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const sort = params.get('sort') || 'priority';
  const page = Number(params.get('page') || 1);
  const subcategory = params.get('subcategory') || '';

  useEffect(() => {
    let alive = true;
    setError('');
    setCategory(null);
    setLoading(true);

    Promise.all([
      api.category(slug),
      api.subcategories({ category: slug }),
      api.products({ category: slug, subcategory: subcategory || undefined, sort, page, limit: 12 }),
    ])
      .then(([found, children, result]) => {
        if (alive) {
          setCategory(found);
          setSubcategories(children);
          setProducts(result);
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
  }, [slug, sort, page, subcategory]);

  function goTo(nextPage: number) {
    const updated = new URLSearchParams(params);
    updated.set('page', String(nextPage));
    setParams(updated);
  }

  if (error) return <div className="page"><ErrorNote message={error} /></div>;

  return (
    <div className="page">
      <nav className="breadcrumb">
        <Link to="/categories">Categories</Link>
        <Icon name="chevron" size={13} />
        <span>{category?.name ?? slug}</span>
      </nav>

      {!category ? (
        <Loading label="Loading category…" />
      ) : (
        <>
          <div className="category-hero">
            <div className="category-image-placeholder large">
              {category.imageUrl ? <img src={category.imageUrl} alt="" /> : <Icon name="grid" size={38} />}
            </div>
            <div>
              <p className="eyebrow">Category</p>
              <h1>{category.name}</h1>
              <p className="muted">{category.description || 'Browse products in this collection.'}</p>
              <span className="pill"><Icon name="products" size={13} /> {category.productCount} products</span>
            </div>
          </div>

          {subcategories.length > 0 && (
            <section className="section compact-section">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Browse</p>
                  <h2>Subcategories</h2>
                  <p className="muted">Choose a subcategory to narrow the list.</p>
                </div>
              </div>
              <div className="subcategory-grid">
                {subcategories.map((item) => (
                  <Link key={item.id} className="subcategory-card" to={`/subcategories/${item.slug}`}>
                    <div className="category-image-placeholder small">
                      {item.imageUrl ? <img src={item.imageUrl} alt="" /> : <Icon name="grid" size={22} />}
                    </div>
                    <span>
                      <strong>{item.name}</strong>
                      <small>{item.productCount} products</small>
                    </span>
                    <Icon name="chevron" size={15} />
                  </Link>
                ))}
              </div>
            </section>
          )}

          <div className="results-bar">
            <span className="muted">{products ? `${products.total} products` : 'Loading…'}</span>
            {subcategories.length > 0 && (
              <label className="sort-select">
                <span>Subcategory:</span>
                <select value={subcategory} onChange={(event) => setParam(params, 'subcategory', event.target.value, setParams)}>
                  <option value="">All subcategories</option>
                  {subcategories.map((item) => (
                    <option key={item.id} value={item.slug}>{item.name}</option>
                  ))}
                </select>
              </label>
            )}
            <label className="sort-select">
              <span>Sort:</span>
              <select value={sort} onChange={(event) => setParam(params, 'sort', event.target.value, setParams)}>
                <option value="priority">Priority</option>
                <option value="newest">Newest</option>
                <option value="price-asc">Price: low to high</option>
                <option value="price-desc">Price: high to low</option>
                <option value="name">Name A–Z</option>
              </select>
            </label>
          </div>

          {loading ? (
            <Loading label="Loading products…" />
          ) : !products || products.items.length === 0 ? (
            <EmptyState>No products in this selection yet.</EmptyState>
          ) : (
            <>
              <div className="product-grid">
                {products.items.map((product) => <ProductCard key={product.id} product={product} />)}
              </div>
              {products.pages > 1 && (
                <div className="pagination">
                  <button className="button ghost small" disabled={products.page <= 1} onClick={() => goTo(products.page - 1)}>
                    Previous
                  </button>
                  <span className="muted">{products.page} / {products.pages}</span>
                  <button className="button ghost small" disabled={products.page >= products.pages} onClick={() => goTo(products.page + 1)}>
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
