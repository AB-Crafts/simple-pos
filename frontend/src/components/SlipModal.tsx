import type { Sale, SaleItem } from '../types';
import { formatKitchenSlip, printReceiptText, type DepartmentItem } from '../utils/slips';

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
  isSupplementary = false,
  onClose,
}: Props) {
  // If this is an add-on edit, strictly print only the newly added items
  const sourceItems = isSupplementary && deltaItems.length > 0 ? deltaItems : items;

  const departmentItems: DepartmentItem[] = (sourceItems as (SaleItem | DepartmentItem)[]).map((i) => ({
    productId: (i as SaleItem).productId ?? (i as DepartmentItem).productId,
    productName: (i as SaleItem).productName ?? (i as DepartmentItem).productName,
    quantity: i.quantity,
    department: i.department,
  }));

  const slipText = formatKitchenSlip(sale, departmentItems, isSupplementary);

  function handlePrintKitchenSlip() {
    if (slipText) {
      printReceiptText(`Kitchen-Token-${sale.orderNumber}`, slipText);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card slip-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 className="modal-title">
              {isSupplementary ? '⚡ Add-On Kitchen Slip' : '📋 Kitchen Slip (Token)'}
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
            <strong>Add-On Token:</strong> Only newly added items are included for kitchen preparation.
          </div>
        )}

        <div className="slip-preview-container">
          <pre className="receipt-paper">{slipText}</pre>
        </div>

        <div className="slip-modal-actions">
          <div className="slip-modal-actions__left">
            <button className="btn btn-primary btn-large" onClick={handlePrintKitchenSlip}>
              🖨️ Print Kitchen Slip
            </button>
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
