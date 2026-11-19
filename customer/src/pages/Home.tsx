import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { Category, Product, Subcategory } from '../types';
import { toMessage } from '../utils';
import ProductCard from '../components/ProductCard';
import Icon from '../components/Icon';
import { EmptyState, ErrorNote, Loading } from '../components/States';

async function fetchAllCategoryProducts(slug: string): Promise<Product[]> {
  const all: Product[] = [];
  let page = 1;
  let pages = 1;
  do {
    const result = await api.products({ category: slug, sort: 'priority', limit: 60, page });
    all.push(...result.items);
    pages = result.pages || 1;
    page += 1;
  } while (page <= pages);
  return all;
}

function CategorySection({ category, products }: { category: Category; products: Product[] }) {
  const trackRef = useRef<HTMLDivElement | null>(null);

  function scroll(direction: -1 | 1) {
    const track = trackRef.current;
    if (!track) return;
    const amount = Math.max(280, track.clientWidth * 0.85);
    track.scrollBy({ left: direction * amount, behavior: 'smooth' });
  }

  return (
    <section className="section slider-section" aria-labelledby={`cat-${category.id}`}>
      <div className="slider-head">
        <div>
          <p className="eyebrow">Category</p>
          <h2 id={`cat-${category.id}`}>{category.name}</h2>
          <p className="muted">{category.productCount} products</p>
        </div>
        <Link className="button ghost small" to={`/categories/${category.slug}`}>
          View All <Icon name="arrow" size={14} />
        </Link>
      </div>

      {products.length === 0 ? (
        <EmptyState>No active products in this category yet.</EmptyState>
      ) : (
        <div className="slider-shell">
          <button
            type="button"
            className="slider-btn prev"
            aria-label={`Scroll ${category.name} products left`}
            onClick={() => scroll(-1)}
          >
            <Icon name="chevron-left" />
          </button>
          <div className="slider-track" ref={trackRef} tabIndex={0}>
            {products.map((product) => (
              <div className="slider-item" key={product.id}>
                <ProductCard product={product} />
              </div>
            ))}
          </div>
          <button
            type="button"
            className="slider-btn next"
            aria-label={`Scroll ${category.name} products right`}
            onClick={() => scroll(1)}
          >
            <Icon name="chevron" />
          </button>
        </div>
      )}
    </section>
  );
}

