import { db } from '../database/db';
import { generateId, generateSaleDisplayId } from '../utils/id';
import { sumPaisa } from '../utils/money';
import type {
  CartLine,
  PaymentMethod,
  MoneyTransactionType,
  OrderType,
  OrderStatus,
  Sale,
  SaleItem,
  Department,
} from '../types';

export interface CreateOrderInput {
  cart: CartLine[];
  orderType: OrderType;
  takenBy: string;
  status?: OrderStatus;
  paymentMethod?: PaymentMethod;
  amountReceived?: number | null; // paisa, cash only
}

export interface DepartmentItemSnapshot {
  productId: string;
  productName: string;
  quantity: number;
  department?: Department;
}

export interface OrderOperationResult {
  saleId: string;
  sale: Sale;
  items: SaleItem[];
  deltaItems?: DepartmentItemSnapshot[];
  chaiItems: DepartmentItemSnapshot[];
  parhataItems: DepartmentItemSnapshot[];
  isSupplementary?: boolean;
}

function getDepartmentItemKey(line: { productId: string; unitPrice?: number; name?: string }): string {
  return `${line.productId}_${line.unitPrice ?? 0}_${line.name ?? ''}`;
}

/**
 * Categorizes cart lines into Chai and Parhata departments.
 */
export function partitionDepartmentItems(lines: { productId: string; name?: string; productName?: string; quantity: number; department?: Department }[]) {
  const chaiItems: DepartmentItemSnapshot[] = [];
  const parhataItems: DepartmentItemSnapshot[] = [];

  for (const line of lines) {
    const dept = line.department;
    const itemSnapshot: DepartmentItemSnapshot = {
      productId: line.productId,
      productName: line.name ?? line.productName ?? 'Item',
      quantity: line.quantity,
      department: dept,
    };

    if (dept === 'CHAI') {
      chaiItems.push(itemSnapshot);
    } else if (dept === 'PARHATA') {
      parhataItems.push(itemSnapshot);
    }
  }

  return { chaiItems, parhataItems };
}

/**
 * Previews an order snapshot before committing to the database.
 * Pure in-memory calculation — does not write anything to Dexie/database.
 */
export async function prepareOrderPreview(
  cart: CartLine[],
  orderType: OrderType,
  takenBy: string,
  editingSale?: Sale | null
): Promise<OrderOperationResult> {
  const subtotal = sumPaisa(cart.map((l) => l.unitPrice * l.quantity));
  const discount = editingSale ? editingSale.discount : 0;
  const total = subtotal - discount;

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const salesToday = await db.sales.where('createdAt').aboveOrEqual(startOfDay).count();
  const orderNumber = editingSale ? editingSale.orderNumber : salesToday + 1;
  const displayId = editingSale ? editingSale.displayId : generateSaleDisplayId(now, salesToday);

  const previewItems: SaleItem[] = cart.map((line) => ({
    id: generateId(),
    saleId: editingSale?.id || 'preview',
    productId: line.productId,
    productName: line.name,
    department: line.department,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    costPrice: 0,
    total: line.unitPrice * line.quantity,
  }));

  if (editingSale) {
    // Delta for editing
    const previousPrinted = editingSale.printedDepartmentItems ?? {};
    const deltaLines: DepartmentItemSnapshot[] = [];

    for (const line of cart) {
      const itemKey = getDepartmentItemKey(line);
      const prevQty = previousPrinted[itemKey] ?? previousPrinted[line.productId] ?? 0;
      const additionalQty = line.quantity - prevQty;
      if (additionalQty > 0) {
        deltaLines.push({
          productId: line.productId,
          productName: line.name,
          quantity: additionalQty,
          department: line.department,
        });
      }
    }

    const { chaiItems, parhataItems } = partitionDepartmentItems(deltaLines);

    const previewSale: Sale = {
      ...editingSale,
      takenBy: takenBy.trim() || editingSale.takenBy,
      subtotal,
      total,
      updatedAt: now.getTime(),
    };

    return {
      saleId: editingSale.id,
      sale: previewSale,
      items: previewItems,
      deltaItems: deltaLines,
      chaiItems,
      parhataItems,
      isSupplementary: true,
    };
  }

  const { chaiItems, parhataItems } = partitionDepartmentItems(cart);

  const previewSale: Sale = {
    id: 'preview',
    displayId,
    orderNumber,
    orderType,
    status: 'PENDING',
    takenBy: takenBy.trim() || (orderType === 'DINE_IN' ? 'Waiter' : 'Cashier'),
    subtotal,
    discount,
    total,
    paymentMethod: 'CASH',
    amountReceived: null,
    changeGiven: null,
    voided: false,
    printedDepartmentItems: {},
    createdAt: now.getTime(),
    updatedAt: now.getTime(),
    syncStatus: 'PENDING',
  };

  return {
    saleId: 'preview',
    sale: previewSale,
    items: previewItems,
    chaiItems,
    parhataItems,
    isSupplementary: false,
  };
}

/**
 * Creates a new order (either PENDING for Dine-In / Takeaway or directly PAID).
 */
