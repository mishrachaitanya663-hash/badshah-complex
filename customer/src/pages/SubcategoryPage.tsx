import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import type { ProductPage, Subcategory } from '../types';
import { toMessage } from '../utils';
import ProductCard from '../components/ProductCard';
import Icon from '../components/Icon';
import { EmptyState, ErrorNote, Loading } from '../components/States';

export default function SubcategoryPage() {
  const { slug = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const [subcategory, setSubcategory] = useState<Subcategory | null>(null);
  const [products, setProducts] = useState<ProductPage | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const sort = params.get('sort') || 'priority';
  const page = Number(params.get('page') || 1);

  useEffect(() => {
    let alive = true;
    setError('');
    setSubcategory(null);
    setLoading(true);

    Promise.all([
      api.subcategory(slug),
      api.products({ subcategory: slug, sort, page, limit: 12 }),
    ])
      .then(([found, result]) => {
        if (alive) {
          setSubcategory(found);
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
  }, [slug, sort, page]);

  function setSort(next: string) {
    const updated = new URLSearchParams(params);
    updated.set('sort', next);
    updated.delete('page');
    setParams(updated);
  }

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
        {subcategory?.category && (
          <>
            <Link to={`/categories/${subcategory.category.slug}`}>{subcategory.category.name}</Link>
            <Icon name="chevron" size={13} />
          </>
        )}
        <span>{subcategory?.name ?? slug}</span>
      </nav>

      {!subcategory ? (
        <Loading label="Loading subcategory…" />
      ) : (
        <>
          <div className="category-hero">
            <div className="category-image-placeholder large">
              <Icon name="grid" size={38} />
            </div>
            <div>
              <p className="eyebrow">Subcategory</p>
              <h1>{subcategory.name}</h1>
              <p className="muted">{subcategory.description || 'Browse products in this collection.'}</p>
              <span className="pill"><Icon name="products" size={13} /> {subcategory.productCount} products</span>
            </div>
          </div>

          <div className="results-bar">
            <span className="muted">{products ? `${products.total} products` : 'Loading…'}</span>
            <label className="sort-select">
              <span>Sort:</span>
              <select value={sort} onChange={(event) => setSort(event.target.value)}>
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
            <EmptyState>No products in this subcategory yet.</EmptyState>
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
