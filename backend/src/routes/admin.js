import { Router } from 'express';
import multer from 'multer';
import { config } from '../config.js';
import * as catalog from '../services/catalogService.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import { validate } from '../middleware/validate.js';
import { imageFileFilter } from '../storage/imageStorage.js';
import {
  productCreateSchema,
  productUpdateSchema,
  productQuerySchema,
  categoryCreateSchema,
  categoryUpdateSchema,
  subcategoryCreateSchema,
  subcategoryUpdateSchema,
  subcategoryQuerySchema,
} from '../services/schemas.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxImageBytes, files: 8 },
  fileFilter: imageFileFilter,
});
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxImageBytes, files: 1 },
  fileFilter: imageFileFilter,
});

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.use(requireAuth, requireRole('admin'));

router.get('/stats', asyncHandler(async (req, res) => {
  res.json(await catalog.getStats());
}));

router.get('/products', validate(productQuerySchema, 'query'), asyncHandler(async (req, res) => {
  res.json(await catalog.listAllProducts(req.validatedQuery));
}));

router.post('/products', validate(productCreateSchema), asyncHandler(async (req, res) => {
  res.status(201).json(await catalog.createProduct(req.validatedBody));
}));

router.get('/products/:id', asyncHandler(async (req, res) => {
  res.json(await catalog.getProductById(req.params.id));
}));

router.patch('/products/:id', validate(productUpdateSchema), asyncHandler(async (req, res) => {
  res.json(await catalog.updateProduct(req.params.id, req.validatedBody));
}));

router.delete('/products/:id', asyncHandler(async (req, res) => {
  await catalog.deleteProduct(req.params.id);
  res.status(204).end();
}));

router.post('/products/:id/images', upload.array('images', 8), asyncHandler(async (req, res) => {
  res.status(201).json(await catalog.addProductImages(req.params.id, req.files));
}));

router.delete('/products/:id/images/:index', asyncHandler(async (req, res) => {
  res.json(await catalog.removeProductImage(req.params.id, Number(req.params.index)));
}));

router.post('/categories/images', imageUpload.single('image'), asyncHandler(async (req, res) => {
  res.status(201).json(await catalog.uploadCategoryImage(req.file ? [req.file] : []));
}));

router.get('/categories', asyncHandler(async (req, res) => {
  res.json(await catalog.listCategories(true));
}));

router.post('/categories', validate(categoryCreateSchema), asyncHandler(async (req, res) => {
  res.status(201).json(await catalog.createCategory(req.validatedBody));
}));

router.patch('/categories/:id', validate(categoryUpdateSchema), asyncHandler(async (req, res) => {
  res.json(await catalog.updateCategory(req.params.id, req.validatedBody));
}));

router.delete('/categories/:id', asyncHandler(async (req, res) => {
  const moveTo = typeof req.query.moveTo === 'string' ? req.query.moveTo : undefined;
  await catalog.deleteCategory(req.params.id, { moveTo });
  res.status(204).end();
}));

router.post('/subcategories/images', imageUpload.single('image'), asyncHandler(async (req, res) => {
  res.status(201).json(await catalog.uploadSubcategoryImage(req.file ? [req.file] : []));
}));

router.get('/subcategories', validate(subcategoryQuerySchema, 'query'), asyncHandler(async (req, res) => {
  res.json(await catalog.listSubcategories({ ...req.validatedQuery, includeInactive: true }));
}));

router.post('/subcategories', validate(subcategoryCreateSchema), asyncHandler(async (req, res) => {
  res.status(201).json(await catalog.createSubcategory(req.validatedBody));
}));

router.get('/subcategories/:id', asyncHandler(async (req, res) => {
  res.json(await catalog.getSubcategoryById(req.params.id));
}));

router.patch('/subcategories/:id', validate(subcategoryUpdateSchema), asyncHandler(async (req, res) => {
  res.json(await catalog.updateSubcategory(req.params.id, req.validatedBody));
}));

router.delete('/subcategories/:id', asyncHandler(async (req, res) => {
  const moveTo = typeof req.query.moveTo === 'string' ? req.query.moveTo : undefined;
  await catalog.deleteSubcategory(req.params.id, { moveTo });
  res.status(204).end();
}));

export default router;