export async function createOrder(input: CreateOrderInput): Promise<OrderOperationResult> {
  const {
    cart,
    orderType,
    takenBy,
    status = 'PENDING',
    paymentMethod = 'CASH',
    amountReceived = null,
  } = input;

  if (cart.length === 0) throw new Error('Cannot create an order with an empty cart');

  const subtotal = sumPaisa(cart.map((l) => l.unitPrice * l.quantity));
  const discount = 0;
  const total = subtotal - discount;

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const salesToday = await db.sales.where('createdAt').aboveOrEqual(startOfDay).count();
  const orderNumber = salesToday + 1;

  const saleId = generateId();
  const changeGiven =
    paymentMethod === 'CASH' && amountReceived != null && status === 'PAID'
      ? amountReceived - total
      : null;

  // Build printed department items tracker for all items on initial creation
  const printedDepartmentItems: Record<string, number> = {};
  for (const line of cart) {
    const itemKey = getDepartmentItemKey(line);
    printedDepartmentItems[itemKey] = (printedDepartmentItems[itemKey] ?? 0) + line.quantity;
    printedDepartmentItems[line.productId] = (printedDepartmentItems[line.productId] ?? 0) + line.quantity;
  }

  const newSale: Sale = {
    id: saleId,
    displayId: generateSaleDisplayId(now, salesToday),
    orderNumber,
    orderType,
    status,
    takenBy: takenBy.trim() || (orderType === 'DINE_IN' ? 'Waiter' : 'Cashier'),
    subtotal,
    discount,
    total,
    paymentMethod,
    amountReceived: status === 'PAID' && paymentMethod === 'CASH' ? amountReceived : null,
    changeGiven,
    voided: false,
    printedDepartmentItems,
    createdAt: now.getTime(),
    updatedAt: now.getTime(),
    syncStatus: 'PENDING',
  };

  const createdItems: SaleItem[] = [];

  await db.transaction(
    'rw',
    db.sales,
    db.saleItems,
    db.products,
    db.moneyTransactions,
    db.syncQueue,
    async () => {
      await db.sales.add(newSale);

      for (const line of cart) {
        const product = await db.products.get(line.productId);
        const item: SaleItem = {
          id: generateId(),
          saleId,
          productId: line.productId,
          productName: line.name,
          department: line.department ?? product?.department,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          costPrice: product?.costPrice ?? 0,
          total: line.unitPrice * line.quantity,
        };

        await db.saleItems.add(item);
        createdItems.push(item);

        if (status === 'PAID' && product) {
          const newStock = product.stock - line.quantity;
          await db.products.update(line.productId, {
            stock: newStock < 0 ? 0 : newStock,
            updatedAt: Date.now(),
          });
        }
      }

      if (status === 'PAID') {
        const txnType: MoneyTransactionType =
          paymentMethod === 'CASH' ? 'CASH_SALE' : paymentMethod === 'CARD' ? 'CARD_SALE' : 'CREDIT_SALE';

        await db.moneyTransactions.add({
          id: generateId(),
          type: txnType,
          amount: total,
          referenceId: saleId,
          createdAt: now.getTime(),
        });
      }

      await db.syncQueue.add({
        id: generateId(),
        entity: 'sale',
        entityId: saleId,
        status: 'PENDING',
        attempts: 0,
        createdAt: now.getTime(),
      });
    }
  );

  const { chaiItems, parhataItems } = partitionDepartmentItems(cart);

  return {
    saleId,
    sale: newSale,
    items: createdItems,
    chaiItems,
    parhataItems,
    isSupplementary: false,
  };
}

/**
 * Updates an existing pending order (e.g. customer added new items to their table bill).
 * Identifies ONLY the additional/new items and prepares an add-on kitchen slip.
 */
