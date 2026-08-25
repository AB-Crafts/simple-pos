import { useEffect, useMemo, useState } from 'react';
import { getAllSalesWithItems } from '../services/salesService';
import { formatMoney } from '../utils/money';
import { formatCustomerBill, formatChaiSlip, formatParhataSlip, printReceiptText } from '../utils/slips';
import { RecordPaymentModal } from '../components/RecordPaymentModal';
import type { Sale, SaleItem } from '../types';

export function SalesHistoryPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [itemsMap, setItemsMap] = useState<Record<string, SaleItem[]>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState<'ALL' | 'CREDIT' | 'CASH' | 'CARD'>('ALL');
  const [recordPaymentTarget, setRecordPaymentTarget] = useState<{ sale: Sale; items: SaleItem[] } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    loadSales();
  }, []);

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

  const filteredSales = useMemo(() => {
    return sales.filter((s) => {
      if (methodFilter !== 'ALL' && s.paymentMethod !== methodFilter && s.status !== methodFilter) {
        return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchOrderNum = `#${s.orderNumber}`.includes(q) || s.orderNumber.toString().includes(q);
        const matchDisplay = s.displayId.toLowerCase().includes(q);
        const matchWaiter = s.takenBy.toLowerCase().includes(q);
        const matchCustomer =
          (s.customerName && s.customerName.toLowerCase().includes(q)) ||
          (s.customerContact && s.customerContact.toLowerCase().includes(q));
        const items = itemsMap[s.id] || [];
        const matchItem = items.some((i) => i.productName.toLowerCase().includes(q));
        return matchOrderNum || matchDisplay || matchWaiter || Boolean(matchCustomer) || matchItem;
      }
      return true;
    });
  }, [sales, itemsMap, methodFilter, search]);

  const creditSalesCount = sales.filter((s) => s.paymentMethod === 'CREDIT' || s.status === 'CREDIT').length;

  return (
    <div className="sales-page">
      <div className="sales-page__header">
        <div>
          <h2>Sales & Order History</h2>
          <p className="page-subtitle">Complete chronological record of all dine-in, takeaway, and settled bills.</p>
        </div>
      </div>

      <div className="orders-filter-bar">
        <div className="filter-tabs">
          <button
            className={`filter-tab ${methodFilter === 'ALL' ? 'filter-tab--active' : ''}`}
            onClick={() => setMethodFilter('ALL')}
          >
            All Sales ({sales.length})
          </button>
          <button
            className={`filter-tab ${methodFilter === 'CREDIT' ? 'filter-tab--active' : ''}`}
            onClick={() => setMethodFilter('CREDIT')}
          >
            📝 Khata / Credit ({creditSalesCount})
          </button>
          <button
            className={`filter-tab ${methodFilter === 'CASH' ? 'filter-tab--active' : ''}`}
            onClick={() => setMethodFilter('CASH')}
          >
            💵 Cash
          </button>
          <button
            className={`filter-tab ${methodFilter === 'CARD' ? 'filter-tab--active' : ''}`}
            onClick={() => setMethodFilter('CARD')}
          >
            💳 Card
          </button>
        </div>

        <div className="orders-search">
          <input
            type="search"
            placeholder="Search by customer name, phone, order #, or waiter..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="form-input search-input"
          />
        </div>
      </div>

      <div className="sales-list">
        {loading ? (
          <p className="empty-hint">Loading sales history...</p>
        ) : (
          <>
            {filteredSales.map((sale) => (
              <SaleRow
                key={sale.id}
                sale={sale}
                items={itemsMap[sale.id] || []}
                expanded={expandedId === sale.id}
                onToggle={() => setExpandedId(expandedId === sale.id ? null : sale.id)}
                onRecordPayment={(saleToPay, itemsToPay) => setRecordPaymentTarget({ sale: saleToPay, items: itemsToPay })}
              />
            ))}
            {filteredSales.length === 0 && (
              <p className="empty-hint">No sales found matching this filter.</p>
            )}
          </>
        )}
      </div>

      {recordPaymentTarget && (
        <RecordPaymentModal
          sale={recordPaymentTarget.sale}
          items={recordPaymentTarget.items}
          onClose={() => setRecordPaymentTarget(null)}
          onSuccess={(updatedSale) => {
            setToast(`Payment recorded for Order #${updatedSale.orderNumber} — Marked as PAID!`);
            loadSales();
          }}
        />
      )}

      {toast && (
        <div className="toast-notification">
          <span>{toast}</span>
          <button onClick={() => setToast(null)}>&times;</button>
        </div>
      )}
    </div>
  );
}

