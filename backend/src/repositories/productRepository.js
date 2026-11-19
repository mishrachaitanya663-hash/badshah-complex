import { getDrivers } from '../db/index.js';

export const productRepository = {
  list: (query) => getDrivers().products.listProducts(query),
  count: (query) => getDrivers().products.countProducts(query),
  findById: (id) => getDrivers().products.findProductById(id),
  findBySlug: (slug) => getDrivers().products.findProductBySlug(slug),
  create: (data) => getDrivers().products.createProduct(data),
  update: (id, patch) => getDrivers().products.updateProduct(id, patch),
  remove: (id) => getDrivers().products.removeProduct(id),
  moveToCategory: (fromId, toId) => getDrivers().products.moveProductsToCategory(fromId, toId),
  countInSubcategory: (id) => getDrivers().products.countProductsInSubcategory(id),
};
