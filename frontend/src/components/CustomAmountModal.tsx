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

const CHAI_PRESETS = [30, 40, 50, 60, 70, 80, 100, 120, 150, 200, 250, 300, 500];

const MILK_WEIGHT_PRESETS = [
  { label: '0.25 kg (Paao)', weight: 0.25 },
  { label: '0.5 kg (½ kg)', weight: 0.5 },
  { label: '0.75 kg (¾ kg)', weight: 0.75 },
  { label: '1 kg', weight: 1.0 },
  { label: '1.5 kg', weight: 1.5 },
  { label: '2 kg', weight: 2.0 },
  { label: '2.5 kg', weight: 2.5 },
  { label: '3 kg', weight: 3.0 },
  { label: '5 kg', weight: 5.0 },
];

const MILK_RUPEE_PRESETS = [50, 80, 100, 150, 200, 250, 300, 400, 500, 1000];

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

  const standardRateRupees = toRupees(product.sellingPrice) || 200;
  const defaultRupees = initialUnitPrice !== undefined ? toRupees(initialUnitPrice) : standardRateRupees;
  const [rupeesStr, setRupeesStr] = useState<string>(defaultRupees > 0 ? String(defaultRupees) : '');
  const [quantity, setQuantity] = useState<number>(initialQuantity > 0 ? initialQuantity : 1);

  const defaultNote = (() => {
    if (!initialName) return '';
    const match = initialName.match(/\((.*?)\)/);
    if (match) {
      if (/^Rs\.\d+/i.test(match[1])) return '';
      return match[1];
    }
    return initialName !== product.name ? initialName : '';
  })();
  const [customNote, setCustomNote] = useState<string>(defaultNote);

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
  }, [currentRupees, quantity, customNote]);

  function handlePresetClick(amount: number) {
    setRupeesStr(String(amount));
    if (isKgProduct) {
      const kg = amount / standardRateRupees;
      const formattedKg = kg % 1 === 0 ? kg.toFixed(0) : kg.toFixed(2);
      setCustomNote(`${formattedKg} kg`);
    }
  }

  function handleWeightPresetClick(weight: number) {
    const calculatedAmount = Math.round(weight * standardRateRupees);
    setRupeesStr(String(calculatedAmount));
    const formattedKg = weight % 1 === 0 ? weight.toFixed(0) : String(weight);
    setCustomNote(`${formattedKg} kg`);
  }

  function handleNumpad(key: string) {
    if (key === 'C') {
      setRupeesStr('');
      setCustomNote('');
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
      alert('Please enter a valid amount greater than 0');
      return;
    }

    const unitPricePaisa = toPaisa(currentRupees);
    let finalName = product.name;

    if (customNote.trim()) {
      finalName = `${product.name} (${customNote.trim()})`;
    } else if (isKgProduct && calculatedKg > 0) {
      const formattedKg = calculatedKg % 1 === 0 ? calculatedKg.toFixed(0) : calculatedKg.toFixed(2);
      finalName = `${product.name} (${formattedKg} kg - Rs.${currentRupees})`;
    } else if (unitPricePaisa !== product.sellingPrice) {
      finalName = `${product.name} (Rs.${currentRupees})`;
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
              {isKgProduct ? '🥛' : '☕'} Custom Amount: {product.name}
            </h3>
            <span className="modal-subtitle">
              Standard Rate: {formatMoney(product.sellingPrice)} {isKgProduct ? '/ kg' : '/ cup'}
            </span>
          </div>
          <button className="btn-icon" onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </div>

        {/* Big Amount Display / Input */}
        <div className="custom-amount-display-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className="custom-amount-label" htmlFor="custom-rupees-input">
              {isKgProduct ? 'Milk Amount (Rs.)' : 'Chai Amount (Rs.)'}
            </label>
            {isKgProduct && calculatedKg > 0 && (
              <span className="custom-kg-badge">
                ⚖️ Approx {calculatedKg.toFixed(2)} kg
              </span>
            )}
          </div>
          <div className="custom-amount-input-wrap">
            <span className="currency-symbol">Rs.</span>
            <input
              id="custom-rupees-input"
              type="number"
              min="1"
              step="1"
              className="custom-amount-input"
              value={rupeesStr}
              onChange={(e) => setRupeesStr(e.target.value)}
              placeholder="0"
              autoFocus
            />
          </div>
        </div>

        {/* Quick Presets for KG / Weight (if Milk or KG product) */}
        {isKgProduct && (
          <div className="custom-presets-section">
            <span className="section-micro-label">⚖️ Quick Weight (KG) Presets:</span>
            <div className="custom-presets-grid">
              {MILK_WEIGHT_PRESETS.map((preset) => {
                const expectedPrice = Math.round(preset.weight * standardRateRupees);
                const isSelected = currentRupees === expectedPrice || customNote.includes(`${preset.weight} kg`);
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

        {/* Quick Amount Presets */}
        <div className="custom-presets-section">
          <span className="section-micro-label">
            ⚡ Quick Rupee Presets:
          </span>
          <div className="custom-presets-grid">
            {(isKgProduct ? MILK_RUPEE_PRESETS : CHAI_PRESETS).map((preset) => (
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
                Quantity {isKgProduct ? '(Pots / Bags)' : '(Cups / Pots)'}:
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

            <div className="custom-note-field">
              <label className="section-micro-label" htmlFor="custom-note-input">
                Tag / Note / Weight:
              </label>
              <input
                id="custom-note-input"
                type="text"
                className="form-input form-input-sm"
                placeholder={isKgProduct ? 'e.g. 1 kg, 0.5 kg, Parcel...' : 'e.g. Parcel, Half Cup, Pot...'}
                value={customNote}
                onChange={(e) => setCustomNote(e.target.value)}
              />
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
            {isKgProduct ? '🥛' : '☕'} Add to Order — {currentRupees > 0 ? formatMoney(currentTotalPaisa) : 'Rs.0'}
          </button>
        </div>
      </div>
    </div>
  );
}

