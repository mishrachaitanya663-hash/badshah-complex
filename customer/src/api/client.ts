import { API_BASE } from '../config';
import type { Category, Product, ProductPage, Subcategory } from '../types';

export interface ProductFilters {
  category?: string;
  subcategory?: string;
  q?: string;
  sort?: string;
  inStock?: boolean;
  minPrice?: number;
  maxPrice?: number;
  page?: number;
  limit?: number;
}

export interface SubcategoryFilters {
  category?: string;
  q?: string;
}

function query(filters: object): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === '') continue;
    params.set(key, String(value));
  }
  return params.toString();
}

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}/api${path}`);
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const failure = payload as { error?: string } | null;
    throw new Error(failure?.error || `Request failed (${response.status})`);
  }
  return payload as T;
}

export const api = {
  categories: () => get<Category[]>('/categories'),
  category: (slug: string) => get<Category>(`/categories/${encodeURIComponent(slug)}`),
  subcategories: (filters: SubcategoryFilters = {}) => get<Subcategory[]>(`/subcategories?${query(filters)}`),
  subcategory: (slug: string) => get<Subcategory>(`/subcategories/${encodeURIComponent(slug)}`),
  products: (filters: ProductFilters = {}) => get<ProductPage>(`/products?${query(filters)}`),
  product: (slug: string) => get<Product>(`/products/${encodeURIComponent(slug)}`),
};
