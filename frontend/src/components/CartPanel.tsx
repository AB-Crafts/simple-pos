import type { CartLine } from '../types';
import { formatMoney } from '../utils/money';

interface Props {
  lines: CartLine[];
  total: number;
  onIncrement: (lineKey: string) => void;
  onDecrement: (lineKey: string) => void;
  onRemove: (lineKey: string) => void;
  onEditPrice?: (line: CartLine) => void;
  onClear: () => void;
}

export function CartPanel({
  lines,
  total,
  onIncrement,
  onDecrement,
  onRemove,
  onEditPrice,
  onClear,
}: Props) {
  return (
    <div className="cart-panel">
      <div className="cart-panel__header">
        <h2>Current Bill</h2>
        {lines.length > 0 && (
          <button className="link-btn" onClick={onClear}>
            Clear
          </button>
        )}
      </div>

      <div className="cart-panel__lines">
        {lines.length === 0 && <p className="empty-hint">Tap a product to start a sale.</p>}
        {lines.map((line) => {
          const lineKey = line.id || line.productId;
          return (
            <div key={lineKey} className="cart-line">
              <div className="cart-line__info">
                <span className="cart-line__name">{line.name}</span>
                <span className="cart-line__unit">
                  {line.quantity} × {formatMoney(line.unitPrice)}
                  {onEditPrice && (line.isCustomPrice || line.name.toLowerCase().includes('karak')) && (
                    <button
                      type="button"
                      className="cart-line__edit-btn"
                      onClick={() => onEditPrice(line)}
                      title="Edit amount / price for Karak Chai"
                      aria-label={`Edit price for ${line.name}`}
                    >
                      ✏️
                    </button>
                  )}
                </span>
              </div>
              <div className="cart-line__controls">
                <button
                  aria-label={`Decrease ${line.name}`}
                  onClick={() => onDecrement(lineKey)}
                >
                  −
                </button>
                <span className="cart-line__qty">{line.quantity}</span>
                <button
                  aria-label={`Increase ${line.name}`}
                  onClick={() => onIncrement(lineKey)}
                >
                  +
                </button>
                <button
                  aria-label={`Remove ${line.name}`}
                  className="cart-line__remove"
                  onClick={() => onRemove(lineKey)}
                >
                  ✕
                </button>
              </div>
              <span className="cart-line__total">
                {formatMoney(line.unitPrice * line.quantity)}
              </span>
            </div>
          );
        })}
      </div>

      <div className="cart-panel__total">
        <span>TOTAL</span>
        <span>{formatMoney(total)}</span>
      </div>
    </div>
  );
}

