import { useCallback, useEffect, useState } from 'react';
import { ProductGrid } from '../components/ProductGrid';
import { CartPanel } from '../components/CartPanel';
import { PaymentPanel } from '../components/PaymentPanel';
import { SlipModal } from '../components/SlipModal';
import { SettleModal } from '../components/SettleModal';
import { CustomAmountModal } from '../components/CustomAmountModal';
import { useCart } from '../hooks/useCart';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';
import {
  createOrder,
  updatePendingOrder,
  prepareOrderPreview,
  type OrderOperationResult,
} from '../services/salesService';
import { apiClient } from '../services/apiClient';
import { generateId } from '../utils/id';
import type { CartLine, OrderType, Paisa, PaymentMethod, Product, Sale, SaleItem, Waiter } from '../types';
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
  const [waiters, setWaiters] = useState<Waiter[]>([]);
  const [selectedWaiter, setSelectedWaiter] = useState<string>('Waiter');
  const [orderType, setOrderType] = useState<OrderType>('DINE_IN');
  const [showAddWaiter, setShowAddWaiter] = useState(false);
  const [newWaiterName, setNewWaiterName] = useState('');
  const [pendingCount, setPendingCount] = useState(0);

  const [saving, setSaving] = useState(false);
  const [slipModalResult, setSlipModalResult] = useState<OrderOperationResult | null>(null);
  const [settleModalTarget, setSettleModalTarget] = useState<{ sale: Sale; items: SaleItem[] } | null>(null);
  const [customModalTarget, setCustomModalTarget] = useState<{
    product: Product;
    line?: CartLine;
  } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Barcode scanner integration
  const handleScan = useCallback(
    async (code: string) => {
      try {
        const product = await apiClient.get<Product | null>(`/products/barcode/${code}`);
        if (product && product.active) {
          cart.addProduct(product);
          setToast(`Added ${product.name}`);
        } else {
          setToast(`No product found for barcode ${code}`);
        }
      } catch {
        setToast(`No product found for barcode ${code}`);
      }
    },
    [cart]
  );
  useBarcodeScanner(handleScan);

  // Load waiters and active pending orders count
  useEffect(() => {
    loadWaiters();
    loadPendingCount();
  }, []);

  // When an order is being edited, populate cart with its lines
  useEffect(() => {
    if (editingOrder) {
      setOrderType(editingOrder.sale.orderType || 'DINE_IN');
      if (editingOrder.sale.takenBy) {
        setSelectedWaiter(editingOrder.sale.takenBy);
      }
      cart.loadCart(
        editingOrder.items.map((i) => ({
          productId: i.productId,
          name: i.productName,
          unitPrice: i.unitPrice,
          quantity: i.quantity,
          department: i.department,
        }))
      );
    }
  }, [editingOrder]);

  async function loadWaiters() {
    try {
      const list = await apiClient.get<Waiter[]>('/waiters?active=true');
      setWaiters(list);
      if (list.length > 0) {
        if (!selectedWaiter || selectedWaiter === 'Waiter' || !list.some((w) => w.name === selectedWaiter)) {
          setSelectedWaiter(list[0].name);
        }
      } else {
        setSelectedWaiter('');
      }
    } catch (err) {
      console.error('Failed to load waiters:', err);
    }
  }

  async function loadPendingCount() {
    try {
      const { count } = await apiClient.get<{ count: number }>('/sales/pending-count');
      setPendingCount(count);
    } catch {
      // ignore if offline / starting up
    }
  }

  async function handleAddWaiter() {
    const name = newWaiterName.trim();
    if (!name) return;
    try {
      await apiClient.post<Waiter>('/waiters', { name });
      await loadWaiters();
      setSelectedWaiter(name);
      setNewWaiterName('');
      setShowAddWaiter(false);
      setToast(`Added waiter "${name}"`);
    } catch (err: any) {
      alert(err.message || 'Failed to add waiter');
    }
  }

  // 1. Send Order to Kitchen (Preview first — only committed to DB when "Done" is clicked)
  async function handleSendToKitchen() {
    if (cart.lines.length === 0) return;
    setSaving(true);
    try {
      const waiterName = orderType === 'DINE_IN' ? (selectedWaiter.trim() || 'Waiter') : 'Cashier';
      const preview = await prepareOrderPreview(
        cart.lines,
        orderType,
        waiterName,
        editingOrder?.sale
      );
      setSlipModalResult(preview);
    } catch (err: any) {
      alert(err.message || 'Failed to prepare order preview');
    } finally {
      setSaving(false);
    }
  }

  // 2. Confirm and Save Order to Database (Triggered when user clicks "Done" in SlipModal)
  async function handleConfirmDone() {
    if (!slipModalResult || cart.lines.length === 0) {
      setSlipModalResult(null);
      return;
    }
    setSaving(true);
    try {
      const waiterName = orderType === 'DINE_IN' ? (selectedWaiter.trim() || 'Waiter') : 'Cashier';
      if (editingOrder) {
        // Update existing pending order in database
        const result = await updatePendingOrder(
          editingOrder.sale.id,
          cart.lines,
          waiterName
        );
        setToast(`Order #${result.sale.orderNumber} updated!`);
        cart.clear();
        if (onClearEditingOrder) onClearEditingOrder();
      } else {
        // Create new pending order in database
        const result = await createOrder({
          cart: cart.lines,
          orderType,
          takenBy: waiterName,
          status: 'PENDING',
        });
        setToast(`Order #${result.sale.orderNumber} placed in Pending!`);
        cart.clear();
      }
      setSlipModalResult(null);
      loadPendingCount();
    } catch (err: any) {
      alert(err.message || 'Failed to save order');
    } finally {
      setSaving(false);
    }
  }

  // 3. Cancel and Discard (Database is NOT touched, order is discarded)
  function handleCancelDiscard() {
    setSlipModalResult(null);
    setToast('Order cancelled / discarded.');
  }

  // 2. Complete / Pay immediately (for Takeaways or direct Dine-In payment)
  async function handleDirectPayment(method: PaymentMethod, amountReceived: number | null) {
    if (cart.lines.length === 0) return;
    setSaving(true);
    try {
      const waiterName = orderType === 'DINE_IN' ? (selectedWaiter.trim() || 'Waiter') : 'Cashier';
      if (editingOrder) {
        // Update order first then settle
        await updatePendingOrder(
          editingOrder.sale.id,
          cart.lines,
          waiterName
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
          takenBy: waiterName,
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

  // Open custom amount modal for a product (e.g. Karak Chai)
  function handleOpenCustomModal(product: Product) {
    setCustomModalTarget({ product });
  }

  // Edit price of an existing cart line
  async function handleEditCartLinePrice(line: CartLine) {
    let product: Product | null = null;
    try {
      product = await apiClient.get<Product>(`/products/${line.productId}`);
    } catch {
      product = null;
    }

    const fallbackProduct: Product = product || {
      id: line.productId,
      name: line.name,
      department: line.department,
      sellingPrice: line.unitPrice,
      costPrice: 0,
      stock: 100,
      active: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      categoryId: null,
    };
    setCustomModalTarget({ product: fallbackProduct, line });
  }

  // Confirm custom amount from modal
  function handleConfirmCustomAmount(
    product: Product,
    unitPrice: Paisa,
    customName?: string,
    quantity = 1
  ) {
    if (customModalTarget?.line) {
      // Editing existing line
      cart.updateLinePrice(customModalTarget.line.id || customModalTarget.line.productId, unitPrice, customName);
      setToast(`Updated price for ${customModalTarget.line.name} to ${formatMoney(unitPrice)}`);
    } else {
      // Adding new customized product to cart
      cart.addProduct(product, unitPrice, customName, quantity);
      setToast(`Added ${customName || product.name} (${formatMoney(unitPrice)})`);
    }
    setCustomModalTarget(null);
  }

  return (
    <div className="pos-page">
      <div className="pos-left-panel">
        <ProductGrid
          onAddProduct={cart.addProduct}
          onCustomAmount={handleOpenCustomModal}
        />
      </div>

      <div className="pos-right-panel">
        {editingOrder && (
          <div className="order-editing-banner">
            <div>
              <strong>✏️ Editing Order #{editingOrder.sale.orderNumber}</strong>
              <span className="order-editing-banner__sub"> ({editingOrder.sale.displayId})</span>
            </div>
            <button className="btn btn-sm btn-ghost" onClick={handleCancelEdit}>
              Cancel Editing
            </button>
          </div>
        )}

        {/* Order Type & Waiter Bar */}
        <div className="order-context-bar">
          <div className="order-type-toggle">
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
              🛍️ Takeaway
            </button>
          </div>

          {orderType === 'DINE_IN' && (
            <div className="waiter-select-group">
              <span className="waiter-label">👤 Waiter:</span>
              <select
                className="waiter-select"
                value={selectedWaiter}
                onChange={(e) => {
                  if (e.target.value === '__add_new__') {
                    setShowAddWaiter(true);
                  } else {
                    setSelectedWaiter(e.target.value);
                  }
                }}
              >
                {waiters.length === 0 && (
                  <option value="">(No Waiters - Click to Add)</option>
                )}
                {waiters.map((w) => (
                  <option key={w.id} value={w.name}>
                    {w.name}
                  </option>
                ))}
                <option value="__add_new__">+ Add Waiter...</option>
              </select>
            </div>
          )}
        </div>

        {/* Active Orders & Bills Quick Counter Link */}
        {onNavigateToOrders && (
          <div className="active-orders-quicklink" onClick={onNavigateToOrders}>
            <div className="quicklink-left">
              <span className="quicklink-badge">
                🟡 {pendingCount} Pending {pendingCount === 1 ? 'Order' : 'Orders'}
              </span>
              <span className="quicklink-desc">View running bills & kitchen slips</span>
            </div>
            <span className="quicklink-arrow">Orders & Bills →</span>
          </div>
        )}

        {/* Add Waiter Inline Modal */}
        {showAddWaiter && (
          <div className="inline-add-waiter">
            <input
              type="text"
              placeholder="Waiter name (e.g. Usman, Ali)..."
              value={newWaiterName}
              onChange={(e) => setNewWaiterName(e.target.value)}
              className="waiter-input"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleAddWaiter()}
            />
            <button className="btn btn-sm btn-primary" onClick={handleAddWaiter}>
              Save
            </button>
            <button
              className="btn btn-sm btn-ghost"
              onClick={() => {
                setShowAddWaiter(false);
                setNewWaiterName('');
              }}
            >
              Cancel
            </button>
          </div>
        )}

        <CartPanel
          lines={cart.lines}
          total={cart.total}
          onIncrement={cart.increment}
          onDecrement={cart.decrement}
          onRemove={cart.removeLine}
          onClear={cart.clear}
          onEditPrice={handleEditCartLinePrice}
        />

        <div className="pos-action-panel">
          <div className="order-actions-stack">
            <button
              type="button"
              className="send-kitchen-btn"
              disabled={cart.lines.length === 0 || saving}
              onClick={handleSendToKitchen}
            >
              {editingOrder ? '📋 Print Supplementary Slip & Update' : '📋 Send to Kitchen (Slip)'}
            </button>
            <PaymentPanel
              total={cart.total}
              disabled={cart.lines.length === 0 || saving}
              onComplete={handleDirectPayment}
            />
          </div>
        </div>
      </div>

      {/* Floating Cart Bar for Mobile Viewports */}
      {cart.lines.length > 0 && (
        <div
          className="mobile-cart-float-bar"
          onClick={() => {
            const sidebar = document.querySelector('.pos-right-panel');
            sidebar?.scrollIntoView({ behavior: 'smooth' });
          }}
        >
          <div className="mobile-cart-float-info">
            <span className="mobile-cart-float-badge">
              🛒 {cart.lines.reduce((sum, l) => sum + l.quantity, 0)} items
            </span>
            <span className="mobile-cart-float-total">{formatMoney(cart.total)}</span>
          </div>
          <button type="button" className="mobile-cart-float-btn">
            View Bill & Settle →
          </button>
        </div>
      )}


      {/* Slip Modal Preview & Confirmation */}
      {slipModalResult && (
        <SlipModal
          sale={slipModalResult.sale}
          items={slipModalResult.items}
          deltaItems={slipModalResult.deltaItems}
          chaiItems={slipModalResult.chaiItems}
          parhataItems={slipModalResult.parhataItems}
          isSupplementary={slipModalResult.isSupplementary}
          onConfirmDone={handleConfirmDone}
          onCancelDiscard={handleCancelDiscard}
          confirming={saving}
        />
      )}

      {/* Settle Bill Modal for cleared orders */}
      {settleModalTarget && (
        <SettleModal
          sale={settleModalTarget.sale}
          items={settleModalTarget.items}
          onSuccess={() => {
            setSettleModalTarget(null);
            cart.clear();
            if (onClearEditingOrder) onClearEditingOrder();
            setToast('Bill cleared successfully');
            loadPendingCount();
          }}
          onClose={() => setSettleModalTarget(null)}
        />
      )}

      {/* Custom Amount Modal (Karak Chai / Custom Items / Price Edits) */}
      {customModalTarget && (
        <CustomAmountModal
          product={customModalTarget.product}
          initialUnitPrice={customModalTarget.line ? customModalTarget.line.unitPrice : customModalTarget.product.sellingPrice}
          initialQuantity={customModalTarget.line ? customModalTarget.line.quantity : 1}
          onConfirm={handleConfirmCustomAmount}
          onClose={() => setCustomModalTarget(null)}
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
