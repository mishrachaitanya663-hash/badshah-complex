import { getDrivers } from '../db/index.js';

export const subcategoryRepository = {
  list: (query) => getDrivers().subcategories.listSubcategories(query),
  findById: (id) => getDrivers().subcategories.findSubcategoryById(id),
  findBySlug: (slug) => getDrivers().subcategories.findSubcategoryBySlug(slug),
  create: (data) => getDrivers().subcategories.createSubcategory(data),
  update: (id, patch) => getDrivers().subcategories.updateSubcategory(id, patch),
  remove: (id) => getDrivers().subcategories.removeSubcategory(id),
  productCount: (id) => getDrivers().subcategories.countProductsInSubcategory(id),
  moveProducts: (fromId, toId) => getDrivers().subcategories.moveProductsToSubcategory(fromId, toId),
  moveToCategory: (fromId, toId) => getDrivers().subcategories.moveSubcategoriesToCategory(fromId, toId),
};
