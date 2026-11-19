PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS admins (
  id            TEXT PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin')),
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  token_hash TEXT PRIMARY KEY,
  admin_id   TEXT NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_admin ON admin_sessions (admin_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON admin_sessions (expires_at);

CREATE TABLE IF NOT EXISTS categories (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,
  description     TEXT NOT NULL DEFAULT '',
  image_url       TEXT,
  image_public_id TEXT,
  display_order   INTEGER NOT NULL DEFAULT 0,
  active          INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS subcategories (
  id              TEXT PRIMARY KEY,
  category_id     TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name            TEXT NOT NULL UNIQUE,
  slug            TEXT NOT NULL UNIQUE,
  description     TEXT NOT NULL DEFAULT '',
  image_url       TEXT,
  image_public_id TEXT,
  display_order   INTEGER NOT NULL DEFAULT 0,
  active          INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  slug             TEXT NOT NULL UNIQUE,
  brand            TEXT NOT NULL DEFAULT '',
  description      TEXT NOT NULL DEFAULT '',
  images           TEXT NOT NULL DEFAULT '[]',
  image_public_ids TEXT NOT NULL DEFAULT '[]',
  price_paise      INTEGER NOT NULL CHECK (price_paise >= 0),
  cost_paise       INTEGER NOT NULL DEFAULT 0 CHECK (cost_paise >= 0),
  stock            INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  unit             TEXT NOT NULL DEFAULT '',
  category_id      TEXT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  subcategory_id   TEXT REFERENCES subcategories(id) ON DELETE SET NULL,
  active           INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  star_priority    INTEGER NOT NULL DEFAULT 0 CHECK (star_priority BETWEEN 0 AND 3),
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_subcategories_category_active ON subcategories (category_id, active);
CREATE INDEX IF NOT EXISTS idx_products_category_active ON products (category_id, active);
CREATE INDEX IF NOT EXISTS idx_products_subcategory_active ON products (subcategory_id, active);
CREATE INDEX IF NOT EXISTS idx_products_priority_created ON products (star_priority DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_categories_active ON categories (active);
