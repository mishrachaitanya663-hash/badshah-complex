# Badshah Complex — Customer Website (local build)

Two separate React + TypeScript panels on one Express/MongoDB backend:

- **Customer panel** — public, read-only storefront at `http://localhost:5175/`
- **Admin panel** — private dashboard at `http://localhost:5175/admin` (login required)

Open the customer site first; click **Login** in its header. A login card opens on the same page, and a successful sign-in takes you to the admin dashboard. There is no separate login page.

> MongoDB is the only database driver. Production uses MongoDB Atlas (or any hosted MongoDB), Cloudinary and Node 22+. The existing Badshah Complex Retailer/Admin application is untouched.

## Ports / URLs

| What | Address | Notes |
| --- | --- | --- |
| Customer site | http://localhost:5175/ | Root opens the customer home page |
| Admin site | http://localhost:5175/admin | Served from `admin/dist` by the customer dev server |
| Backend API | http://localhost:4000 | Proxied via `/api` and `/uploads` on port 5175 |
| Local MongoDB | mongodb://127.0.0.1:27017 | Started by `npm run db:local`; data persists in `backend/data/mongo/` |

Port 5173 is left alone because another local project already uses it.

## Run locally (3 terminals)

Terminal 1 — local MongoDB (free, no account needed):

```powershell
cd "C:\Users\Chaitanya\OneDrive\Desktop\badshah complex\backend"
npm install
npm run db:local
```

Leave this terminal running. It starts a real `mongod` on port 27017 and stores data under `backend/data/mongo/`. To use MongoDB Atlas instead, set `MONGODB_URI` and `MONGODB_DB` in `backend/.env` and skip this terminal.

Terminal 2 — backend:

```powershell
cd "C:\Users\Chaitanya\OneDrive\Desktop\badshah complex\backend"
npm install
npm run dev
```

On a fresh database, run `npm run seed` once to create exactly five main categories and their subcategories. It deletes all products, prices, brands and stock, so do not run it after importing existing data. To import the old SQLite catalogue instead, run `npm run db:migrate:sqlite-to-mongo -- --dry-run` and then `npm run db:migrate:sqlite-to-mongo`. Run `npm run db:verify` to check the connection, database name, collection reads and temporary-document CRUD; it never prints credentials or changes real data.

Terminal 3 — customer + admin pages:

```powershell
cd "C:\Users\Chaitanya\OneDrive\Desktop\badshah complex\customer"
npm install
npm run dev
```

Now open:

1. http://localhost:5175/ → customer site
2. Click **Login** in the header (or open http://localhost:5175/admin)
3. Sign in with the `ADMIN_USERNAME` and `ADMIN_PASSWORD` values from `backend/.env`. Those values are applied to the admin account on every backend start, so the configured login always works.

## Admin source changes

The admin panel is a separate app in `admin/`. Its built files in `admin/dist` are served at `/admin`. If you edit admin source code, rebuild it once:

```powershell
cd "C:\Users\Chaitanya\OneDrive\Desktop\badshah complex\admin"
npm install
npm run build
```

You do **not** need to run `npm run dev` inside `admin/` for normal use.

## Catalogue structure

Exactly five main categories are seeded:

1. Cement — Dalmia Cement, PPC Cement, OPC Cement
2. Sand & Aggregates — River Sand, White Sand, Stone Chips (Gitti), Stone Dust
3. TMT Bars & Steel — TMT Bars, 8mm, 10mm, 12mm, 16mm, 20mm, Other Steel Products
4. Doors & Windows — Wooden Doors, Steel Doors, Door Frames, Windows
5. Bricks & Blocks — Red Bricks, Fly Ash Bricks, Concrete Blocks, Cement Blocks

Category, subcategory and product are separate entities. A product belongs to exactly one category; a subcategory is optional and belongs to one main category. Leave subcategory blank to show a product directly under its category.

## Panels

**Admin** (`/admin`): dashboard totals, category CRUD, subcategory CRUD and product CRUD. Images use the native camera/gallery picker with up to 8 product photos, previews, retake/replace/remove, validation and compression. Products include name, brand, description, price, unit, stock, category, optional subcategory, Active/Inactive and star priority 0–3. Deleting a category or subcategory with content asks for a safe destination and moves products instead of deleting them.

**Customer** (`/`): hero, category grid, subcategory browsing, product detail, search, category/subcategory/in-stock/price filters, price and availability, priority/price sorting. Categories and products are never mixed; only active products are shown under their correct category, with optional subcategory narrowing.

Admin writes are reflected on the customer panel immediately because both use the same database and services.

## Verification

```powershell
cd backend;  npm test
cd customer; npm run build
cd admin;    npm run build
```

## Local details

- Database: MongoDB collections `admins`, `admin_sessions`, `categories`, `subcategories` and `products` in the database named by `MONGODB_DB`. Local dev data lives in `backend/data/mongo/` (gitignored); hosted dev/prod uses the URI in `MONGODB_URI`.
- Images: `backend/uploads/` (gitignored), served at `/uploads/...`.
- `backend/.env.example` is the config template; `.env` is gitignored.
- See `docs/migration-to-mongodb.md` to import the old SQLite catalogue with `npm run db:migrate:sqlite-to-mongo`.

## Production images (Cloudinary)

Set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET` in the backend environment. New product, category and subcategory uploads then go to Cloudinary automatically under `badshah-complex/products`, `badshah-complex/categories` and `badshah-complex/subcategories`. Keep these secrets in the hosting env, never in git.

Existing `/uploads/...` images can be moved with:

```powershell
cd backend
npm run images:migrate:cloudinary -- --dry-run
npm run images:migrate:cloudinary
```

Add `--delete-local` only after checking the results. Without Cloudinary credentials the app keeps using local `backend/uploads/`.

## Deployment layout

- API, customer and admin: Render blueprint in `render.yaml`, with MongoDB Atlas as the external database.
- Customer: `https://badshah-customer.onrender.com/`
- Admin: `https://badshah-admin.onrender.com/` (served at the site root)
- Node version: `22.12.0` (root `.nvmrc` and `engines` in every package).

The blueprint sets `VITE_API_BASE`, `VITE_ADMIN_URL`, `VITE_CUSTOMER_URL`, `CORS_ORIGINS` and `NODE_ENV=production`. Set these Render API secrets in the dashboard (never in git): `MONGODB_URI`, `ADMIN_PASSWORD`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET`. The configured admin username/password are applied on every API start; rotate them in the host environment after deployment.
