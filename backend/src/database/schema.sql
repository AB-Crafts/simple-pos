-- Simple POS — PostgreSQL schema
-- Mirrors the frontend's local Dexie/IndexedDB schema so a synced record
-- needs no reshaping between the two. Money is always an integer number
-- of paisa (bigint), matching the frontend's money-handling rule — never
-- use a floating-point/numeric type for currency here.
-- Timestamps are stored as bigint epoch-milliseconds (not timestamptz) so
-- they compare directly, byte-for-byte, with the values the offline app
-- already generated on the device — no timezone conversion either side.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('OWNER', 'MANAGER', 'CASHIER')),
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id         UUID PRIMARY KEY,
  name       TEXT NOT NULL,
  created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS waiters (
  id         UUID PRIMARY KEY,
  name       TEXT NOT NULL,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  id             UUID PRIMARY KEY,
  name           TEXT NOT NULL,
  barcode        TEXT,
  category_id    UUID REFERENCES categories(id) ON DELETE SET NULL,
  department     TEXT CHECK (department IN ('CHAI', 'PARHATA', 'GENERAL')),
  cost_price     BIGINT NOT NULL DEFAULT 0,
  selling_price  BIGINT NOT NULL DEFAULT 0,
  stock          INTEGER NOT NULL DEFAULT 0,
  active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     BIGINT NOT NULL,
  updated_at     BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS sales (
  id                        UUID PRIMARY KEY,
  display_id                TEXT NOT NULL,
  order_number              INTEGER NOT NULL DEFAULT 1,
  order_type                TEXT NOT NULL DEFAULT 'DINE_IN' CHECK (order_type IN ('DINE_IN', 'TAKE_AWAY')),
  status                    TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PAID', 'VOIDED')),
  taken_by                  TEXT NOT NULL DEFAULT 'Cashier',
  subtotal                  BIGINT NOT NULL,
  discount                  BIGINT NOT NULL DEFAULT 0,
  total                     BIGINT NOT NULL,
  payment_method            TEXT NOT NULL CHECK (payment_method IN ('CASH', 'CARD', 'CREDIT')),
  amount_received           BIGINT,
  change_given              BIGINT,
  voided                    BOOLEAN NOT NULL DEFAULT FALSE,
  printed_department_items  TEXT,
  created_at                BIGINT NOT NULL,
  updated_at                BIGINT,
  synced_at                 BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS sale_items (
  id            UUID PRIMARY KEY,
  sale_id       UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id    UUID,
  product_name  TEXT NOT NULL,
  department    TEXT,
  quantity      INTEGER NOT NULL,
  unit_price    BIGINT NOT NULL,
  cost_price    BIGINT NOT NULL DEFAULT 0,
  total         BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS expenses (
  id              UUID PRIMARY KEY,
  description     TEXT NOT NULL,
  amount          BIGINT NOT NULL,
  category        TEXT NOT NULL,
  payment_method  TEXT NOT NULL CHECK (payment_method IN ('CASH', 'CARD', 'CREDIT')),
  notes           TEXT,
  created_at      BIGINT NOT NULL,
  synced_at       BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS money_transactions (
  id            UUID PRIMARY KEY,
  type          TEXT NOT NULL CHECK (type IN ('CASH_SALE', 'CARD_SALE', 'CREDIT_SALE', 'EXPENSE', 'WITHDRAWAL')),
  amount        BIGINT NOT NULL,
  reference_id  TEXT,
  created_at    BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales (created_at);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items (sale_id);
CREATE INDEX IF NOT EXISTS idx_expenses_created_at ON expenses (created_at);
CREATE INDEX IF NOT EXISTS idx_money_transactions_created_at ON money_transactions (created_at);
CREATE INDEX IF NOT EXISTS idx_products_active ON products (active);
