# Badshah Complex — Customer Website (local build)

Two separate React + TypeScript panels on one Express/SQLite backend:

- **Customer panel** — public, read-only storefront at `http://localhost:5175/`
- **Admin panel** — private dashboard at `http://localhost:5175/admin` (login required)

Open the customer site first; click **Login** in its header. A login card opens on the same page, and a successful sign-in takes you to the admin dashboard. There is no separate login page.

> No MongoDB Atlas. No cloud deployment. The existing Badshah Complex Retailer/Admin application is untouched.

## Ports / URLs

| What | Address | Notes |
| --- | --- | --- |
| Customer site | http://localhost:5175/ | Root opens the customer home page |
| Admin site | http://localhost:5175/admin | Served from `admin/dist` by the customer dev server |
| Backend API | http://localhost:4000 | Proxied via `/api` and `/uploads` on port 5175 |

Port 5173 is left alone because another local project already uses it.

## Run locally (2 terminals)

Terminal 1 — backend:

```powershell
cd "C:\Users\Chaitanya\OneDrive\Desktop\badshah complex\backend"
npm install
npm run seed
npm run dev
```

`npm run seed` resets the catalogue to exactly five main categories and their subcategories. It does not create fake products, prices, brands or stock; add real products from the admin panel.

Terminal 2 — customer + admin pages:

```powershell
cd "C:\Users\Chaitanya\OneDrive\Desktop\badshah complex\customer"
npm install
npm run dev
```

Now open:

1. http://localhost:5175/ → customer site
2. Click **Login** in the header (or open http://localhost:5175/admin)
3. Sign in with `admin` / `admin123` (or the values in `backend/.env`) in the card; you land on the dashboard.

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

Category, subcategory and product are separate entities. A product belongs to one subcategory; a subcategory belongs to one main category.

## Panels

**Admin** (`/admin`): dashboard totals, category CRUD, subcategory CRUD and product CRUD. Images use the native camera/gallery picker with up to 8 product photos, previews, retake/replace/remove, validation and compression. Products include name, brand, description, price, unit, stock, category, subcategory, Active/Inactive and star priority 0–3. Deleting a category or subcategory with content asks for a safe destination and moves products instead of deleting them.

**Customer** (`/`): hero, category grid, subcategory browsing, product detail, search, category/subcategory/in-stock/price filters, price and availability, priority/price sorting. Categories and products are never mixed; only active products are shown under their correct subcategory.

Admin writes are reflected on the customer panel immediately because both use the same SQLite database and services.

## Verification

```powershell
cd backend;  npm test
cd customer; npm run build
cd admin;    npm run build
```

## Local details

- Database: `backend/data/badshah-customer.db` (gitignored).
- Images: `backend/uploads/` (gitignored), served at `/uploads/...`.
- `backend/.env.example` is the config template; `.env` is gitignored.
- See `docs/migration-to-mongodb.md` for the later MongoDB switch. The Atlas URI shared earlier is unused.

## Production images (Cloudinary)

Set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET` in the backend environment. New product, category and subcategory uploads then go to Cloudinary automatically under `badshah-complex/products`, `badshah-complex/categories` and `badshah-complex/subcategories`. Keep these secrets in the hosting env, never in git.

Existing `/uploads/...` images can be moved with:

```powershell
cd backend
npm run images:migrate:cloudinary -- --dry-run
npm run images:migrate:cloudinary
```

Add `--delete-local` only after checking the results. Without Cloudinary credentials the app keeps using local `backend/uploads/`.
