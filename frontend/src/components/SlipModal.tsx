import { useState } from 'react';
import type { Sale, SaleItem } from '../types';
import {
  formatChaiSlip,
  formatParhataSlip,
  printReceiptText,
  printMultipleSlips,
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

  const [viewMode, setViewMode] = useState<'both' | 'chai' | 'parhata'>('both');

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

  function handlePrintBothAtOnce() {
    const slipsToPrint: string[] = [];
    if (chaiSlipText) slipsToPrint.push(chaiSlipText);
    if (parhataSlipText) slipsToPrint.push(parhataSlipText);

    if (slipsToPrint.length > 0) {
      printMultipleSlips(`Kitchen-Slips-${sale.orderNumber}`, slipsToPrint);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card slip-modal" style={{ maxWidth: hasChai && hasParhata ? '720px' : '420px' }} onClick={(e) => e.stopPropagation()}>
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
              className={`slip-tab ${viewMode === 'both' ? 'slip-tab--active' : ''}`}
              onClick={() => setViewMode('both')}
            >
              📄 Both Slips
            </button>
            <button
              className={`slip-tab ${viewMode === 'chai' ? 'slip-tab--active' : ''}`}
              onClick={() => setViewMode('chai')}
            >
              ☕ Chai Slip ({resolvedChaiItems.reduce((acc, i) => acc + i.quantity, 0)})
            </button>
            <button
              className={`slip-tab ${viewMode === 'parhata' ? 'slip-tab--active' : ''}`}
              onClick={() => setViewMode('parhata')}
            >
              🫓 Parhata Slip ({resolvedParhataItems.reduce((acc, i) => acc + i.quantity, 0)})
            </button>
          </div>
        )}

        <div className="slip-preview-container" style={{ gap: '16px', flexWrap: 'wrap' }}>
          {(viewMode === 'both' || viewMode === 'chai') && hasChai && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ color: '#fff', fontSize: '12px', fontWeight: 'bold', marginBottom: '6px' }}>
                ☕ SLIP 1: CHAI DEPARTMENT
              </div>
              <pre className="receipt-paper">{chaiSlipText}</pre>
            </div>
          )}

          {(viewMode === 'both' || viewMode === 'parhata') && hasParhata && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ color: '#fff', fontSize: '12px', fontWeight: 'bold', marginBottom: '6px' }}>
                🫓 SLIP 2: PARHATA DEPARTMENT
              </div>
              <pre className="receipt-paper">{parhataSlipText}</pre>
            </div>
          )}
        </div>

        <div className="slip-modal-actions">
          <div className="slip-modal-actions__left">
            {hasChai && hasParhata ? (
              <>
                <button className="btn btn-primary btn-large" onClick={handlePrintBothAtOnce}>
                  🖨️ Print 2 Slips at Once (Chai & Parhata)
                </button>
                <button className="btn btn-secondary" onClick={handlePrintChai}>
                  Print Chai Only
                </button>
                <button className="btn btn-secondary" onClick={handlePrintParhata}>
                  Print Parhata Only
                </button>
              </>
            ) : hasChai ? (
              <button className="btn btn-primary btn-large" onClick={handlePrintChai}>
                🖨️ Print Chai Slip
              </button>
            ) : hasParhata ? (
              <button className="btn btn-primary btn-large" onClick={handlePrintParhata}>
                🖨️ Print Parhata Slip
              </button>
            ) : (
              <p style={{ margin: 0, color: 'var(--ink-soft)' }}>No departmental items to print.</p>
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
