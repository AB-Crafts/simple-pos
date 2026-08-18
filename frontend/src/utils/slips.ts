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
 * Formats a Departmental Kitchen Slip specifically for the Chai Department.
 */
export function formatChaiSlip(
  sale: Pick<Sale, 'displayId' | 'orderNumber' | 'orderType' | 'takenBy' | 'createdAt'>,
  items: DepartmentItem[],
  isSupplementary = false,
  width = 32
): string {
  const rows: string[] = [];

  rows.push(line('=', width));
  rows.push(center('BANY PYALA HOTEL', width));
  rows.push(center(isSupplementary ? '** CHAI ADD-ON SLIP **' : '☕ CHAI DEPARTMENT SLIP', width));
  rows.push(line('=', width));

  rows.push(pad(`ORDER #: ${sale.orderNumber}`, sale.orderType === 'DINE_IN' ? '[DINE IN]' : '[TAKE AWAY]', width));
  rows.push(`Server: ${sale.takenBy}`);
  rows.push(`Time:   ${new Date().toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })}`);
  rows.push(line('-', width));

  rows.push(pad(isSupplementary ? 'NEW ADDED CHAI' : 'CHAI ITEM', 'QTY', width));
  rows.push(line('-', width));

  let totalQty = 0;
  for (const item of items) {
    totalQty += item.quantity;
    rows.push(pad(item.productName.substring(0, width - 6), `x${item.quantity}`, width));
  }

  rows.push(line('-', width));
  rows.push(pad(isSupplementary ? 'TOTAL NEW CHAI:' : 'TOTAL CHAI:', `${totalQty}`, width));
  rows.push(line('=', width));
  rows.push(center(isSupplementary ? '* Deliver Chai ADD-ON *' : '* Deliver Chai to waiter *', width));
  rows.push(line('=', width));

  return rows.join('\n');
}

/**
 * Formats a Departmental Kitchen Slip specifically for the Parhata Department.
 */
export function formatParhataSlip(
  sale: Pick<Sale, 'displayId' | 'orderNumber' | 'orderType' | 'takenBy' | 'createdAt'>,
  items: DepartmentItem[],
  isSupplementary = false,
  width = 32
): string {
  const rows: string[] = [];

  rows.push(line('=', width));
  rows.push(center('BANY PYALA HOTEL', width));
  rows.push(center(isSupplementary ? '** PARHATA ADD-ON SLIP **' : '🫓 PARHATA DEPARTMENT SLIP', width));
  rows.push(line('=', width));

  rows.push(pad(`ORDER #: ${sale.orderNumber}`, sale.orderType === 'DINE_IN' ? '[DINE IN]' : '[TAKE AWAY]', width));
  rows.push(`Server: ${sale.takenBy}`);
  rows.push(`Time:   ${new Date().toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })}`);
  rows.push(line('-', width));

  rows.push(pad(isSupplementary ? 'NEW ADDED PARHATA' : 'PARHATA ITEM', 'QTY', width));
  rows.push(line('-', width));

  let totalQty = 0;
  for (const item of items) {
    totalQty += item.quantity;
    rows.push(pad(item.productName.substring(0, width - 6), `x${item.quantity}`, width));
  }

  rows.push(line('-', width));
  rows.push(pad(isSupplementary ? 'TOTAL NEW PARHATA:' : 'TOTAL PARHATA:', `${totalQty}`, width));
  rows.push(line('=', width));
  rows.push(center(isSupplementary ? '* Deliver Parhata ADD-ON *' : '* Deliver Parhata to waiter *', width));
  rows.push(line('=', width));

  return rows.join('\n');
}

/**
 * Formats a single departmental slip (Chai or Parhata).
 */
export function formatDepartmentSlip(
  sale: Pick<Sale, 'displayId' | 'orderNumber' | 'orderType' | 'takenBy' | 'createdAt'>,
  items: DepartmentItem[],
  department: 'CHAI' | 'PARHATA',
  isSupplementary = false,
  width = 32
): string {
  if (department === 'CHAI') {
    return formatChaiSlip(sale, items, isSupplementary, width);
  }
  return formatParhataSlip(sale, items, isSupplementary, width);
}

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
 * Triggers printing of a single formatted text receipt via a styled popup window.
 */
export function printReceiptText(title: string, text: string): void {
  printMultipleSlips(title, [text]);
}

/**
 * Triggers printing of multiple separate slips (e.g. Chai slip AND Parhata slip) at once.
 * Each slip is encapsulated in its own page container with proper CSS page-breaks
 * so thermal and standard printers cut/page-break between each slip automatically.
 */
export function printMultipleSlips(title: string, slips: string[]): void {
  const validSlips = slips.filter((s) => s.trim().length > 0);
  if (validSlips.length === 0) return;

  const win = window.open('', '_blank', 'width=380,height=600');
  if (!win) {
    alert('Please allow popups to print receipts/tokens.');
    return;
  }

  const slipsHtml = validSlips
    .map(
      (slip, index) => `
    <div class="receipt-page ${index < validSlips.length - 1 ? 'has-cut' : ''}">
      <pre>${escapeHtml(slip)}</pre>
      ${index < validSlips.length - 1 ? '<div class="cut-indicator">✂ - - - - - - - - - - - - - - - - - ✂</div>' : ''}
    </div>`
    )
    .join('\n');

  win.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>${title}</title>
  <style>
    @page {
      margin: 0;
      size: auto;
    }
    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #000;
    }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 13px;
      line-height: 1.35;
    }
    .receipt-page {
      padding: 12px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .has-cut {
      page-break-after: always;
      break-after: page;
    }
    pre {
      margin: 0;
      white-space: pre-wrap;
      word-break: break-all;
    }
    .cut-indicator {
      text-align: center;
      font-size: 11px;
      color: #777;
      margin: 16px 0 0 0;
      padding-top: 10px;
      border-top: 1px dashed #ccc;
    }
    @media print {
      body {
        padding: 0;
      }
      .receipt-page {
        padding: 6px;
        page-break-inside: avoid;
        break-inside: avoid;
      }
      .has-cut {
        page-break-after: always !important;
        break-after: page !important;
      }
      .cut-indicator {
        display: none;
      }
    }
  </style>
</head>
<body>
  ${slipsHtml}
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