export async function updatePendingOrder(
  orderId: string,
  updatedCart: CartLine[],
  takenBy?: string
): Promise<OrderOperationResult> {
  const existingSale = await db.sales.get(orderId);
  if (!existingSale) throw new Error(`Order ${orderId} not found`);
  if (existingSale.voided) throw new Error('Cannot modify a voided order');
  if (updatedCart.length === 0) throw new Error('Order cannot be empty');

  const subtotal = sumPaisa(updatedCart.map((l) => l.unitPrice * l.quantity));
  const discount = existingSale.discount;
  const total = subtotal - discount;
  const now = Date.now();

  const previousPrinted = existingSale.printedDepartmentItems ?? {};
  const newPrinted: Record<string, number> = { ...previousPrinted };

  // Calculate delta: strictly the newly added items and increased quantities
  const deltaLines: DepartmentItemSnapshot[] = [];

  for (const line of updatedCart) {
    const itemKey = getDepartmentItemKey(line);
    const prevQty = previousPrinted[itemKey] ?? previousPrinted[line.productId] ?? 0;
    const additionalQty = line.quantity - prevQty;

    if (additionalQty > 0) {
      deltaLines.push({
        productId: line.productId,
        productName: line.name,
        quantity: additionalQty,
        department: line.department,
      });
    }

    newPrinted[itemKey] = Math.max(previousPrinted[itemKey] ?? 0, line.quantity);
    newPrinted[line.productId] = Math.max(previousPrinted[line.productId] ?? 0, line.quantity);
  }

  const updatedSale: Sale = {
    ...existingSale,
    takenBy: takenBy ? takenBy.trim() : existingSale.takenBy,
    subtotal,
    total,
    printedDepartmentItems: newPrinted,
    updatedAt: now,
    syncStatus: 'PENDING',
  };

  const updatedItems: SaleItem[] = [];

  await db.transaction('rw', db.sales, db.saleItems, db.products, async () => {
    await db.sales.put(updatedSale);

    // Replace sale items with updated cart
    await db.saleItems.where('saleId').equals(orderId).delete();

    for (const line of updatedCart) {
      const product = await db.products.get(line.productId);
      const item: SaleItem = {
        id: generateId(),
        saleId: orderId,
        productId: line.productId,
        productName: line.name,
        department: line.department ?? product?.department,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        costPrice: product?.costPrice ?? 0,
        total: line.unitPrice * line.quantity,
      };
      await db.saleItems.add(item);
      updatedItems.push(item);
    }
  });

  const { chaiItems, parhataItems } = partitionDepartmentItems(deltaLines);

  return {
    saleId: orderId,
    sale: updatedSale,
    items: updatedItems,
    deltaItems: deltaLines,
    chaiItems,
    parhataItems,
    isSupplementary: true,
  };
}

/**
 * Settles a pending bill when the customer/waiter pays.
 */
export async function settlePendingOrder(
  orderId: string,
  paymentMethod: PaymentMethod,
  amountReceived: number | null
): Promise<Sale> {
  const sale = await db.sales.get(orderId);
  if (!sale) throw new Error(`Order ${orderId} not found`);
  if (sale.status === 'PAID') throw new Error('Order is already paid');
  if (sale.voided) throw new Error('Cannot settle a voided order');

  const items = await db.saleItems.where('saleId').equals(orderId).toArray();
  const now = Date.now();
  const changeGiven =
    paymentMethod === 'CASH' && amountReceived != null ? amountReceived - sale.total : null;

  const settledSale: Sale = {
    ...sale,
    status: 'PAID',
    paymentMethod,
    amountReceived: paymentMethod === 'CASH' ? amountReceived : null,
    changeGiven,
    updatedAt: now,
    syncStatus: 'PENDING',
  };

  await db.transaction(
    'rw',
    db.sales,
    db.products,
    db.moneyTransactions,
    db.syncQueue,
    async () => {
      await db.sales.put(settledSale);

      // Decrement product stock upon clearance
      for (const item of items) {
        if (item.productId) {
          const product = await db.products.get(item.productId);
          if (product) {
            const newStock = product.stock - item.quantity;
            await db.products.update(item.productId, {
              stock: newStock < 0 ? 0 : newStock,
              updatedAt: now,
            });
          }
        }
      }

      const txnType: MoneyTransactionType =
        paymentMethod === 'CASH' ? 'CASH_SALE' : paymentMethod === 'CARD' ? 'CARD_SALE' : 'CREDIT_SALE';

      await db.moneyTransactions.add({
        id: generateId(),
        type: txnType,
        amount: sale.total,
        referenceId: orderId,
        createdAt: now,
      });

      await db.syncQueue.add({
        id: generateId(),
        entity: 'sale',
        entityId: orderId,
        status: 'PENDING',
        attempts: 0,
        createdAt: now,
      });
    }
  );

  return settledSale;
}

/**
 * Voids/cancels an active or completed order.
 */
export async function voidOrder(orderId: string): Promise<void> {
  const sale = await db.sales.get(orderId);
  if (!sale) throw new Error(`Order ${orderId} not found`);

  const wasPaid = sale.status === 'PAID';
  const items = await db.saleItems.where('saleId').equals(orderId).toArray();
  const now = Date.now();

  await db.transaction('rw', db.sales, db.products, async () => {
    await db.sales.update(orderId, {
      voided: true,
      status: 'VOIDED',
      updatedAt: now,
      syncStatus: 'PENDING',
    });

    // If it was already paid and stock was decremented, restore stock
    if (wasPaid) {
      for (const item of items) {
        if (item.productId) {
          const product = await db.products.get(item.productId);
          if (product) {
            await db.products.update(item.productId, {
              stock: product.stock + item.quantity,
              updatedAt: now,
            });
          }
        }
      }
    }
  });
}

/** Legacy wrapper for backwards compatibility */
export async function completeSale(input: {
  cart: CartLine[];
  paymentMethod: PaymentMethod;
  amountReceived: number | null;
}) {
  const result = await createOrder({
    cart: input.cart,
    orderType: 'TAKE_AWAY',
    takenBy: 'Cashier',
    status: 'PAID',
    paymentMethod: input.paymentMethod,
    amountReceived: input.amountReceived,
  });
  return result.saleId;
}
