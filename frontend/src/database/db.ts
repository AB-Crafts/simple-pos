import Dexie, { type Table } from 'dexie';
import type {
  Product,
  Category,
  Sale,
  SaleItem,
  Expense,
  MoneyTransaction,
  SyncQueueItem,
  Setting,
  Waiter,
} from '../types';

/**
 * The local, offline-first database. Every write in the app goes here
 * first — the app never waits on a network request to function.
 */
export class POSDatabase extends Dexie {
  products!: Table<Product, string>;
  categories!: Table<Category, string>;
  sales!: Table<Sale, string>;
  saleItems!: Table<SaleItem, string>;
  expenses!: Table<Expense, string>;
  moneyTransactions!: Table<MoneyTransaction, string>;
  syncQueue!: Table<SyncQueueItem, string>;
  settings!: Table<Setting, string>;
  waiters!: Table<Waiter, string>;

  constructor() {
    super('simple-pos-db');

    this.version(1).stores({
      products: 'id, name, barcode, categoryId, active',
      categories: 'id, name',
      sales: 'id, createdAt, syncStatus, voided',
      saleItems: 'id, saleId, productId',
      expenses: 'id, createdAt, syncStatus, category',
      moneyTransactions: 'id, type, createdAt',
      syncQueue: 'id, entity, status, createdAt',
      settings: 'key',
    });

    this.version(2).stores({
      products: 'id, name, barcode, categoryId, department, active',
      categories: 'id, name',
      sales: 'id, displayId, orderNumber, orderType, status, takenBy, createdAt, syncStatus, voided',
      saleItems: 'id, saleId, productId, department',
      expenses: 'id, createdAt, syncStatus, category',
      moneyTransactions: 'id, type, createdAt',
      syncQueue: 'id, entity, status, createdAt',
      settings: 'key',
      waiters: 'id, name, active, createdAt',
    });
  }
}

export const db = new POSDatabase();

