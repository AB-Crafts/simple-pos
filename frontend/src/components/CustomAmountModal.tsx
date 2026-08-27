import { useEffect, useState } from 'react';
import type { Product, Paisa } from '../types';
import { formatMoney, toPaisa, toRupees } from '../utils/money';

interface Props {
  product: Product;
  initialUnitPrice?: Paisa;
  initialQuantity?: number;
  initialName?: string;
  onConfirm: (product: Product, unitPrice: Paisa, customName?: string, quantity?: number) => void;
  onClose: () => void;
}

const CHAI_PRESETS = [90, 100, 110, 120, 130, 140, 150];
const GENERAL_PRESETS = [100, 200, 500, 1000, 5000];

const MILK_WEIGHT_PRESETS = [
  { label: '0.25 kg (Paao)', weight: 0.25 },
  { label: '0.5 kg (½ kg)', weight: 0.5 },
  { label: '0.75 kg (¾ kg)', weight: 0.75 },
  { label: '1 kg', weight: 1.0 },
];

export function CustomAmountModal({
  product,
  initialUnitPrice,
  initialQuantity = 1,
  initialName,
  onConfirm,
  onClose,
}: Props) {
  const isKgProduct =
    product.unit === 'kg' ||
    product.name.toLowerCase().includes('milk');

  const isChai =
    product.name.toLowerCase().includes('karak') ||
    product.name.toLowerCase().includes('chai');

  const isOpenCustomItem =
    product.id.startsWith('custom-open-item') ||
    product.name.toLowerCase().includes('custom');

  const standardRateRupees = toRupees(product.sellingPrice) || (isChai ? 90 : 100);
  const defaultRupees =
    initialUnitPrice !== undefined
      ? toRupees(initialUnitPrice)
      : isKgProduct
      ? standardRateRupees
      : isChai
      ? 90
      : standardRateRupees;

  const [rupeesStr, setRupeesStr] = useState<string>(defaultRupees > 0 ? String(defaultRupees) : '');
  const [customItemName, setCustomItemName] = useState<string>(initialName || (isOpenCustomItem ? '' : product.name));
  const [quantity, setQuantity] = useState<number>(initialQuantity > 0 ? initialQuantity : 1);

  const currentRupees = parseFloat(rupeesStr) || 0;
  const currentTotalPaisa = toPaisa(currentRupees * quantity);

  // Compute estimated kg if it's a milk/kg product
  const calculatedKg = isKgProduct && standardRateRupees > 0
    ? (currentRupees / standardRateRupees)
    : 0;

  // Keyboard shortcut listener (Enter to submit, Esc to close)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter') {
        handleSubmit();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentRupees, quantity, customItemName]);

  function handlePresetClick(amount: number) {
    setRupeesStr(String(amount));
  }

  function handleWeightPresetClick(weight: number) {
    const calculatedAmount = Math.round(weight * standardRateRupees);
    setRupeesStr(String(calculatedAmount));
  }

  function handleNumpad(key: string) {
    if (key === 'C') {
      setRupeesStr('');
    } else if (key === 'BACK') {
      setRupeesStr((prev) => prev.slice(0, -1));
    } else if (key === '00') {
      if (!rupeesStr || rupeesStr === '0') return;
      setRupeesStr((prev) => prev + '00');
    } else {
      // Numbers
      if (rupeesStr === '0') {
        setRupeesStr(key);
      } else {
        setRupeesStr((prev) => prev + key);
      }
    }
  }

  function handleSubmit() {
    if (currentRupees <= 0) {
      alert('Please enter a valid amount greater than Rs. 0');
      return;
    }

    const unitPricePaisa = toPaisa(currentRupees);
    let finalName = customItemName.trim() || product.name;

    if (isKgProduct && calculatedKg > 0) {
      const formattedKg = calculatedKg % 1 === 0 ? calculatedKg.toFixed(0) : calculatedKg.toFixed(2);
      finalName = `${product.name} (${formattedKg} kg)`;
    } else if (!isOpenCustomItem && unitPricePaisa !== product.sellingPrice) {
      finalName = `${product.name} (Rs.${currentRupees})`;
    } else if (isOpenCustomItem && !customItemName.trim()) {
      finalName = `Custom Item (Rs.${currentRupees})`;
    }

    onConfirm(product, unitPricePaisa, finalName, quantity);
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card custom-amount-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="custom-modal-title"
      >
        <div className="modal-header">
          <div>
            <h3 id="custom-modal-title" className="modal-title">
              {isKgProduct ? '🥛' : isChai ? '☕' : '🏷️'} {isOpenCustomItem ? 'Add Custom Amount Item' : `Custom Amount: ${product.name}`}
            </h3>
            <span className="modal-subtitle">
              {isKgProduct
                ? `Standard Rate: ${formatMoney(product.sellingPrice)} / kg`
                : isChai
                ? `Standard Rate: ${formatMoney(product.sellingPrice)} / cup · Quick presets or enter custom amount`
                : `Enter custom rupee amount to add to bill`}
            </span>
          </div>
          <button className="btn-icon" onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </div>

        {/* Optional Custom Item Title/Description */}
        {isOpenCustomItem && (
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label className="form-label" style={{ fontSize: 13 }}>
              Item Name / Description (Optional):
            </label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Special Order, Catering, Extra Item..."
              value={customItemName}
              onChange={(e) => setCustomItemName(e.target.value)}
            />
          </div>
        )}

        {/* Big Amount Display / Input */}
        <div className="custom-amount-display-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className="custom-amount-label" htmlFor="custom-rupees-input">
              {isKgProduct ? 'Milk Amount (Rs.)' : isChai ? 'Chai Amount (Rs.)' : 'Custom Amount (Rs.)'}
            </label>
            {isKgProduct && calculatedKg > 0 && (
              <span className="custom-kg-badge">
                ⚖️ Approx {calculatedKg % 1 === 0 ? calculatedKg.toFixed(0) : calculatedKg.toFixed(2)} kg
              </span>
            )}
          </div>
          <div className="custom-amount-input-wrap">
            <span className="currency-symbol">Rs.</span>
            <input
              id="custom-rupees-input"
              type="number"
              min={1}
              step="1"
              className="custom-amount-input"
              value={rupeesStr}
              onChange={(e) => setRupeesStr(e.target.value)}
              placeholder="100"
              autoFocus
            />
          </div>
        </div>

        {/* Quick Presets for KG / Weight (Only up to 1 kg for Milk) */}
        {isKgProduct && (
          <div className="custom-presets-section">
            <span className="section-micro-label">⚖️ Quick Weight (KG) Presets:</span>
            <div className="custom-presets-grid">
              {MILK_WEIGHT_PRESETS.map((preset) => {
                const expectedPrice = Math.round(preset.weight * standardRateRupees);
                const isSelected = currentRupees === expectedPrice;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    className={`preset-btn ${isSelected ? 'preset-btn--active' : ''}`}
                    onClick={() => handleWeightPresetClick(preset.weight)}
                  >
                    {preset.label} (Rs.{expectedPrice})
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Quick Amount Presets (For Chai) */}
        {!isKgProduct && isChai && (
          <div className="custom-presets-section">
            <span className="section-micro-label">
              ⚡ Quick Rupee Presets:
            </span>
            <div className="custom-presets-grid">
              {CHAI_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={`preset-btn ${currentRupees === preset ? 'preset-btn--active' : ''}`}
                  onClick={() => handlePresetClick(preset)}
                >
                  Rs.{preset}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Quick Amount Presets (For General Custom Items: 100, 200, 500, 1000, 5000) */}
        {!isKgProduct && !isChai && (
          <div className="custom-presets-section">
            <span className="section-micro-label">
              ⚡ Quick Rupee Presets:
            </span>
            <div className="custom-presets-grid">
              {GENERAL_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={`preset-btn ${currentRupees === preset ? 'preset-btn--active' : ''}`}
                  onClick={() => handlePresetClick(preset)}
                >
                  Rs.{preset}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Touch Numpad & Controls */}
        <div className="custom-modal-middle-grid">
          {/* Touch Numpad */}
          <div className="touch-numpad">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', 'BACK'].map((key) => (
              <button
                key={key}
                type="button"
                className={`numpad-key ${key === 'BACK' ? 'numpad-key--back' : ''}`}
                onClick={() => handleNumpad(key)}
              >
                {key === 'BACK' ? '⌫' : key}
              </button>
            ))}
          </div>

          {/* Quantity & Summary Box */}
          <div className="custom-controls-side">
            <div className="custom-qty-control">
              <label className="section-micro-label">
                Quantity {isKgProduct ? '(Pots / Bags)' : '(Qty)'}:
              </label>
              <div className="qty-picker">
                <button
                  type="button"
                  className="qty-btn"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                >
                  −
                </button>
                <span className="qty-val">{quantity}</span>
                <button
                  type="button"
                  className="qty-btn"
                  onClick={() => setQuantity((q) => q + 1)}
                >
                  +
                </button>
              </div>
            </div>

            <div className="custom-total-box">
              <span className="custom-total-label">Total to Bill:</span>
              <span className="custom-total-amount">
                {currentRupees > 0 ? formatMoney(currentTotalPaisa) : 'Rs.0'}
              </span>
              {quantity > 1 && currentRupees > 0 && (
                <span className="custom-total-breakdown">
                  ({quantity} × Rs.{currentRupees})
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Modal Action Buttons */}
        <div className="modal-actions custom-modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary btn-large btn-add-custom-order"
            onClick={handleSubmit}
            disabled={currentRupees <= 0}
          >
            {isKgProduct ? '🥛' : isChai ? '☕' : '🏷️'} Add to Order — {currentRupees > 0 ? formatMoney(currentTotalPaisa) : 'Rs.0'}
          </button>
        </div>
      </div>
    </div>
  );
}

