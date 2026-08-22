import { apiClient } from './apiClient';
import { generateSaleDisplayId } from '../utils/id';
import { sumPaisa } from '../utils/money';
import type {
  CartLine,
  PaymentMethod,
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
 * Pure in-memory calculation — does not write anything to database.
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

  let salesToday = 0;
  try {
    const countRes = await apiClient.get<{ count: number }>('/sales/pending-count');
    salesToday = countRes.count;
  } catch {
    salesToday = 0;
  }

  const orderNumber = editingSale ? editingSale.orderNumber : salesToday + 1;
  const displayId = editingSale ? editingSale.displayId : generateSaleDisplayId(now, salesToday);

  const previewItems: SaleItem[] = cart.map((line) => ({
    id: 'preview-' + line.productId,
    saleId: editingSale?.id || 'preview',
    productId: line.productId,
    productName: line.name,
    department: line.department,
    unit: line.unit,
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
    syncStatus: 'SYNCED',
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
 * Creates a new order via SQLite backend (either PENDING or directly PAID).
 */
export async function createOrder(input: CreateOrderInput): Promise<OrderOperationResult> {
  const result = await apiClient.post<{ sale: Sale; items: SaleItem[] }>('/sales', input);

  const { chaiItems, parhataItems } = partitionDepartmentItems(input.cart);

  return {
    saleId: result.sale.id,
    sale: result.sale,
    items: result.items,
    chaiItems,
    parhataItems,
    isSupplementary: false,
  };
}

/**
 * Updates an existing pending order.
 * Identifies ONLY the additional/new items and prepares an add-on kitchen slip.
 */
export async function updatePendingOrder(
  orderId: string,
  updatedCart: CartLine[],
  takenBy?: string
): Promise<OrderOperationResult> {
  const existingRes = await apiClient.get<{ sale: Sale; items: SaleItem[] }>(`/sales/${orderId}`);
  const existingSale = existingRes.sale;

  const previousPrinted = existingSale.printedDepartmentItems ?? {};
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
  }

  const result = await apiClient.put<{ sale: Sale; items: SaleItem[] }>(`/sales/${orderId}`, {
    cart: updatedCart,
    takenBy,
  });

  const { chaiItems, parhataItems } = partitionDepartmentItems(deltaLines);

  return {
    saleId: orderId,
    sale: result.sale,
    items: result.items,
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
  return apiClient.post<Sale>(`/sales/${orderId}/settle`, {
    paymentMethod,
    amountReceived,
  });
}

/**
 * Voids/cancels an active or completed order.
 */
export async function voidOrder(orderId: string): Promise<void> {
  await apiClient.post(`/sales/${orderId}/void`, {});
}

/**
 * Fetches all sales with line items for OrdersPage and SalesHistoryPage.
 */
export async function getAllSalesWithItems(): Promise<{ sales: Sale[]; itemsMap: Record<string, SaleItem[]> }> {
  return apiClient.get<{ sales: Sale[]; itemsMap: Record<string, SaleItem[]> }>('/sales/all-with-items');
}

/**
 * Fetches pending orders count.
 */
export async function getPendingOrdersCount(): Promise<number> {
  const res = await apiClient.get<{ count: number }>('/sales/pending-count');
  return res.count;
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
