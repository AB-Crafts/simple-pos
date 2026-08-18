import { useState } from 'react';
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
  const [printBillOnSettle, setPrintBillOnSettle] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalRupees = toRupees(sale.total);
  const parsedTender = parseFloat(tenderRupees) || 0;
  const changeRupees = Math.max(0, parsedTender - totalRupees);
  const isCash = method === 'CASH';
  const isInsufficient = isCash && parsedTender < totalRupees;

  async function handleSettle() {
    if (isInsufficient) {
      setError('Amount received is less than total bill');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const amountReceived = isCash ? toPaisa(parsedTender) : null;
      const settled = await settlePendingOrder(sale.id, method, amountReceived);

      if (printBillOnSettle) {
        const billText = formatCustomerBill(settled, items);
        printReceiptText(`Bill-${settled.orderNumber}`, billText);
      }

      onSuccess(settled);
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

        <div className="settle-summary">
          <div className="settle-summary__row">
            <span>Items ({items.reduce((acc, i) => acc + i.quantity, 0)})</span>
            <span>{items.map((i) => `${i.productName} x${i.quantity}`).join(', ')}</span>
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
              onClick={() => setMethod('CASH')}
            >
              💵 Cash
            </button>
            <button
              type="button"
              className={`method-btn ${method === 'CARD' ? 'method-btn--active' : ''}`}
              onClick={() => setMethod('CARD')}
            >
              💳 Card
            </button>
            <button
              type="button"
              className={`method-btn ${method === 'CREDIT' ? 'method-btn--active' : ''}`}
              onClick={() => setMethod('CREDIT')}
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
              {[100, 500, 1000, 5000].map((val) => (
                val >= totalRupees ? (
                  <button key={val} type="button" className="chip" onClick={() => handleQuickTender(val)}>
                    Rs {val}
                  </button>
                ) : null
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

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            className="btn btn-primary btn-large"
            onClick={handleSettle}
            disabled={saving || isInsufficient}
          >
            {saving ? 'Processing...' : `Mark as PAID · ${formatMoney(sale.total)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
