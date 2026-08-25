import { useEffect, useState } from 'react';
import type { Sale, SaleItem } from '../types';
import { formatMoney } from '../utils/money';
import { formatCustomerBill, printReceiptText } from '../utils/slips';
import { voidOrder, getAllSalesWithItems } from '../services/salesService';
import { SettleModal } from '../components/SettleModal';
import { RecordPaymentModal } from '../components/RecordPaymentModal';

interface Props {
  onEditOrder: (order: Sale, items: SaleItem[]) => void;
  onNavigateToPOS: () => void;
}

export function OrdersPage({ onEditOrder, onNavigateToPOS }: Props) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [itemsMap, setItemsMap] = useState<Record<string, SaleItem[]>>({});
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'CREDIT' | 'PAID' | 'VOIDED'>('PENDING');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const [settleOrderTarget, setSettleOrderTarget] = useState<{ sale: Sale; items: SaleItem[] } | null>(null);
  const [recordPaymentTarget, setRecordPaymentTarget] = useState<{ sale: Sale; items: SaleItem[] } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    loadOrders();
  }, []);

  async function loadOrders() {
    setLoading(true);
    try {
      const data = await getAllSalesWithItems();
      setSales(data.sales);
      setItemsMap(data.itemsMap);
    } catch (err) {
      console.error('Failed to load orders:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleVoid(orderId: string) {
    if (!confirm('Are you sure you want to void/cancel this order?')) return;
    try {
      await voidOrder(orderId);
      setToast('Order voided');
      loadOrders();
    } catch (err: any) {
      alert(err.message || 'Failed to void order');
    }
  }

  function handlePrintCustomerBill(sale: Sale) {
    const items = itemsMap[sale.id] || [];
    const billText = formatCustomerBill(sale, items);
    printReceiptText(`Customer-Bill-${sale.orderNumber}`, billText);
    setToast(`Printed customer bill for Order #${sale.orderNumber}`);
  }

  const filteredSales = sales.filter((s) => {
    if (filter === 'PENDING' && s.status !== 'PENDING') return false;
    if (filter === 'CREDIT' && s.status !== 'CREDIT') return false;
    if (filter === 'PAID' && s.status !== 'PAID') return false;
    if (filter === 'VOIDED' && !s.voided && s.status !== 'VOIDED') return false;

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

  const pendingCount = sales.filter((s) => s.status === 'PENDING').length;
  const pendingAmount = sales
    .filter((s) => s.status === 'PENDING')
    .reduce((acc, s) => acc + s.total, 0);

  const creditCount = sales.filter((s) => s.status === 'CREDIT').length;
  const creditAmount = sales
    .filter((s) => s.status === 'CREDIT')
    .reduce((acc, s) => acc + s.total, 0);

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const paidTodayAmount = sales
    .filter((s) => s.status === 'PAID' && s.createdAt >= startOfDay.getTime())
    .reduce((acc, s) => acc + s.total, 0);

  return (
    <div className="orders-page">
      <div className="orders-page__header">
        <div>
          <h2 className="page-title">Active Orders & Bills</h2>
          <p className="page-subtitle">
            Manage Dine-In, Takeaway, track waiter tokens, manage Khata credit records, and collect payments.
          </p>
        </div>

        <div className="orders-page__header-actions">
          <button className="btn btn-primary" onClick={onNavigateToPOS}>
            + New POS Order
          </button>
        </div>
      </div>

      <div className="orders-metrics-grid">
        <div className="metric-card metric-card--warning">
          <div className="metric-card__title">Pending Orders</div>
          <div className="metric-card__value">{pendingCount}</div>
          <div className="metric-card__hint">Kitchen/Table: {formatMoney(pendingAmount)}</div>
        </div>

        <div className="metric-card" style={{ borderLeft: '4px solid #ea580c' }}>
          <div className="metric-card__title" style={{ color: '#c2410c' }}>📝 Khata / Credit Unpaid</div>
          <div className="metric-card__value" style={{ color: '#9a3412' }}>{creditCount}</div>
          <div className="metric-card__hint">To collect: {formatMoney(creditAmount)}</div>
        </div>

        <div className="metric-card metric-card--success">
          <div className="metric-card__title">Today's Paid Sales</div>
          <div className="metric-card__value">{formatMoney(paidTodayAmount)}</div>
          <div className="metric-card__hint">Cleared cash & card</div>
        </div>

        <div className="metric-card">
          <div className="metric-card__title">Total Orders Today</div>
          <div className="metric-card__value">
            {sales.filter((s) => s.createdAt >= startOfDay.getTime()).length}
          </div>
          <div className="metric-card__hint">Dine-In & Takeaways</div>
        </div>
      </div>

      <div className="orders-filter-bar">
        <div className="filter-tabs">
          <button
            className={`filter-tab ${filter === 'PENDING' ? 'filter-tab--active' : ''}`}
            onClick={() => setFilter('PENDING')}
          >
            🟡 Pending ({pendingCount})
          </button>
          <button
            className={`filter-tab ${filter === 'CREDIT' ? 'filter-tab--active' : ''}`}
            onClick={() => setFilter('CREDIT')}
          >
            📝 Khata / Credit ({creditCount})
          </button>
          <button
            className={`filter-tab ${filter === 'PAID' ? 'filter-tab--active' : ''}`}
            onClick={() => setFilter('PAID')}
          >
            🟢 Paid
          </button>
          <button
            className={`filter-tab ${filter === 'ALL' ? 'filter-tab--active' : ''}`}
            onClick={() => setFilter('ALL')}
          >
            All ({sales.length})
          </button>
          <button
            className={`filter-tab ${filter === 'VOIDED' ? 'filter-tab--active' : ''}`}
            onClick={() => setFilter('VOIDED')}
          >
            Voided
          </button>
        </div>

        <div className="orders-search">
          <input
            type="search"
            placeholder="Search by customer name, phone, order #, waiter, or item..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="form-input search-input"
          />
        </div>
      </div>

      {loading ? (
        <div className="loading-state">Loading orders...</div>
      ) : filteredSales.length === 0 ? (
        <div className="empty-state">
          <p>No orders found matching this filter.</p>
        </div>
      ) : (
        <>
          <div className="table-responsive desktop-only">
            <table className="data-table orders-table">
              <thead>
                <tr>
                  <th style={{ width: '90px' }}>Order #</th>
                  <th style={{ width: '130px' }}>Status</th>
                  <th style={{ width: '110px' }}>Type</th>
                  <th style={{ width: '140px' }}>{filter === 'CREDIT' ? 'Customer' : 'Taken By / Customer'}</th>
                  <th>Order Items</th>
                  <th style={{ width: '120px', textAlign: 'right' }}>Total</th>
                  <th style={{ width: '250px', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSales.map((sale) => {
                  const items = itemsMap[sale.id] || [];
                  const isPending = sale.status === 'PENDING';
                  const isCredit = sale.status === 'CREDIT';
                  const isPaid = sale.status === 'PAID';
                  const isVoided = sale.status === 'VOIDED' || sale.voided;

                  return (
                    <tr
                      key={sale.id}
                      className={`${isPending ? 'order-row--pending' : ''} ${isCredit ? 'order-row--credit' : ''}`}
                    >
                      <td className="order-number-cell">
                        <strong>#{sale.orderNumber}</strong>
                        <div className="order-time-sub">
                          {new Date(sale.createdAt).toLocaleTimeString('en-PK', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </td>

                      <td>
                        {isPending ? (
                          <span className="status-badge status-badge--pending">PENDING</span>
                        ) : isCredit ? (
                          <span className="status-badge status-badge--credit">📝 UNPAID KHATA</span>
                        ) : isPaid ? (
                          <span className="status-badge status-badge--paid">PAID</span>
                        ) : (
                          <span className="status-badge status-badge--voided">VOIDED</span>
                        )}
                      </td>

                      <td>
                        <span className={`type-badge ${sale.orderType === 'DINE_IN' ? 'type-badge--dinein' : 'type-badge--takeaway'}`}>
                          {sale.orderType === 'DINE_IN' ? '☕ Dine In' : '🛍️ Takeaway'}
                        </span>
                      </td>

                      <td className="order-taken-by-cell">
                        {isCredit ? (
                          <div className="order-customer-sub" style={{ marginTop: 0, fontSize: '13px', color: 'var(--ink)' }} title={sale.customerContact ? `Contact: ${sale.customerContact}` : undefined}>
                            👤 <strong>{sale.customerName || 'Khata Customer'}</strong>
                            {sale.customerContact && <span className="order-contact-sub" style={{ fontSize: '12px' }}> ({sale.customerContact})</span>}
                          </div>
                        ) : (
                          <>
                            <span className="waiter-name-pill">{sale.takenBy}</span>
                            {sale.customerName && (
                              <div className="order-customer-sub" title={sale.customerContact ? `Contact: ${sale.customerContact}` : undefined}>
                                👤 <strong>{sale.customerName}</strong>
                                {sale.customerContact && <span className="order-contact-sub"> ({sale.customerContact})</span>}
                              </div>
                            )}
                          </>
                        )}
                      </td>

                      <td className="order-items-cell">
                        <div className="order-items-summary">
                          {items.length === 0 ? (
                            <span className="text-muted">No items</span>
                          ) : (
                            items.map((item, idx) => (
                              <span key={item.id || idx} className="order-item-tag">
                                {item.productName} <b>x{item.quantity}</b>
                              </span>
                            ))
                          )}
                        </div>
                      </td>

                      <td className="order-total-cell" style={{ textAlign: 'right' }}>
                        <strong>{formatMoney(sale.total)}</strong>
                      </td>

                      <td className="order-actions-cell" style={{ textAlign: 'center' }}>
                        <div className="action-buttons-group">
                          {isPending && (
                            <>
                              <button
                                className="btn btn-sm btn-success"
                                onClick={() => setSettleOrderTarget({ sale, items })}
                                title="Clear and settle this bill"
                              >
                                💵 PAID
                              </button>
                              <button
                                className="btn btn-sm btn-secondary"
                                onClick={() => onEditOrder(sale, items)}
                                title="Add more items or adjust in POS"
                              >
                                ✏️ EDIT
                              </button>
                              {!isVoided && (
                                <button
                                  className="btn btn-sm btn-danger-outline"
                                  onClick={() => handleVoid(sale.id)}
                                  title="Cancel / Void order"
                                >
                                  ✕
                                </button>
                              )}
                            </>
                          )}

                          {isCredit && (
                            <>
                              <button
                                className="btn btn-sm btn-primary"
                                onClick={() => setRecordPaymentTarget({ sale, items })}
                                title="Record payment received for this Khata order"
                              >
                                💵 Receive Payment
                              </button>
                              <button
                                className="btn btn-sm btn-ghost"
                                onClick={() => handlePrintCustomerBill(sale)}
                                title="Print customer bill slip"
                              >
                                🧾 Print Bill
                              </button>
                              {!isVoided && (
                                <button
                                  className="btn btn-sm btn-danger-outline"
                                  onClick={() => handleVoid(sale.id)}
                                  title="Cancel / Void order"
                                >
                                  ✕
                                </button>
                              )}
                            </>
                          )}

                          {isPaid && (
                            <button
                              className="btn btn-sm btn-ghost"
                              onClick={() => handlePrintCustomerBill(sale)}
                              title="Print customer total bill slip"
                            >
                              🧾 Print Bill
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="orders-mobile-list mobile-only">
            {filteredSales.map((sale) => {
              const items = itemsMap[sale.id] || [];
              const isPending = sale.status === 'PENDING';
              const isCredit = sale.status === 'CREDIT';
              const isPaid = sale.status === 'PAID';
              const isVoided = sale.status === 'VOIDED' || sale.voided;

              return (
                <div
                  key={sale.id}
                  className={`order-card-mobile ${isPending ? 'order-card-mobile--pending' : ''} ${isCredit ? 'order-card-mobile--credit' : ''}`}
                >
                  <div className="order-card-mobile__top">
                    <div className="order-card-mobile__id">
                      <strong>Order #{sale.orderNumber}</strong>
                      <span className="order-card-mobile__time">
                        {new Date(sale.createdAt).toLocaleTimeString('en-PK', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <div className="order-card-mobile__badges">
                      <span className={`type-badge ${sale.orderType === 'DINE_IN' ? 'type-badge--dinein' : 'type-badge--takeaway'}`}>
                        {sale.orderType === 'DINE_IN' ? '☕ Dine In' : '🛍️ Takeaway'}
                      </span>
                      {isPending ? (
                        <span className="status-badge status-badge--pending">PENDING</span>
                      ) : isCredit ? (
                        <span className="status-badge status-badge--credit">📝 UNPAID KHATA</span>
                      ) : isPaid ? (
                        <span className="status-badge status-badge--paid">PAID</span>
                      ) : (
                        <span className="status-badge status-badge--voided">VOIDED</span>
                      )}
                    </div>
                  </div>

                  <div className="order-card-mobile__waiter">
                    {isCredit ? (
                      <span className="order-customer-pill" title={sale.customerContact ? `Contact: ${sale.customerContact}` : undefined}>
                        👤 <strong>{sale.customerName || 'Khata Customer'}</strong> {sale.customerContact && `(${sale.customerContact})`}
                      </span>
                    ) : (
                      <>
                        <span className="waiter-label">Server:</span>
                        <span className="waiter-name-pill">{sale.takenBy}</span>
                        {sale.customerName && (
                          <span className="order-customer-pill" title={sale.customerContact ? `Contact: ${sale.customerContact}` : undefined}>
                            👤 {sale.customerName} {sale.customerContact && `(${sale.customerContact})`}
                          </span>
                        )}
                      </>
                    )}
                  </div>

                  <div className="order-card-mobile__items">
                    {items.map((item, idx) => (
                      <span key={item.id || idx} className="order-item-tag">
                        {item.productName} <b>x{item.quantity}</b>
                      </span>
                    ))}
                  </div>

                  <div className="order-card-mobile__bottom">
                    <div className="order-card-mobile__total">
                      <span className="total-label">Total:</span>
                      <span className="total-val">{formatMoney(sale.total)}</span>
                    </div>

                    <div className="order-card-mobile__actions">
                      {isPending && (
                        <>
                          <button
                            className="btn btn-sm btn-success"
                            onClick={() => setSettleOrderTarget({ sale, items })}
                          >
                            💵 PAID
                          </button>
                          <button
                            className="btn btn-sm btn-secondary"
                            onClick={() => onEditOrder(sale, items)}
                          >
                            ✏️ EDIT
                          </button>
                          {!isVoided && (
                            <button
                              className="btn btn-sm btn-danger-outline"
                              onClick={() => handleVoid(sale.id)}
                            >
                              ✕
                            </button>
                          )}
                        </>
                      )}
                      {isCredit && (
                        <>
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => setRecordPaymentTarget({ sale, items })}
                          >
                            💵 Receive Payment
                          </button>
                          <button
                            className="btn btn-sm btn-ghost"
                            onClick={() => handlePrintCustomerBill(sale)}
                          >
                            🧾 Print
                          </button>
                          {!isVoided && (
                            <button
                              className="btn btn-sm btn-danger-outline"
                              onClick={() => handleVoid(sale.id)}
                            >
                              ✕
                            </button>
                          )}
                        </>
                      )}
                      {isPaid && (
                        <button
                          className="btn btn-sm btn-ghost"
                          onClick={() => handlePrintCustomerBill(sale)}
                        >
                          🧾 Print Bill
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {settleOrderTarget && (
        <SettleModal
          sale={settleOrderTarget.sale}
          items={settleOrderTarget.items}
          onClose={() => setSettleOrderTarget(null)}
          onSuccess={(updatedSale) => {
            setSettleOrderTarget(null);
            setToast(
              updatedSale.status === 'CREDIT'
                ? `Order #${updatedSale.orderNumber} saved to Khata (${updatedSale.customerName || 'Credit'})!`
                : `Order #${updatedSale.orderNumber} settled as PAID!`
            );
            loadOrders();
          }}
        />
      )}

      {recordPaymentTarget && (
        <RecordPaymentModal
          sale={recordPaymentTarget.sale}
          items={recordPaymentTarget.items}
          onClose={() => setRecordPaymentTarget(null)}
          onSuccess={(updatedSale) => {
            setRecordPaymentTarget(null);
            setToast(`Payment recorded for Order #${updatedSale.orderNumber} — Marked as PAID!`);
            loadOrders();
          }}
        />
      )}

      {toast && (
        <div className="toast" role="status" onAnimationEnd={() => setToast(null)}>
          {toast}
        </div>
      )}
    </div>
  );
}
