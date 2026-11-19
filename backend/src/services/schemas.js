import { z } from 'zod';

const inStockParam = z.union([
  z.boolean(),
  z.enum(['true', 'false']).transform((value) => value === 'true'),
]).optional();

const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(70)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens');

const imageUrlSchema = z.string().trim().max(1000);
const imagePublicIdSchema = z.string().trim().max(500);

export const productCreateSchema = z.object({
  name: z.string().trim().min(1).max(160),
  brand: z.string().trim().max(120).default(''),
  description: z.string().trim().max(2000).default(''),
  pricePaise: z.number().int().nonnegative(),
  costPaise: z.number().int().nonnegative().default(0),
  stock: z.number().int().nonnegative(),
  unit: z.string().trim().min(1).max(40),
  categoryId: z.string().min(1),
  subcategoryId: z.string().min(1),
  active: z.boolean().default(true),
  starPriority: z.number().int().min(0).max(3).default(0),
  images: z.array(z.string()).default([]),
});

export const productUpdateSchema = productCreateSchema.partial();

export const categoryCreateSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(1000).default(''),
  slug: slugSchema.optional(),
  imageUrl: imageUrlSchema.optional(),
  imagePublicId: imagePublicIdSchema.nullable().optional(),
  displayOrder: z.number().int().min(0).optional(),
  active: z.boolean().default(true),
});

export const categoryUpdateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(1000).optional(),
  slug: slugSchema.optional(),
  imageUrl: imageUrlSchema.optional(),
  imagePublicId: imagePublicIdSchema.nullable().optional(),
  displayOrder: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
});

export const subcategoryCreateSchema = z.object({
  id: z.string().uuid().optional(),
  categoryId: z.string().min(1),
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(1000).default(''),
  slug: slugSchema.optional(),
  imageUrl: imageUrlSchema.optional(),
  imagePublicId: imagePublicIdSchema.nullable().optional(),
  displayOrder: z.number().int().min(0).optional(),
  active: z.boolean().default(true),
});

export const subcategoryUpdateSchema = z.object({
  categoryId: z.string().min(1).optional(),
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(1000).optional(),
  slug: slugSchema.optional(),
  imageUrl: imageUrlSchema.optional(),
  imagePublicId: imagePublicIdSchema.nullable().optional(),
  displayOrder: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
});

export const subcategoryQuerySchema = z.object({
  category: z.string().trim().optional(),
  q: z.string().trim().optional(),
});

export const productQuerySchema = z.object({
  category: z.string().trim().optional(),
  subcategory: z.string().trim().optional(),
  q: z.string().trim().optional(),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),
  inStock: inStockParam,
  sort: z.enum(['priority', 'newest', 'price-asc', 'price-desc', 'name']).default('priority'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(60).default(12),
});
