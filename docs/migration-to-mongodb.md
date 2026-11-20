# MongoDB storage

The backend uses MongoDB only. `DB_DRIVER=mongo` selects the Mongo repositories in `src/db/index.js`; `sqlite` and `postgres` drivers were removed.

## Configuration

Set these in `backend/.env` (see `.env.example`):

```dotenv
DB_DRIVER=mongo
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB=badshah_custmer
```

For free local development, run `npm run db:local`. It starts a real `mongod` on port 27017 with persistent data in `backend/data/mongo/`. For hosted environments, use a MongoDB Atlas connection string in `MONGODB_URI` and keep it out of git.

Atlas database users authenticate against `admin`; `MONGODB_DB` is the application database (`badshah_custmer`) and is separate from the username. For Atlas SRV URIs the driver resolves records with public DNS servers by default; override them with `MONGODB_DNS_SERVERS` if needed. Do not force IPv4-first resolution or a manual TLS servername with SRV URIs, because that can break the TLS handshake. `npm run db:verify` reports connection, authentication identity, database name, collection reads and temporary-document CRUD without printing secrets or touching real documents.

## Collections and indexes

`src/db/mongo.js` connects, pings the database and creates these indexes on startup:

- `admins`: unique `id`, unique `username`
- `admin_sessions`: unique `token_hash`, `expires_at`
- `categories`: unique `id`, unique `slug`, `active + display_order`
- `subcategories`: unique `id`, unique `slug`, unique `name`, `category_id + active`
- `products`: unique `id`, unique `slug`, `category_id + active`, `subcategory_id + active`, `star_priority + created_at`

Document fields use the same snake_case names as the old SQL columns so existing IDs, timestamps and image arrays are preserved. DTOs are unchanged: UUID-style string ids, `images[]`, integer paise values, real booleans and ISO date strings.

## Importing the old SQLite data

The source file defaults to `backend/data/badshah-customer.db`; override it with `--from <path>`. The target URI/database come from `.env`, or can be passed with `--to <uri>` and `--db <name>`.

```powershell
cd backend
npm run db:migrate:sqlite-to-mongo:dry
npm run db:migrate:sqlite-to-mongo
```

The script backs up the SQLite file first, reads `admins`, `admin_sessions`, `categories`, `subcategories` and `products`, converts JSON image columns to arrays and `active` flags to booleans, then upserts by the original `id` (or `token_hash` for sessions). It is safe to rerun. Add `--replace` to clear each collection before importing, `--no-backup` to skip the SQLite backup, or `--from`, `--to` and `--db` to override paths.

## Tests

`npm test` starts an in-memory MongoDB with `mongodb-memory-server`, so no external database or credentials are needed. The full HTTP contract is exercised against the Mongo repositories.

## Unchanged

Both frontends, their routes and the auth UX (login/session token), image URLs from `/uploads`, validation schemas, and the separation from the existing retailer/admin application.
