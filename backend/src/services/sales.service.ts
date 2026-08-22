import { randomUUID } from 'node:crypto';
import { db } from '../database/db.js';
import { ApiError } from '../utils/ApiError.js';
import type { CartLine, Department, OrderStatus, OrderType, PaymentMethod, Sale, SaleItem } from '../models/types.js';

interface SaleRow {
  id: string;
  display_id: string;
  order_number: number;
  order_type: OrderType;
  status: OrderStatus;
  taken_by: string;
  subtotal: number;
  discount: number;
  total: number;
  payment_method: PaymentMethod;
  amount_received: number | null;
  change_given: number | null;
  voided: number;
  printed_department_items: string | null;
  created_at: number;
  updated_at: number | null;
}

interface SaleItemRow {
  id: string;
  sale_id: string;
  product_id: string | null;
  product_name: string;
  department: Department | null;
  unit: string | null;
  quantity: number;
  unit_price: number;
  cost_price: number;
  total: number;
}

function toSale(row: SaleRow): Sale {
  return {
    id: row.id,
    displayId: row.display_id,
    orderNumber: row.order_number ?? 1,
    orderType: row.order_type ?? 'DINE_IN',
    status: row.status ?? 'PAID',
    takenBy: row.taken_by ?? 'Cashier',
    subtotal: row.subtotal,
    discount: row.discount,
    total: row.total,
    paymentMethod: row.payment_method,
    amountReceived: row.amount_received,
    changeGiven: row.change_given,
    voided: Boolean(row.voided),
    printedDepartmentItems: row.printed_department_items ? JSON.parse(row.printed_department_items) : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? undefined,
  };
}

function toSaleItem(row: SaleItemRow): SaleItem {
  return {
    id: row.id,
    saleId: row.sale_id,
    productId: row.product_id,
    productName: row.product_name,
    department: row.department ?? undefined,
    unit: row.unit ?? undefined,
    quantity: row.quantity,
    unitPrice: row.unit_price,
    costPrice: row.cost_price,
    total: row.total,
  };
}

export function generateSaleDisplayId(date: Date, index: number): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const seq = String(index + 1).padStart(3, '0');
  return `SALE-${y}${m}${d}-${seq}`;
}

export async function listSales(from?: number, to?: number, status?: string): Promise<Sale[]> {
  let query = 'SELECT * FROM sales';
  const params: any[] = [];
  const clauses: string[] = [];

  if (from != null && to != null) {
    clauses.push('created_at BETWEEN ? AND ?');
    params.push(from, to);
  }

  if (status) {
    clauses.push('status = ?');
    params.push(status);
  }

  if (clauses.length > 0) {
    query += ' WHERE ' + clauses.join(' AND ');
  }

  query += ' ORDER BY created_at DESC';

  const rows = db.prepare(query).all(...params) as SaleRow[];
  return rows.map(toSale);
}

export async function getSale(id: string): Promise<{ sale: Sale; items: SaleItem[] }> {
  const saleRow = db.prepare('SELECT * FROM sales WHERE id = ?').get(id) as SaleRow | undefined;
  if (!saleRow) throw new ApiError(404, `Sale ${id} not found`);

  const itemRows = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(id) as SaleItemRow[];
  return {
    sale: toSale(saleRow),
    items: itemRows.map(toSaleItem),
  };
}

export async function getAllSalesWithItems(): Promise<{ sales: Sale[]; itemsMap: Record<string, SaleItem[]> }> {
  const sales = (db.prepare('SELECT * FROM sales ORDER BY created_at DESC').all() as SaleRow[]).map(toSale);
  const items = (db.prepare('SELECT * FROM sale_items').all() as SaleItemRow[]).map(toSaleItem);

  const itemsMap: Record<string, SaleItem[]> = {};
  for (const item of items) {
    if (!itemsMap[item.saleId]) {
      itemsMap[item.saleId] = [];
    }
    itemsMap[item.saleId].push(item);
  }

  return { sales, itemsMap };
}

export async function getPendingOrdersCount(): Promise<number> {
  const row = db.prepare("SELECT COUNT(*) as count FROM sales WHERE status = 'PENDING'").get() as { count: number };
  return row.count;
}

export interface CreateOrderPayload {
  cart: CartLine[];
  orderType: OrderType;
  takenBy: string;
  status?: OrderStatus;
  paymentMethod?: PaymentMethod;
  amountReceived?: number | null;
}

