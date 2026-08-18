import { formatMoney } from './money';
import type { Sale, SaleItem, Department } from '../types';

function center(text: string, width = 32): string {
  if (text.length >= width) return text;
  const left = Math.floor((width - text.length) / 2);
  return ' '.repeat(left) + text;
}

function line(char = '-', width = 32): string {
  return char.repeat(width);
}

function pad(left: string, right: string, width = 32): string {
  const gap = Math.max(1, width - left.length - right.length);
  return left + ' '.repeat(gap) + right;
}

export interface DepartmentItem {
  productId: string;
  productName: string;
  quantity: number;
  department?: Department;
}

/**
 * Formats a single unified Kitchen Order Slip (KOT).
 * Groups items cleanly (Chai, Parhata, and other kitchen items) in one single slip.
 * Used when placing or adjusting an order.
 */
export function formatKitchenSlip(
  sale: Pick<Sale, 'displayId' | 'orderNumber' | 'orderType' | 'takenBy' | 'createdAt'>,
  items: DepartmentItem[],
  isSupplementary = false,
  width = 32
): string {
  const rows: string[] = [];

  rows.push(line('=', width));
  rows.push(center('BANY PYALA HOTEL', width));
  if (isSupplementary) {
    rows.push(center('** ADD-ON KITCHEN SLIP **', width));
  } else {
    rows.push(center('KITCHEN ORDER SLIP', width));
  }
  rows.push(line('=', width));

  rows.push(pad(`ORDER #: ${sale.orderNumber}`, sale.orderType === 'DINE_IN' ? '[DINE IN]' : '[TAKE AWAY]', width));
  rows.push(`Server: ${sale.takenBy}`);
  rows.push(`Time:   ${new Date().toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })}`);
  rows.push(line('-', width));

  rows.push(pad(isSupplementary ? 'NEW ADDED ITEM' : 'ITEM', 'QTY', width));
  rows.push(line('-', width));

  const chaiItems = items.filter((i) => i.department === 'CHAI');
  const parhataItems = items.filter((i) => i.department === 'PARHATA');
  const otherItems = items.filter((i) => i.department !== 'CHAI' && i.department !== 'PARHATA');

  let totalItemsCount = 0;

  if (chaiItems.length > 0) {
    rows.push('-- CHAI SECTION --');
    for (const item of chaiItems) {
      totalItemsCount += item.quantity;
      rows.push(pad(`  ${item.productName.substring(0, width - 8)}`, `x${item.quantity}`, width));
    }
  }

  if (parhataItems.length > 0) {
    if (chaiItems.length > 0) rows.push('');
    rows.push('-- PARHATA SECTION --');
    for (const item of parhataItems) {
      totalItemsCount += item.quantity;
      rows.push(pad(`  ${item.productName.substring(0, width - 8)}`, `x${item.quantity}`, width));
    }
  }

  if (otherItems.length > 0) {
    if (chaiItems.length > 0 || parhataItems.length > 0) rows.push('');
    rows.push('-- OTHER ITEMS --');
    for (const item of otherItems) {
      totalItemsCount += item.quantity;
      rows.push(pad(`  ${item.productName.substring(0, width - 8)}`, `x${item.quantity}`, width));
    }
  }

  rows.push(line('-', width));
  rows.push(pad(isSupplementary ? 'TOTAL NEW ITEMS:' : 'TOTAL QUANTITY:', `${totalItemsCount}`, width));
  rows.push(line('=', width));
  rows.push(center(isSupplementary ? '* Deliver ADD-ON to waiter *' : '* Deliver order to waiter *', width));
  rows.push(line('=', width));

  return rows.join('\n');
}

/** Legacy alias for backwards compatibility */
export const formatDepartmentSlip = (
  sale: Pick<Sale, 'displayId' | 'orderNumber' | 'orderType' | 'takenBy' | 'createdAt'>,
  items: DepartmentItem[],
  _dept?: any,
  isSupplementary = false
) => formatKitchenSlip(sale, items, isSupplementary);

/**
 * Formats the full customer total bill / receipt.
 * Printed strictly on demand for PAID orders only.
 */
export function formatCustomerBill(
  sale: Sale,
  items: SaleItem[],
  hotelName = 'BANY PYALA HOTEL',
  width = 32
): string {
  const rows: string[] = [];

  rows.push(line('=', width));
  rows.push(center(hotelName, width));
  rows.push(center('CUSTOMER BILL (PAID)', width));
  rows.push(line('=', width));

  rows.push(pad(`Order #: ${sale.orderNumber}`, sale.orderType === 'DINE_IN' ? 'DINE IN' : 'TAKE AWAY', width));
  rows.push(`Bill ID: ${sale.displayId}`);
  rows.push(`Server:  ${sale.takenBy}`);
  rows.push(`Date:    ${new Date(sale.createdAt).toLocaleString('en-PK', { dateStyle: 'short', timeStyle: 'short' })}`);
  rows.push(`Status:  PAID`);
  rows.push(line('-', width));

  rows.push(pad('ITEM', 'TOTAL', width));
  rows.push(line('-', width));

  for (const item of items) {
    rows.push(item.productName);
    rows.push(pad(`  ${item.quantity} x ${formatMoney(item.unitPrice)}`, formatMoney(item.total), width));
  }

  rows.push(line('-', width));
  rows.push(pad('SUBTOTAL', formatMoney(sale.subtotal), width));
  if (sale.discount > 0) {
    rows.push(pad('DISCOUNT', formatMoney(sale.discount), width));
  }
  rows.push(pad('NET TOTAL', formatMoney(sale.total), width));
  rows.push(line('-', width));

  rows.push(pad('PAYMENT', sale.paymentMethod));
  if (sale.amountReceived != null) {
    rows.push(pad('CASH TENDERED', formatMoney(sale.amountReceived), width));
  }
  if (sale.changeGiven != null && sale.changeGiven > 0) {
    rows.push(pad('CHANGE DUE', formatMoney(sale.changeGiven), width));
  }

  rows.push(line('=', width));
  rows.push(center('Thank you for your visit!', width));
  rows.push(center('Please visit us again', width));
  rows.push(line('=', width));

  return rows.join('\n');
}

/**
 * Triggers printing of text formatted receipts via a styled popup window.
 */
export function printReceiptText(title: string, text: string): void {
  const win = window.open('', '_blank', 'width=380,height=600');
  if (!win) {
    alert('Please allow popups to print receipts/tokens.');
    return;
  }

  win.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>${title}</title>
  <style>
    @page { margin: 0; size: auto; }
    body {
      margin: 0;
      padding: 12px;
      font-family: 'Courier New', Courier, monospace;
      font-size: 13px;
      line-height: 1.35;
      color: #000;
      background: #fff;
    }
    pre {
      margin: 0;
      white-space: pre-wrap;
      word-break: break-all;
    }
    @media print {
      body { padding: 4px; }
    }
  </style>
</head>
<body>
  <pre>${escapeHtml(text)}</pre>
  <script>
    window.onload = function() {
      window.focus();
      window.print();
      setTimeout(function() { window.close(); }, 500);
    };
  </script>
</body>
</html>`);
  win.document.close();
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
