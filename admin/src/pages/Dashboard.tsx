import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { Product, Stats } from '../types';
import { ErrorNote, Loading } from '../components/States';
import Icon from '../components/Icon';
import { formatPrice, toMessage } from '../utils';

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    Promise.all([api.admin.stats(), api.admin.products()])
      .then(([nextStats, page]) => {
        if (alive) {
          setStats(nextStats);
          setProducts(page.items);
        }
      })
      .catch((reason: unknown) => {
        if (alive) setError(toMessage(reason));
      });
    return () => {
      alive = false;
    };
  }, []);

  if (error) return <div className="page"><ErrorNote message={error} /></div>;
  if (!stats) return <div className="page"><Loading label="Loading overview…" /></div>;

  const lowStock = products.filter((product) => product.stock > 0 && product.stock <= 10).length;
  const priorityCounts = [0, 1, 2, 3].map(
    (level) => products.filter((product) => product.starPriority === level).length,
  );
  const topProducts = [...products]
    .sort((a, b) => b.price * b.stock - a.price * a.stock)
    .slice(0, 5);
  const percent = (value: number, total: number) => (total ? Math.round((value / total) * 100) : 0);

  return (
    <div className="page dashboard-page">
      <div className="dash-head">
        <div>
          <p className="eyebrow">Overview</p>
          <h1>Dashboard</h1>
          <p className="muted">A live snapshot of your catalogue and inventory.</p>
        </div>
        <div className="dash-actions">
          <a className="button ghost" href="/">
            <Icon name="external" size={16} />
            View store
          </a>
          <Link className="button primary" to="/products">
            <Icon name="plus" size={16} />
            Add product
          </Link>
        </div>
      </div>

      <div className="kpi-grid">
        <Link className="kpi-card" to="/products">
          <span className="kpi-icon"><Icon name="products" /></span>
          <span className="kpi-label">Total products</span>
          <strong>{stats.products}</strong>
          <small>{stats.activeProducts} live · {stats.inactiveProducts} hidden</small>
        </Link>
        <Link className="kpi-card" to="/subcategories">
          <span className="kpi-icon"><Icon name="grid" /></span>
          <span className="kpi-label">Subcategories</span>
          <strong>{stats.subcategories}</strong>
          <small>{stats.activeSubcategories} visible to customers</small>
        </Link>
        <Link className="kpi-card" to="/categories">
          <span className="kpi-icon"><Icon name="categories" /></span>
          <span className="kpi-label">Categories</span>
          <strong>{stats.categories}</strong>
          <small>{stats.activeCategories} visible to customers</small>
        </Link>
        <div className="kpi-card">
          <span className="kpi-icon"><Icon name="chart" /></span>
          <span className="kpi-label">Stock units</span>
          <strong>{stats.totalStock}</strong>
          <small>Across the whole catalogue</small>
        </div>
        <div className="kpi-card alert">
          <span className="kpi-icon"><Icon name="alert" /></span>
          <span className="kpi-label">Needs attention</span>
          <strong>{stats.outOfStock + lowStock}</strong>
          <small>{stats.outOfStock} out · {lowStock} low stock</small>
        </div>
      </div>

      <div className="dash-grid">
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Inventory health</h2>
              <p className="muted">Visibility and availability at a glance.</p>
            </div>
            <Icon name="chart" />
          </div>
          <div className="health-list">
            <div className="health-row">
              <div><span>Active products</span><strong>{stats.activeProducts} / {stats.products}</strong></div>
              <div className="bar"><span style={{ width: `${percent(stats.activeProducts, stats.products)}%` }} /></div>
            </div>
            <div className="health-row">
              <div><span>Inactive products</span><strong>{stats.inactiveProducts} / {stats.products}</strong></div>
              <div className="bar warn"><span style={{ width: `${percent(stats.inactiveProducts, stats.products)}%` }} /></div>
            </div>
            <div className="health-row">
              <div><span>Active categories</span><strong>{stats.activeCategories} / {stats.categories}</strong></div>
              <div className="bar"><span style={{ width: `${percent(stats.activeCategories, stats.categories)}%` }} /></div>
            </div>
            <div className="health-row">
              <div><span>Low stock</span><strong>{lowStock} items</strong></div>
              <div className="bar warn"><span style={{ width: `${percent(lowStock, stats.products)}%` }} /></div>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Priority mix</h2>
              <p className="muted">How products are featured on the store.</p>
            </div>
            <Icon name="star" />
          </div>
          <div className="priority-mix">
            {priorityCounts.map((count, level) => (
              <div className="mix-row" key={level}>
                <span className="mix-stars">{level === 0 ? '—' : '★'.repeat(level)}</span>
                <div className="bar accent"><span style={{ width: `${percent(count, products.length)}%` }} /></div>
                <strong>{count}</strong>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Top products by stock value</h2>
            <p className="muted">Highest price × available quantity.</p>
          </div>
          <Link className="button ghost small" to="/products">Manage all</Link>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>Product</th><th>Category</th><th>Subcategory</th><th>Price</th><th>Stock</th><th>Status</th></tr>
            </thead>
            <tbody>
              {topProducts.map((product) => (
                <tr key={product.id}>
                  <td>
                    <span className="table-product">
                      {product.images[0] ? <img src={product.images[0]} alt="" /> : <span className="table-thumb">BC</span>}
                      <span><strong>{product.name}</strong><small>{product.brand || 'Badshah'}</small></span>
                    </span>
                  </td>
                  <td>{product.category?.name ?? 'Uncategorised'}</td>
                  <td>{product.subcategory?.name ?? 'No subcategory'}</td>
                  <td>{formatPrice(product.price)}</td>
                  <td>{product.stock}</td>
                  <td>
                    <span className={product.inStock ? 'status-pill good' : 'status-pill bad'}>
                      {product.inStock ? 'In stock' : 'Out'}
                    </span>
                  </td>
                </tr>
              ))}
                {topProducts.length === 0 && <tr><td colSpan={6} className="muted">No products yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <div className="quick-grid">
        <Link className="quick-card" to="/products">
          <Icon name="plus" />
          <span><strong>Add a product</strong><small>Bring a new item into the catalogue.</small></span>
          <Icon name="chevron" size={16} />
        </Link>
        <Link className="quick-card" to="/categories">
          <Icon name="categories" />
          <span><strong>Organise categories</strong><small>Keep browsing tidy and simple.</small></span>
          <Icon name="chevron" size={16} />
        </Link>
        <a className="quick-card" href="/">
          <Icon name="external" />
          <span><strong>Open customer site</strong><small>See exactly what shoppers see.</small></span>
          <Icon name="chevron" size={16} />
        </a>
      </div>
    </div>
  );
}
