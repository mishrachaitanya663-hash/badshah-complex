import { Router } from 'express';
import { config } from '../config.js';
import * as catalog from '../services/catalogService.js';
import { validate } from '../middleware/validate.js';
import { productQuerySchema, subcategoryQuerySchema } from '../services/schemas.js';

const router = Router();
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get('/health', asyncHandler(async (req, res) => {
  let dbOk = false;
  let dbError;
  try {
    const { testDbConnection } = await import('../db/index.js');
    dbOk = await testDbConnection();
  } catch (error) {
    dbError = error?.message;
  }
  const status = dbOk ? 200 : 503;
  res.status(status).json({
    ok: dbOk,
    service: 'badshah-customer-api',
    driver: config.dbDriver === 'postgresql' ? 'postgres' : config.dbDriver,
    database: dbOk ? 'connected' : 'error',
    ...(dbError ? { error: dbError } : {}),
  });
}));

router.get('/categories', asyncHandler(async (req, res) => {
  res.json(await catalog.listCategories());
}));

router.get('/categories/:slug', asyncHandler(async (req, res) => {
  res.json(await catalog.getPublicCategoryBySlug(req.params.slug));
}));

router.get('/subcategories', validate(subcategoryQuerySchema, 'query'), asyncHandler(async (req, res) => {
  res.json(await catalog.listSubcategories(req.validatedQuery));
}));

router.get('/subcategories/:slug', asyncHandler(async (req, res) => {
  res.json(await catalog.getPublicSubcategoryBySlug(req.params.slug));
}));

router.get('/products', validate(productQuerySchema, 'query'), asyncHandler(async (req, res) => {
  res.json(await catalog.listPublicProducts(req.validatedQuery));
}));

router.get('/products/:slug', asyncHandler(async (req, res) => {
  res.json(await catalog.getPublicProductBySlug(req.params.slug));
}));

export default router;
