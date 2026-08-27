import { useState, useEffect, useMemo } from 'react';
import type { CartLine, PaymentMethod, Sale } from '../types';
import { formatMoney, toPaisa, toRupees } from '../utils/money';
import { createOrder, partitionDepartmentItems } from '../services/salesService';
import {
  formatChaiSlip,
  formatParhataSlip,
  formatCustomerBill,
  printReceiptText,
  printMultipleSlips,
} from '../utils/slips';

interface Props {
  lines: CartLine[];
  total: number;
  onSuccess: (completedSale: Sale, changePkr: number) => void;
  onClose: () => void;
}

export function TakeawaySettleModal({ lines, total, onSuccess, onClose }: Props) {
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [tenderRupees, setTenderRupees] = useState<string>(toRupees(total).toString());
  const [customerName, setCustomerName] = useState('');
  const [customerContact, setCustomerContact] = useState('');
  const [printToken, setPrintToken] = useState(true);
  const [printBill, setPrintBill] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalRupees = toRupees(total);
  const parsedTender = parseFloat(tenderRupees) || 0;
  const changeRupees = Math.max(0, parsedTender - totalRupees);
  const isCash = method === 'CASH';
  const isCredit = method === 'CREDIT';
  const isInsufficient = isCash && parsedTender < totalRupees;
  const isCreditMissingName = isCredit && !customerName.trim();

  // Partition department items for kitchen tokens (Chai / Parhata)
  const { chaiItems, parhataItems } = useMemo(() => {
    return partitionDepartmentItems(lines);
  }, [lines]);

  const hasChai = chaiItems.length > 0;
  const hasParhata = parhataItems.length > 0;

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
    setTenderRupees(amount.toString());
  }

  function handleNumpad(key: string) {
    if (key === 'C') {
      setTenderRupees('');
    } else if (key === 'BACK') {
      setTenderRupees((prev) => prev.slice(0, -1));
    } else if (key === '00') {
      if (!tenderRupees || tenderRupees === '0') return;
      setTenderRupees((prev) => prev + '00');
    } else {
      if (tenderRupees === '0') {
        setTenderRupees(key);
      } else {
        setTenderRupees((prev) => prev + key);
      }
    }
  }

  function printTokensForSale(sale: Sale) {
    const slipsToPrint: string[] = [];
    if (hasChai) {
      slipsToPrint.push(formatChaiSlip(sale, chaiItems, false));
    }
    if (hasParhata) {
      slipsToPrint.push(formatParhataSlip(sale, parhataItems, false));
    }
    if (slipsToPrint.length > 0) {
      printMultipleSlips(`Customer-Token-${sale.orderNumber}`, slipsToPrint);
    }
  }

  function printBillForSale(sale: Sale) {
    const saleItems = lines.map((l) => ({
      id: l.productId,
      saleId: sale.id,
      productId: l.productId,
      productName: l.name,
      department: l.department,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      costPrice: 0,
      total: l.unitPrice * l.quantity,
    }));
    const billText = formatCustomerBill(sale, saleItems);
    printReceiptText(`Customer-Bill-${sale.orderNumber}`, billText);
  }

  function printTokensAndBillForSale(sale: Sale) {
    const slipsToPrint: string[] = [];
    if (hasChai) {
      slipsToPrint.push(formatChaiSlip(sale, chaiItems, false));
    }
    if (hasParhata) {
      slipsToPrint.push(formatParhataSlip(sale, parhataItems, false));
    }
    const saleItems = lines.map((l) => ({
      id: l.productId,
      saleId: sale.id,
      productId: l.productId,
      productName: l.name,
      department: l.department,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      costPrice: 0,
      total: l.unitPrice * l.quantity,
    }));
    slipsToPrint.push(formatCustomerBill(sale, saleItems));

    printMultipleSlips(`Takeaway-Order-${sale.orderNumber}`, slipsToPrint);
  }

  async function handleCompleteSale() {
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
      const amountReceivedPaisa = isCash ? toPaisa(parsedTender) : null;
      const targetStatus = isCredit ? 'CREDIT' : 'PAID';

      const result = await createOrder({
        cart: lines,
        orderType: 'TAKE_AWAY',
        takenBy: 'Cashier',
        status: targetStatus,
        paymentMethod: method,
        amountReceived: amountReceivedPaisa,
        customerName: isCredit ? customerName.trim() : null,
        customerContact: isCredit ? customerContact.trim() : null,
      });

      const completedSale = result.sale;

      // Handle automatic printing if enabled
      if (printToken && printBill) {
        try {
          printTokensAndBillForSale(completedSale);
        } catch (e) {
          console.warn('Auto print failed:', e);
        }
      } else if (printToken && (hasChai || hasParhata)) {
        try {
          printTokensForSale(completedSale);
        } catch (e) {
          console.warn('Auto print token failed:', e);
        }
      } else if (printBill) {
        try {
          printBillForSale(completedSale);
        } catch (e) {
          console.warn('Auto print bill failed:', e);
        }
      }

      onSuccess(completedSale, changeRupees);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to complete takeaway sale');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card settle-modal takeaway-settle-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="takeaway-modal-title"
      >
        <div className="modal-header">
          <div>
            <h3 id="takeaway-modal-title" className="modal-title">
              🛍️ Clear Bill & Complete Takeaway Sale
            </h3>
            <span className="modal-subtitle">
              Instant settlement · Direct PAID / Khata (Bypasses Pending)
            </span>
          </div>
          <button className="btn-icon" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="modal-body">
          {/* Order Summary Card */}
          <div className="settle-summary">
            <div className="settle-summary__row">
              <span className="settle-summary__label">
                Items ({lines.reduce((acc, i) => acc + i.quantity, 0)})
              </span>
              <span className="settle-summary__items-preview">
                {lines.map((i) => `${i.name} x${i.quantity}`).join(', ')}
              </span>
            </div>
            <div className="settle-summary__total">
              <span>Total Payable</span>
              <span className="settle-total-amount">{formatMoney(total)}</span>
            </div>
          </div>

          {/* Payment Method Selector */}
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

          {/* Cash Payment Section */}
          {isCash && (
            <div className="cash-section">
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="form-label" htmlFor="takeaway-cash-input">
                    Amount Received (PKR)
                  </label>
                  <span className="section-micro-label" style={{ color: 'var(--ink-soft)' }}>
                    Custom Amount or Presets
                  </span>
                </div>
                <div className="custom-amount-input-wrap" style={{ marginTop: 4 }}>
                  <span className="currency-symbol">Rs.</span>
                  <input
                    id="takeaway-cash-input"
                    type="number"
                    className="custom-amount-input"
                    value={tenderRupees}
                    onChange={(e) => setTenderRupees(e.target.value)}
                    min={totalRupees}
                    step="1"
                    placeholder={String(totalRupees)}
                    autoFocus
                  />
                </div>
              </div>

              {/* 3 Preset Options: 500, 1000, 5000 (+ Exact) */}
              <div className="quick-tender-chips" style={{ marginTop: 8, marginBottom: 12 }}>
                <button
                  type="button"
                  className={`chip ${parsedTender === totalRupees ? 'chip--active' : ''}`}
                  onClick={() => handleQuickTender(totalRupees)}
                >
                  Exact (Rs {totalRupees})
                </button>
                {[500, 1000, 5000].map((val) => (
                  <button
                    key={val}
                    type="button"
                    className={`chip ${parsedTender === val ? 'chip--active' : ''}`}
                    onClick={() => handleQuickTender(val)}
                  >
                    Rs {val}
                  </button>
                ))}
              </div>

              {/* Touch Numpad for Cash Entry */}
              <div className="touch-numpad" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 12 }}>
                {['1', '2', '3', '500', '4', '5', '6', '1000', '7', '8', '9', '5000', '00', '0', 'BACK', 'C'].map((key) => {
                  if (key === '500' || key === '1000' || key === '5000') {
                    return (
                      <button
                        key={key}
                        type="button"
                        className="numpad-key"
                        style={{ background: '#f0fdf4', color: '#166534', fontWeight: 800, fontSize: 13 }}
                        onClick={() => handleQuickTender(Number(key))}
                      >
                        +{key}
                      </button>
                    );
                  }
                  return (
                    <button
                      key={key}
                      type="button"
                      className={`numpad-key ${key === 'BACK' ? 'numpad-key--back' : ''}`}
                      onClick={() => handleNumpad(key)}
                    >
                      {key === 'BACK' ? '⌫' : key}
                    </button>
                  );
                })}
              </div>

              {/* Change to Return Display */}
              <div className="change-display">
                <span className="change-label">Change to Return:</span>
                <span className={`change-amount ${changeRupees > 0 ? 'change-amount--positive' : ''}`}>
                  Rs {changeRupees.toFixed(0)}
                </span>
              </div>
            </div>
          )}

          {/* Khata / Credit Details Section */}
          {isCredit && (
            <div className="credit-section">
              <div className="credit-badge-header">
                <span>📝 Customer Khata Details (Saved in Khata / Credit section)</span>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="takeaway-khata-name">
                  Customer Name <span className="text-danger">*</span>
                </label>
                <input
                  id="takeaway-khata-name"
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
                <label className="form-label" htmlFor="takeaway-khata-contact">
                  Contact / Phone Number (Optional)
                </label>
                <input
                  id="takeaway-khata-contact"
                  type="tel"
                  className="form-input"
                  placeholder="e.g. 0300-1234567..."
                  value={customerContact}
                  onChange={(e) => setCustomerContact(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Kitchen Token & Customer Slips Options */}
          <div className="takeaway-slips-section" style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0', marginTop: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
                🎫 Customer Kitchen Pickup Tokens & Bill
              </span>
              {(hasChai || hasParhata) && (
                <span style={{ fontSize: 11, background: '#dbeafe', color: '#1e40af', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
                  {hasChai && hasParhata ? 'Chai + Parhata' : hasChai ? 'Chai Token' : 'Parhata Token'}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(hasChai || hasParhata) && (
                <label className="checkbox-label" style={{ fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={printToken}
                    onChange={(e) => setPrintToken(e.target.checked)}
                  />
                  <span>🖨️ Print Kitchen Token (Give to customer to collect order)</span>
                </label>
              )}
              <label className="checkbox-label" style={{ fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={printBill}
                  onChange={(e) => setPrintBill(e.target.checked)}
                />
                <span>🧾 Print Customer Total Bill Slip</span>
              </label>
            </div>
          </div>

          {error && <div className="form-error" style={{ marginTop: 8 }}>{error}</div>}
        </div>

        {/* Modal Actions */}
        <div className="modal-actions" style={{ marginTop: 12 }}>
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            className="btn btn-success btn-large"
            onClick={handleCompleteSale}
            disabled={saving || isInsufficient || isCreditMissingName}
            style={{ minWidth: 200 }}
          >
            {saving
              ? 'Processing...'
              : isCredit
              ? `📝 Save to Khata · ${formatMoney(total)}`
              : `✅ Complete Sale · ${formatMoney(total)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
