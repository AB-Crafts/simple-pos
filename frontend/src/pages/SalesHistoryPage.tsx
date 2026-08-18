import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../database/db';
import { formatMoney } from '../utils/money';
import { formatCustomerBill, formatKitchenSlip, printReceiptText } from '../utils/slips';
import type { Sale, SaleItem } from '../types';

export function SalesHistoryPage() {
  const sales = useLiveQuery(
    () => db.sales.orderBy('createdAt').reverse().toArray(),
    []
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="sales-page">
      <div className="sales-page__header">
        <h2>Sales & Order History</h2>
        <p className="page-subtitle">Complete chronological record of all dine-in, takeaway, and settled bills.</p>
      </div>

      <div className="sales-list">
        {(sales ?? []).map((sale) => (
          <SaleRow
            key={sale.id}
            sale={sale}
            expanded={expandedId === sale.id}
            onToggle={() => setExpandedId(expandedId === sale.id ? null : sale.id)}
          />
        ))}
        {sales?.length === 0 && (
          <p className="empty-hint">No sales yet — completed and pending sales will appear here.</p>
        )}
      </div>
    </div>
  );
}

function SaleRow({
  sale,
  expanded,
  onToggle,
}: {
  sale: Sale;
  expanded: boolean;
  onToggle: () => void;
}) {
  const items = useLiveQuery(
    () =>
      expanded
        ? db.saleItems.where('saleId').equals(sale.id).toArray()
        : Promise.resolve<SaleItem[]>([]),
    [expanded, sale.id]
  );

  function handlePrintBill(e: React.MouseEvent) {
    e.stopPropagation();
    if (!items || items.length === 0) return;
    const billText = formatCustomerBill(sale, items);
    printReceiptText(`Bill-${sale.orderNumber}`, billText);
  }

  function handlePrintSlips(e: React.MouseEvent) {
    e.stopPropagation();
    if (!items || items.length === 0) return;
    const slipItems = items.map((i) => ({
      productId: i.productId,
      productName: i.productName,
      quantity: i.quantity,
      department: i.department,
    }));

    const text = formatKitchenSlip(sale, slipItems);
    printReceiptText(`Kitchen-Token-${sale.orderNumber}`, text);
  }

  const isPaid = sale.status === 'PAID';

  return (
    <div className={`sale-row ${sale.status === 'PENDING' ? 'sale-row--pending' : ''}`} onClick={onToggle}>
      <div className="sale-row__summary">
        <div>
          <span className="sale-row__id">
            <strong>Order #{sale.orderNumber}</strong> ({sale.displayId})
          </span>
          <div className="sale-row__details">
            <span className={`type-badge-sm ${sale.orderType === 'DINE_IN' ? 'type-badge--dinein' : 'type-badge--takeaway'}`}>
              {sale.orderType === 'DINE_IN' ? '☕ Dine In' : '🛍️ Takeaway'}
            </span>
            <span className="sale-row__waiter">Server: {sale.takenBy}</span>
            <span className="sale-row__date">{new Date(sale.createdAt).toLocaleString('en-PK')}</span>
          </div>
        </div>

        <div className="sale-row__meta">
          <span className={`status-badge-sm status-badge--${sale.status.toLowerCase()}`}>
            {sale.status}
          </span>
          <span className={`badge badge--${sale.paymentMethod.toLowerCase()}`}>{sale.paymentMethod}</span>
          <span className="sale-row__total">{formatMoney(sale.total)}</span>
        </div>
      </div>

      {expanded && (
        <div className="sale-row__items">
          <div className="sale-row__items-list">
            {(items ?? []).map((item) => (
              <div key={item.id} className="sale-row__item">
                <span>
                  {item.productName} {item.department && `(${item.department})`} × {item.quantity}
                </span>
                <span>{formatMoney(item.total)}</span>
              </div>
            ))}
          </div>

          <div className="sale-row__actions">
            <button className="btn btn-sm btn-outline" onClick={handlePrintSlips}>
              📋 Print Kitchen Slip
            </button>
            {isPaid && (
              <button className="btn btn-sm btn-primary" onClick={handlePrintBill}>
                🧾 Print Customer Bill (On Demand)
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
