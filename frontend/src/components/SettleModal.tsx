import { useState, useEffect } from 'react';
import type { Sale, SaleItem, PaymentMethod } from '../types';
import { formatMoney, toPaisa, toRupees } from '../utils/money';
import { settlePendingOrder } from '../services/salesService';
import { formatCustomerBill, printReceiptText } from '../utils/slips';

interface Props {
  sale: Sale;
  items: SaleItem[];
  onSuccess: (settledSale: Sale) => void;
  onClose: () => void;
}

export function SettleModal({ sale, items, onSuccess, onClose }: Props) {
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [tenderRupees, setTenderRupees] = useState<string>(toRupees(sale.total).toString());
  const [customerName, setCustomerName] = useState('');
  const [customerContact, setCustomerContact] = useState('');
  const [printBillOnSettle, setPrintBillOnSettle] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalRupees = toRupees(sale.total);
  const parsedTender = parseFloat(tenderRupees) || 0;
  const changeRupees = Math.max(0, parsedTender - totalRupees);
  const isCash = method === 'CASH';
  const isCredit = method === 'CREDIT';
  const isInsufficient = isCash && parsedTender < totalRupees;
  const isCreditMissingName = isCredit && !customerName.trim();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !saving) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saving, onClose]);

  async function handleSettle() {
    if (isInsufficient) {
      setError('Amount received is less than total bill');
      return;
    }
    if (isCredit && !customerName.trim()) {
      setError('Please enter customer name for Credit / Khata');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const amountReceived = isCash ? toPaisa(parsedTender) : null;
      const settled = await settlePendingOrder(
        sale.id,
        method,
        amountReceived,
        isCredit ? customerName.trim() : null,
        isCredit ? customerContact.trim() : null
      );

      if (printBillOnSettle) {
        const billText = formatCustomerBill(settled, items);
        printReceiptText(`Bill-${settled.orderNumber}`, billText);
      }

      onSuccess(settled);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to settle order');
    } finally {
      setSaving(false);
    }
  }

  function handleQuickTender(amount: number) {
    setTenderRupees(amount.toString());
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card settle-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 className="modal-title">Clear Bill · Order #{sale.orderNumber}</h3>
            <span className="modal-subtitle">
              {sale.orderType === 'DINE_IN' ? `Waiter: ${sale.takenBy}` : 'Takeaway'} · Ref: {sale.displayId}
            </span>
          </div>
          <button className="btn-icon" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="settle-summary">
            <div className="settle-summary__row">
              <span className="settle-summary__label">Items ({items.reduce((acc, i) => acc + i.quantity, 0)})</span>
              <span className="settle-summary__items-preview">
                {items.map((i) => `${i.productName} x${i.quantity}`).join(', ')}
              </span>
            </div>
            <div className="settle-summary__total">
              <span>Total Payable</span>
              <span className="settle-total-amount">{formatMoney(sale.total)}</span>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Payment Method</label>
            <div className="payment-method-toggle">
              <button
                type="button"
                className={`method-btn ${method === 'CASH' ? 'method-btn--active' : ''}`}
                onClick={() => {
                  setMethod('CASH');
                  setError(null);
                }}
              >
                💵 Cash
              </button>
              <button
                type="button"
                className={`method-btn ${method === 'CARD' ? 'method-btn--active' : ''}`}
                onClick={() => {
                  setMethod('CARD');
                  setError(null);
                }}
              >
                💳 Card
              </button>
              <button
                type="button"
                className={`method-btn ${method === 'CREDIT' ? 'method-btn--active' : ''}`}
                onClick={() => {
                  setMethod('CREDIT');
                  setError(null);
                }}
              >
                📝 Credit / Khata
              </button>
            </div>
          </div>

          {isCash && (
            <div className="cash-section">
              <div className="form-group">
                <label className="form-label">Amount Received (PKR)</label>
                <input
                  type="number"
                  className="form-input text-large"
                  value={tenderRupees}
                  onChange={(e) => setTenderRupees(e.target.value)}
                  min={totalRupees}
                  step="10"
                  autoFocus
                />
              </div>

              <div className="quick-tender-chips">
                <button type="button" className="chip" onClick={() => handleQuickTender(totalRupees)}>
                  Exact (Rs {totalRupees})
                </button>
                {[500, 1000, 5000].map((val) => (
                  <button key={val} type="button" className="chip" onClick={() => handleQuickTender(val)}>
                    Rs {val}
                  </button>
                ))}
              </div>

              <div className="change-display">
                <span className="change-label">Change to Return:</span>
                <span className={`change-amount ${changeRupees > 0 ? 'change-amount--positive' : ''}`}>
                  Rs {changeRupees.toFixed(0)}
                </span>
              </div>
            </div>
          )}

          {isCredit && (
            <div className="credit-section">
              <div className="credit-badge-header">
                <span>📝 Customer Khata Details</span>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="khata-name">
                  Customer Name <span className="text-danger">*</span>
                </label>
                <input
                  id="khata-name"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Haji sb, Usman, Bilal..."
                  value={customerName}
                  onChange={(e) => {
                    setCustomerName(e.target.value);
                    if (error) setError(null);
                  }}
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="khata-contact">
                  Contact / Phone Number
                </label>
                <input
                  id="khata-contact"
                  type="tel"
                  className="form-input"
                  placeholder="e.g. 0300-1234567..."
                  value={customerContact}
                  onChange={(e) => setCustomerContact(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="form-checkbox-row">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={printBillOnSettle}
                onChange={(e) => setPrintBillOnSettle(e.target.checked)}
              />
              <span>🧾 Print Total Bill Slip (Customer Demanded)</span>
            </label>
          </div>

          {error && <div className="form-error">{error}</div>}
        </div>

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            className="btn btn-primary btn-large"
            onClick={handleSettle}
            disabled={saving || isInsufficient || isCreditMissingName}
          >
            {saving
              ? 'Processing...'
              : isCredit
              ? `Confirm Khata · ${formatMoney(sale.total)}`
              : isCash
              ? `Mark as PAID · ${formatMoney(sale.total)}`
              : `Mark as PAID (Card) · ${formatMoney(sale.total)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
