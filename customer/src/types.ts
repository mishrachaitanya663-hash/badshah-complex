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

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export type ProductPage = Page<Product>;