export async function createOrder(input: CreateOrderPayload): Promise<{ sale: Sale; items: SaleItem[] }> {
  const {
    cart,
    orderType,
    takenBy,
    status = 'PENDING',
    paymentMethod = 'CASH',
    amountReceived = null,
  } = input;

  if (!cart || cart.length === 0) {
    throw new ApiError(400, 'Cannot create an order with an empty cart');
  }

  const subtotal = cart.reduce((acc, l) => acc + l.unitPrice * l.quantity, 0);
  const discount = 0;
  const total = subtotal - discount;

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  const countRow = db.prepare('SELECT COUNT(*) as count FROM sales WHERE created_at >= ?').get(startOfDay) as { count: number };
  const salesToday = countRow.count;
  const orderNumber = salesToday + 1;
  const saleId = randomUUID();
  const displayId = generateSaleDisplayId(now, salesToday);

  const changeGiven =
    paymentMethod === 'CASH' && amountReceived != null && status === 'PAID'
      ? amountReceived - total
      : null;

  const printedDepartmentItems: Record<string, number> = {};
  for (const line of cart) {
    const key = `${line.productId}_${line.unitPrice}_${line.name}`;
    printedDepartmentItems[key] = (printedDepartmentItems[key] ?? 0) + line.quantity;
    printedDepartmentItems[line.productId] = (printedDepartmentItems[line.productId] ?? 0) + line.quantity;
  }

  const createdItems: SaleItem[] = [];

  const executeTransaction = db.transaction(() => {
    // 1. Insert into sales
    db.prepare(`
      INSERT INTO sales (
        id, display_id, order_number, order_type, status, taken_by,
        subtotal, discount, total, payment_method, amount_received,
        change_given, voided, printed_department_items, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
    `).run(
      saleId,
      displayId,
      orderNumber,
      orderType,
      status,
      takenBy.trim() || (orderType === 'DINE_IN' ? 'Waiter' : 'Cashier'),
      subtotal,
      discount,
      total,
      paymentMethod,
      status === 'PAID' && paymentMethod === 'CASH' ? amountReceived : null,
      changeGiven,
      JSON.stringify(printedDepartmentItems),
      now.getTime(),
      now.getTime()
    );

    // 2. Insert sale_items and adjust stock if PAID
    const insertItem = db.prepare(`
      INSERT INTO sale_items (id, sale_id, product_id, product_name, department, unit, quantity, unit_price, cost_price, total)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const updateStock = db.prepare(`
      UPDATE products SET stock = MAX(stock - ?, 0), updated_at = ? WHERE id = ?
    `);

    for (const line of cart) {
      const prod = line.productId
        ? (db.prepare('SELECT * FROM products WHERE id = ?').get(line.productId) as any)
        : null;

      const itemId = randomUUID();
      const costPrice = prod?.cost_price ?? 0;
      const dept = line.department ?? prod?.department ?? null;
      const unit = line.unit ?? prod?.unit ?? null;
      const itemTotal = line.unitPrice * line.quantity;

      insertItem.run(
        itemId,
        saleId,
        line.productId || null,
        line.name,
        dept,
        unit,
        line.quantity,
        line.unitPrice,
        costPrice,
        itemTotal
      );

      createdItems.push({
        id: itemId,
        saleId,
        productId: line.productId || null,
        productName: line.name,
        department: dept ?? undefined,
        unit: unit ?? undefined,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        costPrice,
        total: itemTotal,
      });

      if (status === 'PAID' && line.productId) {
        updateStock.run(line.quantity, now.getTime(), line.productId);
      }
    }

    // 3. Log money transaction if PAID
    if (status === 'PAID') {
      const txnType =
        paymentMethod === 'CASH' ? 'CASH_SALE' : paymentMethod === 'CARD' ? 'CARD_SALE' : 'CREDIT_SALE';

      db.prepare(`
        INSERT INTO money_transactions (id, type, amount, reference_id, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(randomUUID(), txnType, total, saleId, now.getTime());
    }
  });

  executeTransaction();

  const createdSale = (await getSale(saleId)).sale;
  return { sale: createdSale, items: createdItems };
}

export async function updatePendingOrder(
  orderId: string,
  updatedCart: CartLine[],
  takenBy?: string
): Promise<{ sale: Sale; items: SaleItem[] }> {
  const existing = db.prepare('SELECT * FROM sales WHERE id = ?').get(orderId) as SaleRow | undefined;
  if (!existing) throw new ApiError(404, `Order ${orderId} not found`);
  if (existing.voided || existing.status === 'VOIDED') throw new ApiError(400, 'Cannot modify a voided order');
  if (existing.status === 'PAID') throw new ApiError(400, 'Cannot modify an already paid order');
  if (!updatedCart || updatedCart.length === 0) throw new ApiError(400, 'Order cannot be empty');

  const subtotal = updatedCart.reduce((acc, l) => acc + l.unitPrice * l.quantity, 0);
  const discount = existing.discount;
  const total = subtotal - discount;
  const now = Date.now();

  const previousPrinted: Record<string, number> = existing.printed_department_items
    ? JSON.parse(existing.printed_department_items)
    : {};
  const newPrinted: Record<string, number> = { ...previousPrinted };

  for (const line of updatedCart) {
    const key = `${line.productId}_${line.unitPrice}_${line.name}`;
    newPrinted[key] = Math.max(previousPrinted[key] ?? 0, line.quantity);
    newPrinted[line.productId] = Math.max(previousPrinted[line.productId] ?? 0, line.quantity);
  }

  const updatedItems: SaleItem[] = [];

  const executeTransaction = db.transaction(() => {
    // 1. Update sales record
    db.prepare(`
      UPDATE sales SET
        taken_by = ?,
        subtotal = ?,
        total = ?,
        printed_department_items = ?,
        updated_at = ?
      WHERE id = ?
    `).run(
      takenBy?.trim() || existing.taken_by,
      subtotal,
      total,
      JSON.stringify(newPrinted),
      now,
      orderId
    );

    // 2. Delete existing line items & replace with updated cart lines
    db.prepare('DELETE FROM sale_items WHERE sale_id = ?').run(orderId);

    const insertItem = db.prepare(`
      INSERT INTO sale_items (id, sale_id, product_id, product_name, department, unit, quantity, unit_price, cost_price, total)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const line of updatedCart) {
      const prod = line.productId
        ? (db.prepare('SELECT * FROM products WHERE id = ?').get(line.productId) as any)
        : null;

      const itemId = randomUUID();
      const costPrice = prod?.cost_price ?? 0;
      const dept = line.department ?? prod?.department ?? null;
      const unit = line.unit ?? prod?.unit ?? null;
      const itemTotal = line.unitPrice * line.quantity;

      insertItem.run(
        itemId,
        orderId,
        line.productId || null,
        line.name,
        dept,
        unit,
        line.quantity,
        line.unitPrice,
        costPrice,
        itemTotal
      );

      updatedItems.push({
        id: itemId,
        saleId: orderId,
        productId: line.productId || null,
        productName: line.name,
        department: dept ?? undefined,
        unit: unit ?? undefined,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        costPrice,
        total: itemTotal,
      });
    }
  });

  executeTransaction();

  const sale = (await getSale(orderId)).sale;
  return { sale, items: updatedItems };
}

export async function settlePendingOrder(
  orderId: string,
  paymentMethod: PaymentMethod,
  amountReceived: number | null
): Promise<Sale> {
  const existing = db.prepare('SELECT * FROM sales WHERE id = ?').get(orderId) as SaleRow | undefined;
  if (!existing) throw new ApiError(404, `Order ${orderId} not found`);
  if (existing.status === 'PAID') throw new ApiError(400, 'Order is already paid');
  if (existing.voided || existing.status === 'VOIDED') throw new ApiError(400, 'Cannot settle a voided order');

  const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(orderId) as SaleItemRow[];
  const now = Date.now();
  const changeGiven =
    paymentMethod === 'CASH' && amountReceived != null ? amountReceived - existing.total : null;

  const executeTransaction = db.transaction(() => {
    // 1. Mark as PAID
    db.prepare(`
      UPDATE sales SET
        status = 'PAID',
        payment_method = ?,
        amount_received = ?,
        change_given = ?,
        updated_at = ?
      WHERE id = ?
    `).run(
      paymentMethod,
      paymentMethod === 'CASH' ? amountReceived : null,
      changeGiven,
      now,
      orderId
    );

    // 2. Decrement stock
    const updateStock = db.prepare(`
      UPDATE products SET stock = MAX(stock - ?, 0), updated_at = ? WHERE id = ?
    `);

    for (const item of items) {
      if (item.product_id) {
        updateStock.run(item.quantity, now, item.product_id);
      }
    }

    // 3. Record money transaction
    const txnType =
      paymentMethod === 'CASH' ? 'CASH_SALE' : paymentMethod === 'CARD' ? 'CARD_SALE' : 'CREDIT_SALE';

    db.prepare(`
      INSERT INTO money_transactions (id, type, amount, reference_id, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(randomUUID(), txnType, existing.total, orderId, now);
  });

  executeTransaction();

  return (await getSale(orderId)).sale;
}

export async function voidOrder(orderId: string): Promise<void> {
  const existing = db.prepare('SELECT * FROM sales WHERE id = ?').get(orderId) as SaleRow | undefined;
  if (!existing) throw new ApiError(404, `Order ${orderId} not found`);

  const wasPaid = existing.status === 'PAID';
  const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(orderId) as SaleItemRow[];
  const now = Date.now();

  const executeTransaction = db.transaction(() => {
    // 1. Update sales to VOIDED
    db.prepare(`
      UPDATE sales SET
        voided = 1,
        status = 'VOIDED',
        updated_at = ?
      WHERE id = ?
    `).run(now, orderId);

    // 2. If it was already paid and stock was decremented, restore stock and remove transaction
    if (wasPaid) {
      db.prepare('DELETE FROM money_transactions WHERE reference_id = ?').run(orderId);

      const restoreStock = db.prepare(`
        UPDATE products SET stock = stock + ?, updated_at = ? WHERE id = ?
      `);

      for (const item of items) {
        if (item.product_id) {
          restoreStock.run(item.quantity, now, item.product_id);
        }
      }
    }
  });

  executeTransaction();
}
