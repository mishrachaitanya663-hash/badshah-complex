import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { Product } from '../types';
import { formatPrice, toMessage } from '../utils';
import ImageGallery from '../components/ImageGallery';
import ProductCard from '../components/ProductCard';
import Icon from '../components/Icon';
import { EmptyState, ErrorNote, Loading } from '../components/States';

export default function ProductDetail() {
  const { slug = '' } = useParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [related, setRelated] = useState<Product[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setError('');
    setProduct(null);
    setRelated([]);

    api.product(slug)
      .then(async (found) => {
        if (!alive) return;
        setProduct(found);
        const filter = found.subcategory?.slug
          ? { subcategory: found.subcategory.slug, limit: 5 }
          : found.category?.slug
            ? { category: found.category.slug, limit: 5 }
            : null;
        if (filter) {
          try {
            const page = await api.products(filter);
            if (alive) setRelated(page.items.filter((item) => item.id !== found.id).slice(0, 4));
          } catch {
            if (alive) setRelated([]);
          }
        }
      })
      .catch((reason: unknown) => {
        if (alive) setError(toMessage(reason));
      });

    return () => {
      alive = false;
    };
  }, [slug]);

  if (error) return <div className="page"><ErrorNote message={error} /></div>;
  if (!product) return <div className="page"><Loading label="Loading product…" /></div>;

  return (
    <div className="page">
      <nav className="breadcrumb">
        <Link to="/products">Products</Link>
        <Icon name="chevron" size={13} />
        {product.category && (
          <>
            <Link to={`/categories/${product.category.slug}`}>{product.category.name}</Link>
            <Icon name="chevron" size={13} />
          </>
        )}
        {product.subcategory && (
          <>
            <Link to={`/subcategories/${product.subcategory.slug}`}>{product.subcategory.name}</Link>
            <Icon name="chevron" size={13} />
          </>
        )}
        <span>{product.name}</span>
      </nav>

      <div className="detail-grid">
        <ImageGallery images={product.images} name={product.name} />

        <div className="detail-info">
          {product.subcategory ? (
            <Link className="eyebrow text-link" to={`/subcategories/${product.subcategory.slug}`}>
              {product.category?.name ?? 'Catalogue'} / {product.subcategory.name}
            </Link>
          ) : product.category ? (
            <Link className="eyebrow text-link" to={`/categories/${product.category.slug}`}>
              {product.category.name}
            </Link>
          ) : null}
          <h1>{product.name}</h1>
          {product.brand && <p className="muted">Brand: {product.brand}</p>}

          <div className="detail-meta">
            <strong className="price large">
              {formatPrice(product.price)}
              {product.unit ? <small className="unit"> / {product.unit}</small> : null}
            </strong>
            <span className={product.inStock ? 'stock-pill in' : 'stock-pill out'}>
              {product.inStock ? `${product.stock} in stock` : 'Out of stock'}
            </span>
          </div>

          {product.starPriority > 0 && (
            <p className="stars"><Icon name="star" size={15} /> Priority pick · {'★'.repeat(product.starPriority)}</p>
          )}

          <p className="detail-description">{product.description || 'No description provided for this product yet.'}</p>

          <div className="detail-actions">
            <a className="button primary" href="/#contact">
              Ask about this product <Icon name="arrow" size={16} />
            </a>
            <Link className="button ghost" to="/products">Back to products</Link>
          </div>
        </div>
      </div>

      <section className="section">
        <div className="section-head">
          <div>
            <p className="eyebrow">Keep browsing</p>
            <h2>More from this {product.subcategory ? 'subcategory' : 'category'}</h2>
          </div>
          {product.subcategory ? (
            <Link className="text-link" to={`/subcategories/${product.subcategory.slug}`}>View subcategory →</Link>
          ) : product.category ? (
            <Link className="text-link" to={`/categories/${product.category.slug}`}>View category →</Link>
          ) : null}
        </div>
        {related.length === 0 ? (
          <EmptyState>No related products to show right now.</EmptyState>
        ) : (
          <div className="product-grid">
            {related.map((item) => <ProductCard key={item.id} product={item} />)}
          </div>
        )}
      </section>
    </div>
  );
}
