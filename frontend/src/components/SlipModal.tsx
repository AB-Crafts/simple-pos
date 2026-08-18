import { useState } from 'react';
import type { Sale, SaleItem } from '../types';
import {
  formatChaiSlip,
  formatParhataSlip,
  printReceiptText,
  type DepartmentItem,
} from '../utils/slips';

interface Props {
  sale: Sale;
  items: SaleItem[] | DepartmentItem[];
  deltaItems?: DepartmentItem[];
  chaiItems?: DepartmentItem[];
  parhataItems?: DepartmentItem[];
  isSupplementary?: boolean;
  onClose: () => void;
}

export function SlipModal({
  sale,
  items,
  deltaItems = [],
  chaiItems = [],
  parhataItems = [],
  isSupplementary = false,
  onClose,
}: Props) {
  // If this is an add-on edit, strictly use only newly added items
  const sourceItems: (SaleItem | DepartmentItem)[] =
    isSupplementary && deltaItems.length > 0
      ? deltaItems
      : (items as (SaleItem | DepartmentItem)[]);

  const resolvedChaiItems: DepartmentItem[] =
    isSupplementary && chaiItems.length > 0
      ? chaiItems
      : sourceItems
          .filter((i) => i.department === 'CHAI')
          .map((i) => ({
            productId: (i as SaleItem).productId ?? (i as DepartmentItem).productId,
            productName: (i as SaleItem).productName ?? (i as DepartmentItem).productName,
            quantity: i.quantity,
            department: 'CHAI',
          }));

  const resolvedParhataItems: DepartmentItem[] =
    isSupplementary && parhataItems.length > 0
      ? parhataItems
      : sourceItems
          .filter((i) => i.department === 'PARHATA')
          .map((i) => ({
            productId: (i as SaleItem).productId ?? (i as DepartmentItem).productId,
            productName: (i as SaleItem).productName ?? (i as DepartmentItem).productName,
            quantity: i.quantity,
            department: 'PARHATA',
          }));

  const hasChai = resolvedChaiItems.length > 0;
  const hasParhata = resolvedParhataItems.length > 0;

  const [activeTab, setActiveTab] = useState<'chai' | 'parhata'>(
    hasChai ? 'chai' : 'parhata'
  );

  const chaiSlipText = hasChai ? formatChaiSlip(sale, resolvedChaiItems, isSupplementary) : '';
  const parhataSlipText = hasParhata ? formatParhataSlip(sale, resolvedParhataItems, isSupplementary) : '';

  function handlePrintChai() {
    if (chaiSlipText) {
      printReceiptText(`Chai-Slip-${sale.orderNumber}`, chaiSlipText);
    }
  }

  function handlePrintParhata() {
    if (parhataSlipText) {
      printReceiptText(`Parhata-Slip-${sale.orderNumber}`, parhataSlipText);
    }
  }

  function handlePrintBoth() {
    if (chaiSlipText && parhataSlipText) {
      const combined = `${chaiSlipText}\n\n--------------------------------\n        --- TEAR HERE ---\n--------------------------------\n\n${parhataSlipText}`;
      printReceiptText(`Kitchen-Slips-${sale.orderNumber}`, combined);
    } else if (chaiSlipText) {
      handlePrintChai();
    } else if (parhataSlipText) {
      handlePrintParhata();
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card slip-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 className="modal-title">
              {isSupplementary ? '⚡ Add-On Department Slips' : '📋 Department Kitchen Slips'}
            </h3>
            <span className="modal-subtitle">
              Order #{sale.orderNumber} · {sale.orderType === 'DINE_IN' ? `Waiter: ${sale.takenBy}` : `Takeaway (${sale.takenBy})`}
            </span>
          </div>
          <button className="btn-icon" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {isSupplementary && (
          <div className="slip-alert-banner">
            <strong>Add-On Slips:</strong> Only newly added items are included for each department.
          </div>
        )}

        {hasChai && hasParhata && (
          <div className="slip-tabs">
            <button
              className={`slip-tab ${activeTab === 'chai' ? 'slip-tab--active' : ''}`}
              onClick={() => setActiveTab('chai')}
            >
              ☕ Chai Slip ({resolvedChaiItems.reduce((acc, i) => acc + i.quantity, 0)})
            </button>
            <button
              className={`slip-tab ${activeTab === 'parhata' ? 'slip-tab--active' : ''}`}
              onClick={() => setActiveTab('parhata')}
            >
              🫓 Parhata Slip ({resolvedParhataItems.reduce((acc, i) => acc + i.quantity, 0)})
            </button>
          </div>
        )}

        <div className="slip-preview-container">
          {activeTab === 'chai' && hasChai && (
            <pre className="receipt-paper">{chaiSlipText}</pre>
          )}
          {activeTab === 'parhata' && hasParhata && (
            <pre className="receipt-paper">{parhataSlipText}</pre>
          )}
          {!hasChai && hasParhata && activeTab !== 'parhata' && (
            <pre className="receipt-paper">{parhataSlipText}</pre>
          )}
          {hasChai && !hasParhata && activeTab !== 'chai' && (
            <pre className="receipt-paper">{chaiSlipText}</pre>
          )}
        </div>

        <div className="slip-modal-actions">
          <div className="slip-modal-actions__left">
            {hasChai && hasParhata && (
              <button className="btn btn-primary btn-large" onClick={handlePrintBoth}>
                🖨️ Print Both Slips (Chai & Parhata)
              </button>
            )}
            {hasChai && (
              <button
                className={`btn ${!hasParhata ? 'btn-primary btn-large' : 'btn-secondary'}`}
                onClick={handlePrintChai}
              >
                Print Chai Slip
              </button>
            )}
            {hasParhata && (
              <button
                className={`btn ${!hasChai ? 'btn-primary btn-large' : 'btn-secondary'}`}
                onClick={handlePrintParhata}
              >
                Print Parhata Slip
              </button>
            )}
          </div>

          <div className="slip-modal-actions__right">
            <button className="btn btn-ghost" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
