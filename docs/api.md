# API reference

Base URL: `http://localhost:4000` (proxied as `/api` by both frontends).

## Public — customer panel (no auth)

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/health` | Health check and active DB driver (`mongo`) |
| GET | `/api/categories` | Active categories with active product/subcategory counts |
| GET | `/api/categories/:slug` | One active category |
| GET | `/api/subcategories` | Active subcategories, optionally filtered by `category` or `q` |
| GET | `/api/subcategories/:slug` | One active subcategory |
| GET | `/api/products` | Active products with filters and pagination |
| GET | `/api/products/:slug` | One active product |

Product filters: `category`, `subcategory`, `q`, `minPrice`, `maxPrice`, `inStock=true`, `sort=priority|newest|price-asc|price-desc|name`, `page`, `limit` (max 500).

Category DTO: `id`, `name`, `slug`, `description`, `imageUrl`, `displayOrder`, `active`, `productCount`, `subcategoryCount`, `createdAt`, `updatedAt`.

Subcategory DTO: `id`, `categoryId`, `category{id,name,slug}`, `name`, `slug`, `description`, `imageUrl`, `displayOrder`, `active`, `productCount`, `createdAt`, `updatedAt`.

Product DTO: `id`, `name`, `slug`, `brand`, `description`, `images[]`, `pricePaise`, `price`, `stock`, `unit`, `inStock`, `categoryId`, `category{id,name,slug}`, `subcategoryId`, `subcategory{id,name,slug}`, `active`, `starPriority`, `createdAt`, `updatedAt`. Cost price (`costPaise`, `cost`) is admin-only and is never returned by public product endpoints.

## Auth — admin panel

| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/auth/login` | `{ username, password }` → `{ token, expiresAt, admin }` |
| GET | `/api/auth/me` | Requires Bearer token → current admin |
| POST | `/api/auth/logout` | Requires Bearer token; revokes session (204) |

Invalid credentials return 401. Passwords are verified with scrypt; session tokens are random and stored hashed.

## Admin — authenticated + `role: admin` required

All routes require `Authorization: Bearer <token>` from login. Missing/invalid session → 401; wrong role → 403.

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/admin/stats` | Dashboard totals (products, categories, subcategories, stock, active/inactive, out of stock) |
| GET | `/api/admin/products` | Products including inactive; supports category/subcategory filters |
| POST | `/api/admin/products` | Create product with `categoryId` and `unit`; `subcategoryId` is optional (`null` for category-only products) |
| GET | `/api/admin/products/:id` | Product by id |
| PATCH | `/api/admin/products/:id` | Partial update (name, brand, price, costPaise, stock, unit, category, subcategory, active, starPriority, images…) |
| DELETE | `/api/admin/products/:id` | Delete product and its stored images |
| POST | `/api/admin/products/:id/images` | Multipart field `images`, up to 8 files |
| DELETE | `/api/admin/products/:id/images/:index` | Remove one image |
| POST | `/api/admin/categories/images` | Multipart field `image`, one file → `{ url }` |
| GET | `/api/admin/categories` | Categories including inactive |
| POST | `/api/admin/categories` | Create category; cover image is optional |
| PATCH | `/api/admin/categories/:id` | Partial update (name, description, imageUrl, displayOrder, active) |
| DELETE | `/api/admin/categories/:id` | Delete empty category, or `?moveTo=<id>` to move subcategories and products first |
| POST | `/api/admin/subcategories/images` | Multipart field `image`, one file → `{ url }` |
| GET | `/api/admin/subcategories` | Subcategories including inactive; supports `category` and `q` |
| POST | `/api/admin/subcategories` | Create subcategory under a main category |
| GET | `/api/admin/subcategories/:id` | Subcategory by id |
| PATCH | `/api/admin/subcategories/:id` | Partial update (categoryId, name, description, imageUrl, displayOrder, active) |
| DELETE | `/api/admin/subcategories/:id` | Delete empty subcategory, or `?moveTo=<id>` to move its products first |

Category and subcategory deletion never deletes products. If a category or subcategory still has content, pass `moveTo=<destinationId>`; otherwise the API returns 409 with a clear message.

Image uploads accept JPEG, PNG, WebP and GIF. The admin UI uses the native file picker so Android/iPhone users can choose camera or gallery; it previews, validates and compresses large photos before upload. Files are stored in Cloudinary when configured, with `backend/uploads/` used only as a development fallback; the URL and Cloudinary public ID are saved in the database.

Validation errors: `{ "error": "Validation failed", "issues": [{ "field", "message" }] }`.
