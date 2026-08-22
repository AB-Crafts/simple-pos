import { useEffect, useState } from 'react';
import { getAllSalesWithItems } from '../services/salesService';
import { formatMoney } from '../utils/money';
import { formatCustomerBill, formatChaiSlip, formatParhataSlip, printReceiptText } from '../utils/slips';
import type { Sale, SaleItem } from '../types';

export function SalesHistoryPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [itemsMap, setItemsMap] = useState<Record<string, SaleItem[]>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSales() {
      setLoading(true);
      try {
        const data = await getAllSalesWithItems();
        setSales(data.sales);
        setItemsMap(data.itemsMap);
      } catch (err) {
        console.error('Failed to load sales history:', err);
      } finally {
        setLoading(false);
      }
    }
    loadSales();
  }, []);

  return (
    <div className="sales-page">
      <div className="sales-page__header">
        <h2>Sales & Order History</h2>
        <p className="page-subtitle">Complete chronological record of all dine-in, takeaway, and settled bills.</p>
      </div>

      <div className="sales-list">
        {loading ? (
          <p className="empty-hint">Loading sales history...</p>
        ) : (
          <>
            {sales.map((sale) => (
              <SaleRow
                key={sale.id}
                sale={sale}
                items={itemsMap[sale.id] || []}
                expanded={expandedId === sale.id}
                onToggle={() => setExpandedId(expandedId === sale.id ? null : sale.id)}
              />
            ))}
            {sales.length === 0 && (
              <p className="empty-hint">No sales yet — completed and pending sales will appear here.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SaleRow({
  sale,
  items,
  expanded,
  onToggle,
}: {
  sale: Sale;
  items: SaleItem[];
  expanded: boolean;
  onToggle: () => void;
}) {
  function handlePrintBill(e: React.MouseEvent) {
    e.stopPropagation();
    if (!items || items.length === 0) return;
    const billText = formatCustomerBill(sale, items);
    printReceiptText(`Bill-${sale.orderNumber}`, billText);
  }

  function handlePrintSlips(e: React.MouseEvent) {
    e.stopPropagation();
    if (!items || items.length === 0) return;
    const chai = items.filter((i) => i.department === 'CHAI').map((i) => ({
      productId: i.productId,
      productName: i.productName,
      quantity: i.quantity,
      department: i.department,
    }));
    const parhata = items.filter((i) => i.department === 'PARHATA').map((i) => ({
      productId: i.productId,
      productName: i.productName,
      quantity: i.quantity,
      department: i.department,
    }));

    const slips: string[] = [];
    if (chai.length > 0) slips.push(formatChaiSlip(sale, chai));
    if (parhata.length > 0) slips.push(formatParhataSlip(sale, parhata));

    if (slips.length > 0) {
      printReceiptText(`Slips-${sale.orderNumber}`, slips.join('\n\n--------------------------------\n        --- TEAR HERE ---\n--------------------------------\n\n'));
    } else {
      alert('No department items in this order.');
    }
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
            {items.map((item) => (
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
