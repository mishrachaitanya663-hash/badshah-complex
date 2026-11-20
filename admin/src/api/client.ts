import { API_BASE } from '../config';
import type {
  Category,
  LoginResponse,
  Product,
  ProductPage,
  Stats,
  Subcategory,
} from '../types';

const TOKEN_KEY = 'badshah_admin_token';
export const TOKEN_CHANGED_EVENT = 'badshah-token-changed';

function notifyTokenChange(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(TOKEN_CHANGED_EVENT));
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
  notifyTokenChange();
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  notifyTokenChange();
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  form?: FormData;
  auth?: boolean;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.auth !== false) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const init: RequestInit = { method: options.method ?? 'GET', headers };
  if (options.form) {
    init.body = options.form;
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(options.body);
  }

  const response = await fetch(`${API_BASE}/api${path}`, init);
  const payload: unknown = response.status === 204 ? null : await response.json().catch(() => null);

  if (!response.ok) {
    const failure = payload as { error?: string; issues?: { field: string; message: string }[] } | null;
    const detail = failure?.issues?.map((issue) => `${issue.field}: ${issue.message}`).join(', ');
    if (response.status === 401 && options.auth !== false) clearToken();
    throw new Error(detail || failure?.error || `Request failed (${response.status})`);
  }

  return payload as T;
}

export interface ProductListFilters {
  q?: string;
  category?: string;
  subcategory?: string;
  sort?: string;
  page?: number;
  limit?: number;
}

export interface SubcategoryListFilters {
  category?: string;
  q?: string;
}

function productQuery(filters: ProductListFilters): string {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.category) params.set('category', filters.category);
  if (filters.subcategory) params.set('subcategory', filters.subcategory);
  if (filters.sort) params.set('sort', filters.sort);
  if (filters.page !== undefined) params.set('page', String(filters.page));
  if (filters.limit !== undefined) params.set('limit', String(filters.limit));
  return params.toString();
}

function subcategoryQuery(filters: SubcategoryListFilters): string {
  const params = new URLSearchParams();
  if (filters.category) params.set('category', filters.category);
  if (filters.q) params.set('q', filters.q);
  return params.toString();
}

export type ProductInput = {
  name: string;
  brand: string;
  description: string;
  pricePaise: number;
  costPaise: number;
  stock: number;
  unit: string;
  categoryId: string;
  subcategoryId: string | null;
  active: boolean;
  starPriority: number;
  images: string[];
  imagePublicIds?: (string | null)[];
};

export type CategoryInput = {
  id?: string;
  name: string;
  description: string;
  slug: string;
  imageUrl?: string | null;
  imagePublicId?: string | null;
  displayOrder: number;
  active: boolean;
};

export type SubcategoryInput = {
  id?: string;
  categoryId: string;
  name: string;
  description: string;
  slug: string;
  imageUrl?: string | null;
  imagePublicId?: string | null;
  displayOrder: number;
  active: boolean;
};

export type UploadedImage = { url: string; publicId?: string | null };

export const api = {
  login: (username: string, password: string) =>
    request<LoginResponse>('/auth/login', {
      method: 'POST',
      auth: false,
      body: { username, password },
    }),
  me: () => request<{ admin: LoginResponse['admin']; expiresAt: string }>('/auth/me'),
  logout: () => request<null>('/auth/logout', { method: 'POST' }),

  admin: {
    stats: () => request<Stats>('/admin/stats'),
    products: () => request<ProductPage>('/admin/products?limit=60&sort=newest'),
    listProducts: (filters: ProductListFilters = {}) =>
      request<ProductPage>(`/admin/products?${productQuery(filters)}`),
    categories: () => request<Category[]>('/admin/categories'),
    saveProduct: (body: ProductInput, id?: string) =>
      request<Product>(id ? `/admin/products/${id}` : '/admin/products', {
        method: id ? 'PATCH' : 'POST',
        body,
      }),
    deleteProduct: (id: string) => request<null>(`/admin/products/${id}`, { method: 'DELETE' }),
    uploadImages: (id: string, form: FormData) =>
      request<Product>(`/admin/products/${id}/images`, { method: 'POST', form }),
    removeImage: (id: string, index: number) =>
      request<Product>(`/admin/products/${id}/images/${index}`, { method: 'DELETE' }),
    saveCategory: (body: CategoryInput, id?: string) =>
      request<Category>(id ? `/admin/categories/${id}` : '/admin/categories', {
        method: id ? 'PATCH' : 'POST',
        body,
      }),
    uploadCategoryImage: (form: FormData) =>
      request<UploadedImage>('/admin/categories/images', { method: 'POST', form }),
    deleteCategory: (id: string, moveTo?: string) => {
      const suffix = moveTo ? `?moveTo=${encodeURIComponent(moveTo)}` : '';
      return request<null>(`/admin/categories/${id}${suffix}`, { method: 'DELETE' });
    },
    subcategories: (filters: SubcategoryListFilters = {}) =>
      request<Subcategory[]>(`/admin/subcategories?${subcategoryQuery(filters)}`),
    saveSubcategory: (body: SubcategoryInput, id?: string) =>
      request<Subcategory>(id ? `/admin/subcategories/${id}` : '/admin/subcategories', {
        method: id ? 'PATCH' : 'POST',
        body,
      }),
    uploadSubcategoryImage: (form: FormData) =>
      request<UploadedImage>('/admin/subcategories/images', { method: 'POST', form }),
    deleteSubcategory: (id: string, moveTo?: string) => {
      const suffix = moveTo ? `?moveTo=${encodeURIComponent(moveTo)}` : '';
      return request<null>(`/admin/subcategories/${id}${suffix}`, { method: 'DELETE' });
    },
  },
};
