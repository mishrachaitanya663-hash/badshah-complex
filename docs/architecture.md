# Architecture

## Goal

Two separate React + TypeScript panels (private admin + public customer) on one backend. Both local development and production use MongoDB.

## Runtime layout

```
Browser — http://localhost:5175/
   ├─ /            → customer app (Vite dev server, source in customer/)
   ├─ /admin/*     → admin app (prebuilt files in admin/dist, served by customer Vite)
   └─ /api/*, /uploads/* → proxy to backend http://localhost:4000

Backend (4000)
   routes/auth.js    routes/public.js    routes/admin.js
        │                  │                   │
   authService      catalogService       requireAuth + requireRole
        └──────────────────┴───────────────────┘
                   repository wrappers
        productRepository / categoryRepository /
        subcategoryRepository / authRepository
                           │
                     db/index.js (DB_DRIVER=mongo)
                        └─ db/mongo.js → MongoDB collections
```

The two panels remain separate source trees. The customer Vite dev server only serves the admin panel's compiled files; it does not merge the applications. Changing admin code requires `cd admin && npm run build`.

## Panels

- **Customer** (`customer/`): public routes `/`, `/products`, `/categories`, `/categories/:slug`, `/subcategories/:slug`, `/products/:slug`. Calls only public GET APIs. No auth knowledge.
- **Admin** (`admin/`): routes under `/admin` with `BrowserRouter basename="/admin"`. `ProtectedRoute` renders an inline login card when unauthenticated; there is no separate `/login` page. The customer header opens the same flow in a modal card and redirects to `/admin/` after sign-in.

## Auth flow

1. `POST /api/auth/login` with username/password.
2. Backend verifies an scrypt hash and creates a random session token; only its SHA-256 hash is stored in `admin_sessions` with an expiry.
3. Token is kept in the admin panel's localStorage and sent as `Authorization: Bearer <token>` to `/api/admin/*`.
4. `requireAuth` resolves the session; `requireRole('admin')` authorizes the request.
5. `POST /api/auth/logout` revokes it.

## Shared data

The catalogue is three separate entities: `Category` → optional `Subcategory` → `Product`.

- A main category has many subcategories.
- A subcategory belongs to exactly one main category.
- A product belongs to exactly one category; its subcategory is optional. When set, it must belong to the selected category.
- Products are never shown as categories; each product has its own name, images, description, specifications/description text, price, unit and stock.
- The seed creates exactly five main categories and their requested subcategories, with zero products. Add real products from the admin panel.

Public queries filter `active = true`; admin queries can include inactive documents. Both panels call the same services, so admin changes show up on the customer site on the next fetch.

## Mongo repository boundary

Routes and services never issue SQL. The four repository wrappers are wired to the Mongo implementations in `db/index.js`, keeping both UIs and the API contract unchanged. `docs/migration-to-mongodb.md` covers configuration, indexes and the SQLite import script.

## Production topology

- Render hosts the API, customer and admin using `render.yaml`; MongoDB Atlas stores the data.
- Admin is served at the root of its own Render site; customer links to it with `VITE_ADMIN_URL`, and admin links back with `VITE_CUSTOMER_URL`.
- Frontends pass their API origin through `VITE_API_BASE`; no production API calls use a bare `/api` path.
- Cloudinary stores uploaded images; local `/uploads` remains a development fallback.

## Non-goals for this phase

Customer accounts, payments, and changes to the existing retailer/admin application.
