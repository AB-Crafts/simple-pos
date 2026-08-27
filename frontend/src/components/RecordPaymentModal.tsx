import React, { useState, useEffect } from 'react';
import { formatMoney, toRupees, toPaisa } from '../utils/money';
import { recordKhataPayment } from '../services/salesService';
import { formatCustomerBill, printReceiptText } from '../utils/slips';
import type { Sale, SaleItem } from '../types';

interface RecordPaymentModalProps {
  sale: Sale;
  items?: SaleItem[];
  onClose: () => void;
  onSuccess: (updatedSale: Sale) => void;
}

export function RecordPaymentModal({
  sale,
  items = [],
  onClose,
  onSuccess,
}: RecordPaymentModalProps) {
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD'>('CASH');
  const [tenderText, setTenderText] = useState('');
  const [customerName, setCustomerName] = useState(sale.customerName ?? '');
  const [customerContact, setCustomerContact] = useState(sale.customerContact ?? '');
  const [printBill, setPrintBill] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalRs = toRupees(sale.total);
  const tenderNum = parseFloat(tenderText) || 0;
  const tenderPaisa = toPaisa(tenderNum);
  const changePaisa = paymentMethod === 'CASH' && tenderPaisa >= sale.total ? tenderPaisa - sale.total : 0;
  const isUnderpaid = paymentMethod === 'CASH' && tenderText !== '' && tenderPaisa < sale.total;

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !saving) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saving, onClose]);

  function handleQuickTender(amount: number) {
    setTenderText(String(amount));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (paymentMethod === 'CASH' && tenderText !== '' && tenderPaisa < sale.total) {
      setError(`Amount received (Rs. ${tenderNum}) is less than total due (${formatMoney(sale.total)})`);
      return;
    }

    setSaving(true);
    try {
      const updated = await recordKhataPayment(
        sale.id,
        paymentMethod,
        paymentMethod === 'CASH' ? (tenderText !== '' ? tenderPaisa : sale.total) : null,
        customerName.trim() || sale.customerName || null,
        customerContact.trim() || sale.customerContact || null
      );

      if (printBill) {
        try {
          const billText = formatCustomerBill(updated, items);
          printReceiptText(`Bill-${updated.orderNumber}`, billText);
        } catch (printErr) {
          console.warn('Auto-print bill receipt failed:', printErr);
        }
      }

      onSuccess(updated);
      onClose();
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Failed to record payment');
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={() => !saving && onClose()}>
      <div
        className="modal-card settle-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 480 }}
      >
        <div className="modal-header">
          <div>
            <h3 className="modal-title">Record Khata Payment</h3>
            <span className="modal-subtitle">
              Order #{sale.orderNumber} ({sale.displayId})
              {sale.customerName ? ` · 👤 ${sale.customerName}` : ''}
              {sale.customerContact ? ` (${sale.customerContact})` : ''}
            </span>
          </div>
          <button
            type="button"
            className="btn-icon"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'contents' }}>
          <div className="modal-body">
            {error && <div className="form-error">{error}</div>}

            {/* Total Balance Due Header Card */}
            <div className="settle-summary" style={{ background: '#fff7ed', borderColor: '#fed7aa' }}>
              <div className="settle-summary__row" style={{ alignItems: 'center' }}>
                <span className="settle-summary__label" style={{ color: '#c2410c', fontSize: 13 }}>
                  Total Khata Balance Due:
                </span>
                <span className="settle-total-amount" style={{ color: '#9a3412', fontSize: 24 }}>
                  {formatMoney(sale.total)}
                </span>
              </div>
            </div>

            {/* Customer Details info */}
            <div className="credit-section" style={{ marginTop: 0 }}>
              <div className="credit-badge-header">
                <span>👤 Customer / Khata Account</span>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: 12, fontWeight: 700 }}>
                  Customer Name
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Haji sb, Ali Raza"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: 12, fontWeight: 700 }}>
                  Contact / WhatsApp (Optional)
                </label>
                <input
                  type="tel"
                  className="form-input"
                  placeholder="e.g. 0300-1234567"
                  value={customerContact}
                  onChange={(e) => setCustomerContact(e.target.value)}
                />
              </div>
            </div>

            {/* Payment Method Toggle */}
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 800 }}>
                Received Payment Method
              </label>
              <div className="payment-method-toggle" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                <button
                  type="button"
                  className={`method-btn ${paymentMethod === 'CASH' ? 'method-btn--active' : ''}`}
                  onClick={() => {
                    setPaymentMethod('CASH');
                    setError(null);
                  }}
                >
                  💵 Cash
                </button>
                <button
                  type="button"
                  className={`method-btn ${paymentMethod === 'CARD' ? 'method-btn--active' : ''}`}
                  onClick={() => {
                    setPaymentMethod('CARD');
                    setError(null);
                  }}
                >
                  💳 Card / Online
                </button>
              </div>
            </div>

            {/* Cash Tender & Change calculation */}
            {paymentMethod === 'CASH' && (
              <div className="cash-section">
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 700 }}>Cash Received (PKR)</label>
                  <input
                    type="number"
                    step="any"
                    className="form-input text-large"
                    placeholder={`Exact (${totalRs})`}
                    value={tenderText}
                    onChange={(e) => {
                      setTenderText(e.target.value);
                      if (error) setError(null);
                    }}
                    autoFocus
                  />
                </div>

                <div className="quick-tender-chips">
                  <button
                    type="button"
                    className="chip"
                    onClick={() => handleQuickTender(totalRs)}
                  >
                    Exact (Rs. {totalRs})
                  </button>
                  {[500, 1000, 5000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      className="chip"
                      onClick={() => handleQuickTender(amt)}
                    >
                      Rs. {amt}
                    </button>
                  ))}
                </div>

                {isUnderpaid && (
                  <p className="form-error" style={{ margin: '4px 0 0' }}>
                    ⚠️ Amount entered is less than total due.
                  </p>
                )}

                {tenderNum >= totalRs && changePaisa > 0 && (
                  <div className="change-display">
                    <span className="change-label">Change to Return:</span>
                    <span className="change-amount change-amount--positive">
                      {formatMoney(changePaisa)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Print receipt checkbox */}
            <div className="form-checkbox-row" style={{ marginTop: 4 }}>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={printBill}
                  onChange={(e) => setPrintBill(e.target.checked)}
                />
                <span>🧾 Print Paid Customer Receipt</span>
              </label>
            </div>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-large"
              disabled={saving || isUnderpaid}
            >
              {saving ? 'Saving Payment...' : `✅ Mark as PAID · ${formatMoney(sale.total)}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
