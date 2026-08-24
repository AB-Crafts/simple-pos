import Database, { type Database as DatabaseType } from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { randomUUID } from 'node:crypto';

export function getDatabasePath(): string {
  if (process.env.POS_DB_PATH) {
    return process.env.POS_DB_PATH;
  }

  // Cross-platform persistent data directory outside source/build folders
  const home = os.homedir();
  const dir = path.join(home, '.simple-pos');
  return path.join(dir, 'pos.db');
}

const dbPath = getDatabasePath();
const dir = path.dirname(dbPath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

console.log(`[Database] Using persistent SQLite database at: ${dbPath}`);

export const db: DatabaseType = new Database(dbPath);

// Enable WAL mode for high concurrency & performance, and enable foreign key enforcement
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initializeDatabase() {
  // Execute table and index creation
  db.exec(`
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
  `);

  seedIfEmpty();
}

function seedIfEmpty() {
  const now = Date.now();
  const productCount = (db.prepare('SELECT COUNT(*) as count FROM products').get() as { count: number }).count;
  if (productCount === 0) {
    const chaiCatId = randomUUID();
    const parhataCatId = randomUUID();
    const drinksCatId = randomUUID();
    const snacksCatId = randomUUID();

    const insertCategory = db.prepare('INSERT INTO categories (id, name, created_at) VALUES (?, ?, ?)');
    const insertProduct = db.prepare(`
      INSERT INTO products (id, name, category_id, department, unit, cost_price, selling_price, stock, active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `);

    const seedCatalog = db.transaction(() => {
      insertCategory.run(chaiCatId, 'Chai', now);
      insertCategory.run(parhataCatId, 'Parhata', now);
      insertCategory.run(drinksCatId, 'Cold Drinks', now);
      insertCategory.run(snacksCatId, 'Snacks & Extras', now);

      // Chai Department (Prices in Paisa: 1 Rupee = 100 Paisa)
      insertProduct.run(randomUUID(), 'Karak Chai', chaiCatId, 'CHAI', 'cup', 3500, 7000, 200, now, now);
      insertProduct.run(randomUUID(), 'Doodh Patti', chaiCatId, 'CHAI', 'cup', 5500, 11000, 150, now, now);
      insertProduct.run(randomUUID(), 'Fresh Milk', chaiCatId, 'CHAI', 'kg', 16000, 20000, 100, now, now);
      insertProduct.run(randomUUID(), 'Elaichi Chai', chaiCatId, 'CHAI', 'cup', 4500, 9000, 100, now, now);
      insertProduct.run(randomUUID(), 'Kashmiri Chai', chaiCatId, 'CHAI', null, 7000, 14000, 80, now, now);
      insertProduct.run(randomUUID(), 'Green Tea / Qahwa', chaiCatId, 'CHAI', null, 3000, 6000, 120, now, now);

      // Parhata Department
      insertProduct.run(randomUUID(), 'Lacha Parhata', parhataCatId, 'PARHATA', null, 5000, 10000, 150, now, now);
      insertProduct.run(randomUUID(), 'Sada Parhata', parhataCatId, 'PARHATA', null, 4000, 8000, 150, now, now);
      insertProduct.run(randomUUID(), 'Aloo Parhata', parhataCatId, 'PARHATA', null, 7500, 15000, 80, now, now);
      insertProduct.run(randomUUID(), 'Anda Parhata', parhataCatId, 'PARHATA', null, 7000, 14000, 80, now, now);
      insertProduct.run(randomUUID(), 'Cheese Parhata', parhataCatId, 'PARHATA', null, 12000, 24000, 50, now, now);
      insertProduct.run(randomUUID(), 'Keema Parhata', parhataCatId, 'PARHATA', null, 14000, 27000, 40, now, now);
      insertProduct.run(randomUUID(), 'Meetha Parhata', parhataCatId, 'PARHATA', null, 6000, 12000, 60, now, now);

      // Drinks & Snacks (General)
      insertProduct.run(randomUUID(), 'Mineral Water 500ml', drinksCatId, 'GENERAL', null, 5000, 8000, 50, now, now);
      insertProduct.run(randomUUID(), 'Coke 300ml', drinksCatId, 'GENERAL', null, 6500, 9000, 40, now, now);
      insertProduct.run(randomUUID(), 'Sprite 300ml', drinksCatId, 'GENERAL', null, 6500, 9000, 40, now, now);
      insertProduct.run(randomUUID(), 'Plain Omelette', snacksCatId, 'GENERAL', null, 4000, 8000, 60, now, now);
      insertProduct.run(randomUUID(), 'Cheese Omelette', snacksCatId, 'GENERAL', null, 8000, 15000, 40, now, now);
    });

    seedCatalog();
    console.log('[Database] Seeded initial catalog categories and products');
  }
}

// Auto-initialize on import
initializeDatabase();

export function closeDatabase() {
  try {
    if (db && db.open) {
      db.pragma('wal_checkpoint(TRUNCATE)');
      db.close();
      console.log('[Database] SQLite database connection closed safely.');
    }
  } catch (err) {
    console.error('[Database] Error closing SQLite database:', err);
  }
}