export default function Home() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategoriesByCategory, setSubcategoriesByCategory] = useState<Record<string, Subcategory[]>>({});
  const [productsByCategory, setProductsByCategory] = useState<Record<string, Product[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');

    Promise.all([api.categories(), api.subcategories()])
      .then(async ([categoryList, subcategoryList]) => {
        const active = categoryList.filter((category) => category.active);
        const grouped = Object.fromEntries(
          active.map((category) => [
            category.id,
            subcategoryList.filter((subcategory) => subcategory.categoryId === category.id),
          ]),
        );
        const entries = await Promise.all(
          active.map(async (category) => {
            const products = await fetchAllCategoryProducts(category.slug);
            const scoped = products.filter(
              (product) => product.active && (product.categoryId === category.id || product.category?.id === category.id),
            );
            return [category.id, scoped] as const;
          }),
        );
        if (!alive) return;
        setCategories(active);
        setSubcategoriesByCategory(grouped);
        setProductsByCategory(Object.fromEntries(entries));
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
  }, []);

  const hasAnyProducts = useMemo(
    () => Object.values(productsByCategory).some((products) => products.length > 0),
    [productsByCategory],
  );

  return (
    <div className="page">
      <section className="hero">
        <div>
          <p className="eyebrow">Welcome to Badshah Complex</p>
          <h1>Everyday essentials, all in one place.</h1>
          <p className="hero-copy">
            Explore a carefully organised building-materials catalogue by category and subcategory. Find what you need,
            compare prices and view details in seconds.
          </p>
          <div className="hero-actions">
            <Link className="button primary" to="/products">
              Shop Products <Icon name="arrow" size={16} />
            </Link>
            <Link className="button light" to="/categories">
              View All Categories
            </Link>
          </div>
        </div>
        <div className="hero-visual">
          <img
            className="hero-collage"
            src="/images/building-materials-hero.jpeg"
            alt="Building materials at Badshah Complex: cement, sand, steel, bricks, roofing sheets, tiles, pipes, paint, hardware and tools"
          />
        </div>
      </section>

      <div className="trust-strip">
        <div className="trust-item">
          <Icon name="shield" />
          <span><strong>Locally stocked</strong><span>Pick essentials from our neighbourhood shelves.</span></span>
        </div>
        <div className="trust-item">
          <Icon name="tag" />
          <span><strong>Clear pricing</strong><span>Every listed price is shown upfront, no surprises.</span></span>
        </div>
        <div className="trust-item">
          <Icon name="truck" />
          <span><strong>Easy to browse</strong><span>Search, filter and explore from any device.</span></span>
        </div>
      </div>

      <section className="section">
        <div className="section-head">
          <div>
            <p className="eyebrow">Browse</p>
            <h2>Shop by category</h2>
            <p className="muted">All active categories in one place.</p>
          </div>
          <Link className="text-link" to="/categories">View All Categories →</Link>
        </div>

        {error ? (
          <ErrorNote message={error} />
        ) : loading ? (
          <Loading label="Loading categories…" />
        ) : categories.length === 0 ? (
          <EmptyState>No active categories yet.</EmptyState>
        ) : (
          <div className="category-grid home-category-grid">
            {categories.map((category) => {
              const children = subcategoriesByCategory[category.id] ?? [];
              return (
                <Link key={category.id} className="category-card" to={`/categories/${category.slug}`}>
                  <div className="category-image-placeholder">
                    <Icon name="grid" size={30} />
                  </div>
                  <div className="category-card-body">
                    <h3>{category.name}</h3>
                    <p className="muted">{category.description || 'Explore this collection.'}</p>
                    <span className="pill"><Icon name="grid" size={13} /> {children.length} subcategories</span>
                    {children.length > 0 && (
                      <div className="subcategory-chips">
                        {children.slice(0, 4).map((subcategory) => (
                          <span key={subcategory.id}>{subcategory.name}</span>
                        ))}
                        {children.length > 4 && <span>+{children.length - 4} more</span>}
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {error ? null : loading ? (
        <Loading label="Loading category products…" />
      ) : categories.length === 0 ? null : !hasAnyProducts ? (
        <section className="section">
          <EmptyState>No products have been added yet. Subcategories are ready to use.</EmptyState>
        </section>
      ) : (
        categories.map((category) => (
          <CategorySection
            key={category.id}
            category={category}
            products={productsByCategory[category.id] ?? []}
          />
        ))
      )}

      <section className="section">
        <div className="section-head">
          <div>
            <p className="eyebrow">Why shop with us</p>
            <h2>A simpler way to browse</h2>
          </div>
        </div>
        <div className="value-grid">
          <div className="value-card">
            <Icon name="sparkle" size={22} />
            <h3>Clear structure</h3>
            <p>Only the essentials that matter, organised into clear categories and subcategories.</p>
          </div>
          <div className="value-card">
            <Icon name="shield" size={22} />
            <h3>Up-to-date stock</h3>
            <p>Out-of-stock items are marked clearly so you can plan better.</p>
          </div>
          <div className="value-card">
            <Icon name="phone" size={22} />
            <h3>Local support</h3>
            <p>Need details? Ask at the counter and we will help you find it.</p>
          </div>
        </div>
      </section>

      <section className="cta-band">
        <div>
          <h2>Planning a visit?</h2>
          <p>Find us at Badshah Complex, open Monday to Saturday.</p>
        </div>
        <div className="plan-card">
          <img src="/images/customer-plan.jpeg" alt="Customer visit guide" />
          <a className="button light" href="/#contact">Visit details <Icon name="arrow" size={15} /></a>
        </div>
      </section>
    </div>
  );
}
