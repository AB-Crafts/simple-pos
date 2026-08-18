import { useCallback, useEffect, useState } from 'react';
import { ProductGrid } from '../components/ProductGrid';
import { CartPanel } from '../components/CartPanel';
import { PaymentPanel } from '../components/PaymentPanel';
import { SlipModal } from '../components/SlipModal';
import { SettleModal } from '../components/SettleModal';
import { useCart } from '../hooks/useCart';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';
import {
  createOrder,
  updatePendingOrder,
  type OrderOperationResult,
} from '../services/salesService';
import { db } from '../database/db';
import { generateId } from '../utils/id';
import type { OrderType, PaymentMethod, Sale, SaleItem, Waiter } from '../types';
import { formatMoney } from '../utils/money';

interface Props {
  editingOrder?: { sale: Sale; items: SaleItem[] } | null;
  onClearEditingOrder?: () => void;
  onNavigateToOrders?: () => void;
}

export function POSPage({
  editingOrder = null,
  onClearEditingOrder,
  onNavigateToOrders,
}: Props) {
  const cart = useCart();
  const [orderType, setOrderType] = useState<OrderType>(
    editingOrder ? editingOrder.sale.orderType : 'DINE_IN'
  );
  const [selectedWaiter, setSelectedWaiter] = useState<string>(
    editingOrder ? editingOrder.sale.takenBy : 'Buraid'
  );
  const [waiters, setWaiters] = useState<Waiter[]>([]);
  const [showAddWaiter, setShowAddWaiter] = useState(false);
  const [newWaiterName, setNewWaiterName] = useState('');

  const [saving, setSaving] = useState(false);
  const [slipModalResult, setSlipModalResult] = useState<OrderOperationResult | null>(null);
  const [settleModalTarget, setSettleModalTarget] = useState<{ sale: Sale; items: SaleItem[] } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  // Load waiters and pending count from database
  useEffect(() => {
    loadWaiters();
    loadPendingCount();
  }, []);

  async function loadWaiters() {
    const list = await db.waiters.where('active').equals(1).toArray();
    if (list.length === 0) {
      // If table empty or boolean index issue, get all
      const all = await db.waiters.toArray();
      setWaiters(all);
      if (all.length > 0 && !selectedWaiter) {
        setSelectedWaiter(all[0].name);
      }
    } else {
      setWaiters(list);
      if (!selectedWaiter && list.length > 0) {
        setSelectedWaiter(list[0].name);
      }
    }
  }

  async function loadPendingCount() {
    const count = await db.sales.where('status').equals('PENDING').count();
    setPendingCount(count);
  }

  // If editing an existing order, load its items into the cart
  useEffect(() => {
    if (editingOrder) {
      setOrderType(editingOrder.sale.orderType);
      setSelectedWaiter(editingOrder.sale.takenBy);
      cart.loadCart(
        editingOrder.items.map((i) => ({
          productId: i.productId,
          name: i.productName,
          department: i.department,
          unitPrice: i.unitPrice,
          quantity: i.quantity,
        }))
      );
      setToast(`Loaded Order #${editingOrder.sale.orderNumber} for editing`);
    }
  }, [editingOrder]);

  // Barcode scanner
  const handleScan = useCallback(
    async (code: string) => {
      const product = await db.products.where('barcode').equals(code).first();
      if (product && product.active) {
        cart.addProduct(product);
        setToast(`Added ${product.name}`);
      } else {
        setToast(`No product found for barcode ${code}`);
      }
    },
    [cart]
  );
  useBarcodeScanner(handleScan);

  async function handleAddWaiter() {
    if (!newWaiterName.trim()) return;
    const name = newWaiterName.trim();
    const newWaiter: Waiter = {
      id: generateId(),
      name,
      active: true,
      createdAt: Date.now(),
    };
    await db.waiters.add(newWaiter);
    setWaiters((prev) => [...prev, newWaiter]);
    setSelectedWaiter(name);
    setNewWaiterName('');
    setShowAddWaiter(false);
    setToast(`Added waiter "${name}"`);
  }

  // 1. Send Order to Kitchen as PENDING (generates Chai & Parhata slips)
  async function handleSendToKitchen() {
    if (cart.lines.length === 0) return;
    setSaving(true);
    try {
      if (editingOrder) {
        // Update existing pending order
        const result = await updatePendingOrder(
          editingOrder.sale.id,
          cart.lines,
          orderType === 'DINE_IN' ? selectedWaiter : 'Cashier'
        );
        setToast(`Order #${result.sale.orderNumber} updated!`);
        cart.clear();
        if (onClearEditingOrder) onClearEditingOrder();

        // Show slip modal with supplementary token if new department items exist
        setSlipModalResult(result);
      } else {
        // Create new pending order
        const result = await createOrder({
          cart: cart.lines,
          orderType,
          takenBy: orderType === 'DINE_IN' ? selectedWaiter : 'Cashier',
          status: 'PENDING',
        });
        setToast(`Order #${result.sale.orderNumber} placed in Pending!`);
        cart.clear();

        // Show kitchen slips modal
        setSlipModalResult(result);
      }
      loadPendingCount();
    } catch (err: any) {
      alert(err.message || 'Failed to process order');
    } finally {
      setSaving(false);
    }
  }

  // 2. Complete / Pay immediately (for Takeaways or direct Dine-In payment)
  async function handleDirectPayment(method: PaymentMethod, amountReceived: number | null) {
    if (cart.lines.length === 0) return;
    setSaving(true);
    try {
      if (editingOrder) {
        // Update order first then settle
        await updatePendingOrder(
          editingOrder.sale.id,
          cart.lines,
          orderType === 'DINE_IN' ? selectedWaiter : 'Cashier'
        );
        setSettleModalTarget({
          sale: { ...editingOrder.sale, total: cart.total },
          items: cart.lines.map((l) => ({
            id: generateId(),
            saleId: editingOrder.sale.id,
            productId: l.productId,
            productName: l.name,
            department: l.department,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            costPrice: 0,
            total: l.unitPrice * l.quantity,
          })),
        });
      } else {
        const result = await createOrder({
          cart: cart.lines,
          orderType,
          takenBy: orderType === 'DINE_IN' ? selectedWaiter : 'Cashier',
          status: 'PAID',
          paymentMethod: method,
          amountReceived,
        });

        setToast(`Sale complete — Order #${result.sale.orderNumber} (${formatMoney(cart.total)})`);
        cart.clear();
        setSlipModalResult(result);
      }
      loadPendingCount();
    } catch (err: any) {
      alert(err.message || 'Failed to complete sale');
    } finally {
      setSaving(false);
    }
  }

  function handleCancelEdit() {
    cart.clear();
    if (onClearEditingOrder) onClearEditingOrder();
    setToast('Cancelled order editing');
  }

  return (
    <div className="pos-page">
      <div className="pos-page__main">
        {/* Order Type and Waiter Selection Bar */}
        <div className="pos-order-bar">
          <div className="order-type-switch">
            <button
              type="button"
              className={`type-btn ${orderType === 'DINE_IN' ? 'type-btn--active' : ''}`}
              onClick={() => setOrderType('DINE_IN')}
            >
              ☕ Dine In
            </button>
            <button
              type="button"
              className={`type-btn ${orderType === 'TAKE_AWAY' ? 'type-btn--active' : ''}`}
              onClick={() => setOrderType('TAKE_AWAY')}
            >
              🛍️ Take Away
            </button>
          </div>

          {orderType === 'DINE_IN' && (
            <div className="waiter-select-group">
              <label htmlFor="waiter-select" className="waiter-label">
                Waiter:
              </label>
              <select
                id="waiter-select"
                className="waiter-dropdown"
                value={selectedWaiter}
                onChange={(e) => setSelectedWaiter(e.target.value)}
              >
                {waiters.map((w) => (
                  <option key={w.id} value={w.name}>
                    {w.name}
                  </option>
                ))}
                {waiters.length === 0 && <option value="Buraid">Buraid</option>}
              </select>

              <button
                type="button"
                className="btn-add-waiter"
                onClick={() => setShowAddWaiter(true)}
                title="Add new waiter"
              >
                +
              </button>
            </div>
          )}

          {onNavigateToOrders && (
            <button
              type="button"
              className="btn-pending-badge"
              onClick={onNavigateToOrders}
              title="View all active pending orders"
            >
              🟡 Active Orders ({pendingCount})
            </button>
          )}
        </div>

        {editingOrder && (
          <div className="editing-banner">
            <div className="editing-banner__info">
              <strong>✏️ Editing Order #{editingOrder.sale.orderNumber}</strong> · Taken by:{' '}
              {editingOrder.sale.takenBy}
              <span className="editing-banner__hint">
                (Newly added Chai/Parhata items will generate supplementary slips)
              </span>
            </div>
            <button type="button" className="btn btn-sm btn-ghost" onClick={handleCancelEdit}>
              Cancel Editing
            </button>
          </div>
        )}

        <ProductGrid onAddProduct={cart.addProduct} />
      </div>

      {/* POS Sidebar: Cart & Actions */}
      <div className="pos-page__sidebar">
        <CartPanel
          lines={cart.lines}
          total={cart.total}
          onIncrement={cart.increment}
          onDecrement={cart.decrement}
          onRemove={cart.removeLine}
          onClear={cart.clear}
        />

        <div className="pos-action-panel">
          {editingOrder ? (
            <div className="edit-actions-stack">
              <button
                className="btn btn-primary btn-large btn-block"
                disabled={saving || cart.lines.length === 0}
                onClick={handleSendToKitchen}
              >
                ⚡ Update Order & Print Add-On Slips
              </button>
              <button
                className="btn btn-success btn-block"
                disabled={saving || cart.lines.length === 0}
                onClick={() =>
                  setSettleModalTarget({
                    sale: { ...editingOrder.sale, total: cart.total },
                    items: cart.lines.map((l) => ({
                      id: generateId(),
                      saleId: editingOrder.sale.id,
                      productId: l.productId,
                      productName: l.name,
                      department: l.department,
                      quantity: l.quantity,
                      unitPrice: l.unitPrice,
                      costPrice: 0,
                      total: l.unitPrice * l.quantity,
                    })),
                  })
                }
              >
                💵 Settle & Clear Payment
              </button>
            </div>
          ) : (
            <div className="order-actions-stack">
              <button
                className="btn btn-primary btn-large btn-block send-kitchen-btn"
                disabled={saving || cart.lines.length === 0}
                onClick={handleSendToKitchen}
                title="Saves order in PENDING status and immediately generates Chai & Parhata kitchen slips"
              >
                ⚡ Send to Kitchen (Pending Bill)
              </button>

              <div className="direct-pay-wrapper">
                <PaymentPanel
                  total={cart.total}
                  disabled={saving || cart.lines.length === 0}
                  onComplete={handleDirectPayment}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Waiter Modal */}
      {showAddWaiter && (
        <div className="modal-overlay" onClick={() => setShowAddWaiter(false)}>
          <div className="modal-card modal-card--sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Add Waiter</h3>
              <button className="btn-icon" onClick={() => setShowAddWaiter(false)}>
                ✕
              </button>
            </div>
            <div className="form-group">
              <label className="form-label">Waiter Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Buraid, Ali, Hamza..."
                value={newWaiterName}
                onChange={(e) => setNewWaiterName(e.target.value)}
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleAddWaiter()}
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowAddWaiter(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleAddWaiter}>
                Add Waiter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Slips & Tokens Preview Modal */}
      {slipModalResult && (
        <SlipModal
          sale={slipModalResult.sale}
          items={slipModalResult.items}
          deltaItems={slipModalResult.deltaItems}
          chaiItems={slipModalResult.chaiItems}
          parhataItems={slipModalResult.parhataItems}
          isSupplementary={slipModalResult.isSupplementary}
          onClose={() => setSlipModalResult(null)}
        />
      )}

      {/* Settle Order Modal */}
      {settleModalTarget && (
        <SettleModal
          sale={settleModalTarget.sale}
          items={settleModalTarget.items}
          onSuccess={(settled) => {
            setSettleModalTarget(null);
            setToast(`Order #${settled.orderNumber} marked as PAID`);
            cart.clear();
            if (onClearEditingOrder) onClearEditingOrder();
            loadPendingCount();
          }}
          onClose={() => setSettleModalTarget(null)}
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
