# Migration to MongoDB Atlas (later phase)

Nothing here is enabled yet. Do not put Atlas credentials into the current `.env`.

## Why the swap is contained

Both UIs talk only to the HTTP contract in `docs/api.md`; that contract stays the same. Inside the backend, routes and services call repository wrappers, never SQL. There are four wrappers: `productRepository`, `categoryRepository`, `subcategoryRepository` and `authRepository`.

## Steps when approved

1. Install the official `mongodb` driver in `backend/`.
2. Add `src/db/mongo.js` connecting with `MONGODB_URI` and `MONGODB_DB`.
3. Add Mongo implementations for the four repository interfaces:
   - products: `listProducts`, `countProducts`, `findProductById`, `findProductBySlug`, `createProduct`, `updateProduct`, `removeProduct`, `moveProductsToCategory`, `countProductsInCategory`, `countProductsInSubcategory`
   - categories: `listCategories`, `findCategoryById`, `findCategoryBySlug`, `createCategory`, `updateCategory`, `removeCategory`, `countSubcategoriesInCategory`
   - subcategories: `listSubcategories`, `findSubcategoryById`, `findSubcategoryBySlug`, `createSubcategory`, `updateSubcategory`, `removeSubcategory`, `countProductsInSubcategory`, `moveProductsToSubcategory`, `moveSubcategoriesToCategory`
   - auth: `countAdmins`, `findAdminByUsername`, `findAdminById`, `createAdmin`, `createSession`, `findSession`, `deleteSession`, `deleteExpiredSessions`
4. Register them in `src/db/index.js` under a `mongo` key and switch `DB_DRIVER=mongo`.
5. Keep DTOs identical: UUID-style string ids, `images` as string array, `pricePaise` integer, booleans as booleans, ISO date strings.
6. Mirror indexes: unique category/subcategory slugs and names, `subcategories(category_id, active)`, `products(category_id, active)`, `products(subcategory_id, active)`, `products(star_priority, created_at)`, `categories(active)`, `admins(username)` unique and `admin_sessions(token_hash)` with expiry.
7. Add an import script to copy SQLite rows into Mongo collections with the same ids.
8. Compare both public and admin API responses with both drivers locally before switching.
9. Only then configure Atlas credentials and decide hosting/deployment.

## Unchanged

Both frontends, their routes and the auth UX (login/session token), image URLs from `/uploads`, validation schemas, and the separation from the existing retailer/admin application.
