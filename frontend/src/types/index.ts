/**
 * All money values in this app are stored as integers in "paisa"
 * (1 rupee = 100 paisa) to avoid floating-point rounding errors.
 * Never store money as a JS `number` in rupees with decimals.
 */
export type Paisa = number;

export type SyncStatus = 'PENDING' | 'SYNCED' | 'FAILED';

export type PaymentMethod = 'CASH' | 'CARD' | 'CREDIT';

export type Department = 'CHAI' | 'PARHATA' | 'GENERAL';

export type OrderType = 'DINE_IN' | 'TAKE_AWAY';

export type OrderStatus = 'PENDING' | 'PAID' | 'VOIDED';

export interface Waiter {
  id: string;
  name: string;
  active: boolean;
  createdAt: number;
}

export interface Category {
  id: string;
  name: string;
  createdAt: number;
}

export interface Product {
  id: string;
  name: string;
  barcode?: string;
  categoryId: string | null;
  department?: Department;
  costPrice: Paisa;
  sellingPrice: Paisa;
  stock: number;
  active: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Sale {
  id: string;
  displayId: string; // e.g. SALE-20260811-001
  orderNumber: number; // Daily sequential number e.g. 1, 2, 3...
  orderType: OrderType; // DINE_IN or TAKE_AWAY
  status: OrderStatus; // PENDING, PAID, VOIDED
  takenBy: string; // Waiter name for Dine-in, Cashier for Takeaway
  subtotal: Paisa;
  discount: Paisa;
  total: Paisa;
  paymentMethod: PaymentMethod;
  amountReceived: Paisa | null; // cash only
  changeGiven: Paisa | null; // cash only
  voided: boolean;
  /** Tracks total quantities of each item already printed on departmental slips */
  printedDepartmentItems?: Record<string, number>;
  createdAt: number;
  updatedAt?: number;
  syncStatus: SyncStatus;
}

export interface SaleItem {
  id: string;
  saleId: string;
  productId: string;
  productName: string; // snapshot at time of sale
  department?: Department; // snapshot of department for KOT routing
  quantity: number;
  unitPrice: Paisa; // snapshot at time of sale (selling price)
  costPrice: Paisa; // snapshot at time of sale (for COGS in reports)
  total: Paisa;
}

export interface Expense {
  id: string;
  description: string;
  amount: Paisa;
  category: string;
  paymentMethod: PaymentMethod;
  notes?: string;
  createdAt: number;
  syncStatus: SyncStatus;
}

export type MoneyTransactionType =
  | 'CASH_SALE'
  | 'CARD_SALE'
  | 'CREDIT_SALE'
  | 'EXPENSE'
  | 'WITHDRAWAL';

export interface MoneyTransaction {
  id: string;
  type: MoneyTransactionType;
  amount: Paisa; // always positive; sign is implied by `type`
  referenceId: string | null; // sale id or expense id
  createdAt: number;
}

export interface SyncQueueItem {
  id: string;
  entity: 'sale' | 'expense' | 'product';
  entityId: string;
  status: SyncStatus;
  attempts: number;
  lastError?: string;
  createdAt: number;
}

export interface Setting {
  key: string;
  value: string;
}

/** Item currently sitting in the cart on the POS screen. */
export interface CartLine {
  id?: string;
  productId: string;
  name: string;
  department?: Department;
  unitPrice: Paisa;
  quantity: number;
  isCustomPrice?: boolean;
}


