import { getDrivers } from '../db/index.js';

export const categoryRepository = {
  list: (query) => getDrivers().categories.listCategories(query),
  findById: (id) => getDrivers().categories.findCategoryById(id),
  findBySlug: (slug) => getDrivers().categories.findCategoryBySlug(slug),
  create: (data) => getDrivers().categories.createCategory(data),
  update: (id, patch) => getDrivers().categories.updateCategory(id, patch),
  remove: (id) => getDrivers().categories.removeCategory(id),
  productCount: (id) => getDrivers().categories.countProductsInCategory(id),
  subcategoryCount: (id) => getDrivers().categories.countSubcategoriesInCategory(id),
};
