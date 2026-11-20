import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { Category, Subcategory } from '../types';
import { toMessage } from '../utils';
import Icon from '../components/Icon';
import { EmptyState, ErrorNote, Loading } from '../components/States';

export default function Categories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    Promise.all([api.categories(), api.subcategories()])
      .then(([categoryList, subcategoryList]) => {
        if (!alive) return;
        setCategories(categoryList);
        setSubcategories(subcategoryList);
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

  if (error) return <div className="page"><ErrorNote message={error} /></div>;

  return (
    <div className="page">
      <div className="page-heading">
        <p className="eyebrow">Catalogue</p>
        <h1>Categories</h1>
        <p className="muted">Pick a category to browse its products, or choose a subcategory if one exists.</p>
      </div>

      {loading ? (
        <Loading label="Loading categories…" />
      ) : categories.length === 0 ? (
        <EmptyState>No active categories yet.</EmptyState>
      ) : (
        <div className="category-grid">
          {categories.map((category) => {
            const children = subcategories.filter((subcategory) => subcategory.categoryId === category.id);
            return (
              <article className="category-card" key={category.id}>
                <Link className="category-card-link" to={`/categories/${category.slug}`}>
                  <div className="category-image-placeholder">
                    {category.imageUrl ? <img src={category.imageUrl} alt="" /> : <Icon name="grid" size={30} />}
                  </div>
                  <div className="category-card-body">
                    <h2>{category.name}</h2>
                    <p className="muted">{category.description || 'Explore this collection.'}</p>
                    <span className="pill">
                      <Icon name="products" size={13} /> {category.productCount} products
                    </span>
                  </div>
                </Link>
                {children.length > 0 && (
                  <div className="subcategory-list">
                    {children.map((subcategory) => (
                      <Link key={subcategory.id} to={`/subcategories/${subcategory.slug}`}>
                        {subcategory.name}
                        <Icon name="chevron" size={13} />
                      </Link>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
