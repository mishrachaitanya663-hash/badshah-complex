import { Link } from 'react-router-dom';
import Icon from './Icon';
import type { Product } from '../types';
import { formatPrice } from '../utils';

export default function ProductCard({ product }: { product: Product }) {
  return (
    <article className="product-card">
      <Link to={`/products/${product.slug}`} className="product-card-media">
        {product.images[0] ? (
          <img src={product.images[0]} alt={product.name} loading="lazy" />
        ) : (
          <div className="image-placeholder">
            <span className="placeholder-mark"><Icon name="products" size={22} /></span>
            <span>Image coming soon</span>
          </div>
        )}
        {product.starPriority > 0 && (
          <span className="priority-badge" title={`Priority ${product.starPriority}`}>
            <Icon name="star" size={12} /> {product.starPriority}
          </span>
        )}
      </Link>
      <div className="product-card-body">
        <p className="eyebrow">{product.category?.name ?? 'Uncategorised'}</p>
        <h3>
          <Link to={`/products/${product.slug}`}>{product.name}</Link>
        </h3>
        {product.brand && <p className="muted">{product.brand}</p>}
        <div className="product-card-foot">
          <strong className="price">
            {formatPrice(product.price)}
            {product.unit ? <small className="unit"> / {product.unit}</small> : null}
          </strong>
          <span className={product.inStock ? 'stock-pill in' : 'stock-pill out'}>
            {product.inStock ? `${product.stock} in stock` : 'Out of stock'}
          </span>
        </div>
        <Link className="details-button" to={`/products/${product.slug}`}>
          View details <Icon name="arrow" size={14} />
        </Link>
      </div>
    </article>
  );
}
