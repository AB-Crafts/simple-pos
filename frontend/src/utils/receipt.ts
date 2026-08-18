import { formatMoney } from './money';
import type { Sale, SaleItem } from '../types';

/**
 * Formats a sale as a plain-text receipt sized for a standard 32/42-column
 * thermal printer. Deliberately just returns a string — hooking this up
 * to a real printer later (via WebUSB, a print server, or window.print())
 * is a presentation-layer decision that shouldn't change this function.
 */
export function formatReceiptText(sale: Sale, items: SaleItem[], width = 32): string {
  const line = (char = '-') => char.repeat(width);
  const pad = (left: string, right: string) => {
    const gap = Math.max(1, width - left.length - right.length);
    return left + ' '.repeat(gap) + right;
  };

  const rows: string[] = [];
  rows.push(center('BANY PYALA HOTEL', width));
  rows.push(center(sale.displayId, width));
  rows.push(center(new Date(sale.createdAt).toLocaleString(), width));
  rows.push(line());

  for (const item of items) {
    rows.push(item.productName);
    rows.push(pad(`  ${item.quantity} x ${formatMoney(item.unitPrice)}`, formatMoney(item.total)));
  }

  rows.push(line());
  rows.push(pad('TOTAL', formatMoney(sale.total)));
  rows.push(pad('PAYMENT', sale.paymentMethod));
  if (sale.amountReceived != null) rows.push(pad('RECEIVED', formatMoney(sale.amountReceived)));
  if (sale.changeGiven != null) rows.push(pad('CHANGE', formatMoney(sale.changeGiven)));
  rows.push(line());
  rows.push(center('Thank you!', width));

  return rows.join('\n');
}

function center(text: string, width: number): string {
  if (text.length >= width) return text;
  const left = Math.floor((width - text.length) / 2);
  return ' '.repeat(left) + text;
}
