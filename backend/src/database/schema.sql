-- Simple POS — SQLite Schema
-- Money is always an integer number of paisa (INTEGER), 1 Rupee = 100 Paisa.
-- Timestamps are stored as integer epoch-milliseconds (INTEGER).
-- UUIDs and texts are stored as TEXT.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('OWNER', 'MANAGER', 'CASHIER')),
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS waiters (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  active     INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  barcode        TEXT,
  category_id    TEXT REFERENCES categories(id) ON DELETE SET NULL,
  department     TEXT CHECK (department IN ('CHAI', 'PARHATA', 'GENERAL')),
  unit           TEXT,
  cost_price     INTEGER NOT NULL DEFAULT 0,
  selling_price  INTEGER NOT NULL DEFAULT 0,
  stock          INTEGER NOT NULL DEFAULT 0,
  active         INTEGER NOT NULL DEFAULT 1,
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sales (
  id                        TEXT PRIMARY KEY,
  display_id                TEXT NOT NULL,
  order_number              INTEGER NOT NULL DEFAULT 1,
  order_type                TEXT NOT NULL DEFAULT 'DINE_IN' CHECK (order_type IN ('DINE_IN', 'TAKE_AWAY')),
  status                    TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PAID', 'VOIDED')),
  taken_by                  TEXT NOT NULL DEFAULT 'Cashier',
  subtotal                  INTEGER NOT NULL,
  discount                  INTEGER NOT NULL DEFAULT 0,
  total                     INTEGER NOT NULL,
  payment_method            TEXT NOT NULL CHECK (payment_method IN ('CASH', 'CARD', 'CREDIT')),
  amount_received           INTEGER,
  change_given              INTEGER,
  voided                    INTEGER NOT NULL DEFAULT 0,
  printed_department_items  TEXT,
  created_at                INTEGER NOT NULL,
  updated_at                INTEGER
);

CREATE TABLE IF NOT EXISTS sale_items (
  id            TEXT PRIMARY KEY,
  sale_id       TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id    TEXT,
  product_name  TEXT NOT NULL,
  department    TEXT,
  unit          TEXT,
  quantity      INTEGER NOT NULL,
  unit_price    INTEGER NOT NULL,
  cost_price    INTEGER NOT NULL DEFAULT 0,
  total         INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS expenses (
  id              TEXT PRIMARY KEY,
  description     TEXT NOT NULL,
  amount          INTEGER NOT NULL,
  category        TEXT NOT NULL,
  payment_method  TEXT NOT NULL CHECK (payment_method IN ('CASH', 'CARD', 'CREDIT')),
  notes           TEXT,
  created_at      INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS money_transactions (
  id            TEXT PRIMARY KEY,
  type          TEXT NOT NULL CHECK (type IN ('CASH_SALE', 'CARD_SALE', 'CREDIT_SALE', 'EXPENSE', 'WITHDRAWAL')),
  amount        INTEGER NOT NULL,
  reference_id  TEXT,
  created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales (created_at);
CREATE INDEX IF NOT EXISTS idx_sales_status ON sales (status);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items (sale_id);
CREATE INDEX IF NOT EXISTS idx_expenses_created_at ON expenses (created_at);
CREATE INDEX IF NOT EXISTS idx_money_transactions_created_at ON money_transactions (created_at);
CREATE INDEX IF NOT EXISTS idx_products_active ON products (active);
