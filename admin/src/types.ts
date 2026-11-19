export interface AdminUser {
  id: string;
  username: string;
  role: string;
}

export interface LoginResponse {
  token: string;
  expiresAt: string;
  admin: AdminUser;
}

export interface CategoryRef {
  id: string;
  name: string;
  slug: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  imageUrl: string | null;
  imagePublicId?: string | null;
  displayOrder: number;
  active: boolean;
  productCount: number;
  subcategoryCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Subcategory {
  id: string;
  categoryId: string;
  category: CategoryRef | null;
  name: string;
  slug: string;
  description: string;
  imageUrl: string | null;
  imagePublicId?: string | null;
  displayOrder: number;
  active: boolean;
  productCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  brand: string;
  description: string;
  images: string[];
  imagePublicIds?: (string | null)[];
  pricePaise: number;
  price: number;
  costPaise: number;
  cost: number;
  stock: number;
  unit: string;
  inStock: boolean;
  categoryId: string;
  category: CategoryRef | null;
  subcategoryId: string | null;
  subcategory: CategoryRef | null;
  active: boolean;
  starPriority: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProductPage {
  items: Product[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface Stats {
  products: number;
  categories: number;
  subcategories: number;
  activeProducts: number;
  inactiveProducts: number;
  activeCategories: number;
  activeSubcategories: number;
  totalStock: number;
  outOfStock: number;
}
