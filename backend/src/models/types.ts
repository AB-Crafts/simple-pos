export type Paisa = number;
export type PaymentMethod = 'CASH' | 'CARD' | 'CREDIT';
export type UserRole = 'OWNER' | 'MANAGER' | 'CASHIER';
export type Department = 'CHAI' | 'PARHATA' | 'GENERAL';
export type OrderType = 'DINE_IN' | 'TAKE_AWAY';
export type OrderStatus = 'PENDING' | 'PAID' | 'CREDIT' | 'VOIDED';

export interface Waiter {
  id: string;
  name: string;
  active: boolean;
  createdAt: number;
}

export interface Product {
  id: string;
  name: string;
  barcode?: string | null;
  categoryId: string | null;
  department?: Department;
  unit?: string | null;
  costPrice: Paisa;
  sellingPrice: Paisa;
  stock: number;
  active: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Category {
  id: string;
  name: string;
  createdAt: number;
}

export interface SaleItem {
  id: string;
  saleId: string;
  productId: string | null;
  productName: string;
  department?: Department;
  unit?: string | null;
  quantity: number;
  unitPrice: Paisa;
  costPrice: Paisa;
  total: Paisa;
}

export interface Sale {
  id: string;
  displayId: string;
  orderNumber: number;
  orderType: OrderType;
  status: OrderStatus;
  takenBy: string;
  subtotal: Paisa;
  discount: Paisa;
  total: Paisa;
  paymentMethod: PaymentMethod;
  amountReceived: Paisa | null;
  changeGiven: Paisa | null;
  customerName?: string | null;
  customerContact?: string | null;
  voided: boolean;
  printedDepartmentItems?: Record<string, number>;
  createdAt: number;
  updatedAt?: number;
}

export interface Expense {
  id: string;
  description: string;
  amount: Paisa;
  category: string;
  paymentMethod: PaymentMethod;
  notes?: string | null;
  createdAt: number;
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
  amount: Paisa;
  referenceId: string | null;
  createdAt: number;
}

export interface Setting {
  key: string;
  value: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface CartLine {
  id?: string;
  productId: string;
  name: string;
  department?: Department;
  unit?: string;
  unitPrice: Paisa;
  quantity: number;
  isCustomPrice?: boolean;
}
