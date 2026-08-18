import { randomUUID } from 'node:crypto';
import { pool } from '../database/pool.js';
import type { Sale, SaleItem } from '../models/types.js';

interface SaleRow {
  id: string;
  display_id: string;
  order_number: number;
  order_type: Sale['orderType'];
  status: Sale['status'];
  taken_by: string;
  subtotal: string;
  discount: string;
  total: string;
  payment_method: Sale['paymentMethod'];
  amount_received: string | null;
  change_given: string | null;
  voided: boolean;
  printed_department_items: string | null;
  created_at: string;
  updated_at: string | null;
}

function toSale(row: SaleRow): Sale {
  return {
    id: row.id,
    displayId: row.display_id,
    orderNumber: row.order_number ?? 1,
    orderType: row.order_type ?? 'DINE_IN',
    status: row.status ?? 'PAID',
    takenBy: row.taken_by ?? 'Cashier',
    subtotal: Number(row.subtotal),
    discount: Number(row.discount),
    total: Number(row.total),
    paymentMethod: row.payment_method,
    amountReceived: row.amount_received == null ? null : Number(row.amount_received),
    changeGiven: row.change_given == null ? null : Number(row.change_given),
    voided: row.voided,
    printedDepartmentItems: row.printed_department_items ? JSON.parse(row.printed_department_items) : undefined,
    createdAt: Number(row.created_at),
    updatedAt: row.updated_at ? Number(row.updated_at) : undefined,
  };
}

export async function listSales(from?: number, to?: number): Promise<Sale[]> {
  if (from != null && to != null) {
    const result = await pool.query<SaleRow>(
      'SELECT * FROM sales WHERE created_at BETWEEN $1 AND $2 ORDER BY created_at DESC',
      [from, to]
    );
    return result.rows.map(toSale);
  }
  const result = await pool.query<SaleRow>('SELECT * FROM sales ORDER BY created_at DESC LIMIT 200');
  return result.rows.map(toSale);
}

/**
 * Upserts a sale + its line items and decrements product stock — used by
 * the sync endpoint when a device pushes a sale it made offline. Uses
 * the sale's own id as the idempotency key: re-sending an already-synced
 * sale (e.g. a retried request) is a safe no-op on the second write.
 */
export async function upsertSyncedSale(sale: Sale, items: SaleItem[]): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query('SELECT id FROM sales WHERE id = $1', [sale.id]);
    if (existing.rowCount) {
      // Update existing record if modified
      await client.query(
        `UPDATE sales SET
          subtotal = $1, discount = $2, total = $3, payment_method = $4,
          amount_received = $5, change_given = $6, status = $7, voided = $8,
          printed_department_items = $9, updated_at = $10, synced_at = $11
         WHERE id = $12`,
        [
          sale.subtotal,
          sale.discount,
          sale.total,
          sale.paymentMethod,
          sale.amountReceived,
          sale.changeGiven,
          sale.status,
          sale.voided,
          sale.printedDepartmentItems ? JSON.stringify(sale.printedDepartmentItems) : null,
          sale.updatedAt ?? Date.now(),
          Date.now(),
          sale.id,
        ]
      );
      await client.query('COMMIT');
      return;
    }

    await client.query(
      `INSERT INTO sales (id, display_id, order_number, order_type, status, taken_by, subtotal, discount, total, payment_method, amount_received, change_given, voided, printed_department_items, created_at, updated_at, synced_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
      [
        sale.id,
        sale.displayId,
        sale.orderNumber ?? 1,
        sale.orderType ?? 'DINE_IN',
        sale.status ?? 'PENDING',
        sale.takenBy ?? 'Cashier',
        sale.subtotal,
        sale.discount,
        sale.total,
        sale.paymentMethod,
        sale.amountReceived,
        sale.changeGiven,
        sale.voided,
        sale.printedDepartmentItems ? JSON.stringify(sale.printedDepartmentItems) : null,
        sale.createdAt,
        sale.updatedAt ?? sale.createdAt,
        Date.now(),
      ]
    );

    for (const item of items) {
      await client.query(
        `INSERT INTO sale_items (id, sale_id, product_id, product_name, department, quantity, unit_price, cost_price, total)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [item.id, item.saleId, item.productId, item.productName, item.department ?? null, item.quantity, item.unitPrice, item.costPrice, item.total]
      );

      if (item.productId && sale.status === 'PAID') {
        await client.query(
          `UPDATE products SET stock = GREATEST(stock - $1, 0), updated_at = $2 WHERE id = $3`,
          [item.quantity, Date.now(), item.productId]
        );
      }
    }

    if (sale.status === 'PAID') {
      await client.query(
        `INSERT INTO money_transactions (id, type, amount, reference_id, created_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          randomUUID(),
          sale.paymentMethod === 'CASH' ? 'CASH_SALE' : sale.paymentMethod === 'CARD' ? 'CARD_SALE' : 'CREDIT_SALE',
          sale.total,
          sale.id,
          sale.createdAt,
        ]
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