function SaleRow({
  sale,
  items,
  expanded,
  onToggle,
  onRecordPayment,
}: {
  sale: Sale;
  items: SaleItem[];
  expanded: boolean;
  onToggle: () => void;
  onRecordPayment: (sale: Sale, items: SaleItem[]) => void;
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

  const isCredit = sale.status === 'CREDIT' || sale.paymentMethod === 'CREDIT';
  const isUnpaidKhata = sale.status === 'CREDIT';
  const isPaid = sale.status === 'PAID';

  return (
    <div className={`sale-row ${sale.status === 'PENDING' ? 'sale-row--pending' : ''} ${isCredit ? 'sale-row--credit' : ''}`} onClick={onToggle}>
      <div className="sale-row__summary">
        <div>
          <span className="sale-row__id">
            <strong>Order #{sale.orderNumber}</strong>
            {sale.customerName ? (
              <span className="sale-row__customer-highlight">
                {' '}· 👤 <strong>{sale.customerName}</strong>
              </span>
            ) : (
              <span className="order-time-sub"> ({sale.displayId})</span>
            )}
          </span>
          <div className="sale-row__details">
            <span className={`type-badge-sm ${sale.orderType === 'DINE_IN' ? 'type-badge--dinein' : 'type-badge--takeaway'}`}>
              {sale.orderType === 'DINE_IN' ? '☕ Dine In' : '🛍️ Takeaway'}
            </span>
            {!isCredit && <span className="sale-row__waiter">Server: {sale.takenBy}</span>}
            {sale.customerName && (
              <span className="sale-row__customer-pill">
                📝 Khata: <strong>{sale.customerName}</strong>
                {sale.customerContact && <span className="customer-phone"> ({sale.customerContact})</span>}
              </span>
            )}
            <span className="sale-row__date">{new Date(sale.createdAt).toLocaleString('en-PK')}</span>
          </div>
        </div>

        <div className="sale-row__meta">
          {isUnpaidKhata ? (
            <span className="status-badge-sm status-badge--credit">📝 UNPAID KHATA</span>
          ) : (
            <>
              <span className={`status-badge-sm status-badge--${sale.status.toLowerCase()}`}>
                {sale.status}
              </span>
              <span className={`badge badge--${sale.paymentMethod.toLowerCase()}`}>
                {sale.paymentMethod}
              </span>
            </>
          )}
          <span className="sale-row__total">{formatMoney(sale.total)}</span>
        </div>
      </div>

      {expanded && (
        <div className="sale-row__items">
          {sale.customerName && (
            <div className="sale-row__customer-banner">
              <div>
                <strong>📝 Khata Account:</strong> {sale.customerName}
              </div>
              {sale.customerContact && (
                <div>
                  <strong>Phone / WhatsApp:</strong> {sale.customerContact}
                </div>
              )}
            </div>
          )}

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
            {isUnpaidKhata && (
              <button
                className="btn btn-sm btn-primary"
                onClick={(e) => {
                  e.stopPropagation();
                  onRecordPayment(sale, items);
                }}
              >
                💵 Record Payment
              </button>
            )}
            <button className="btn btn-sm btn-outline" onClick={handlePrintSlips}>
              📋 Print Kitchen Token
            </button>
            {isPaid && (
              <button className="btn btn-sm btn-ghost" onClick={handlePrintBill}>
                🧾 Print Bill
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
