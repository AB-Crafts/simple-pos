import type { CartLine } from '../types';
import { formatMoney } from '../utils/money';

interface Props {
  lines: CartLine[];
  total: number;
  onIncrement: (productId: string) => void;
  onDecrement: (productId: string) => void;
  onRemove: (productId: string) => void;
  onClear: () => void;
}

export function CartPanel({ lines, total, onIncrement, onDecrement, onRemove, onClear }: Props) {
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
        {lines.map((line) => (
          <div key={line.productId} className="cart-line">
            <div className="cart-line__info">
              <span className="cart-line__name">{line.name}</span>
              <span className="cart-line__unit">
                {line.quantity} × {formatMoney(line.unitPrice)}
              </span>
            </div>
            <div className="cart-line__controls">
              <button aria-label={`Decrease ${line.name}`} onClick={() => onDecrement(line.productId)}>
                −
              </button>
              <span className="cart-line__qty">{line.quantity}</span>
              <button aria-label={`Increase ${line.name}`} onClick={() => onIncrement(line.productId)}>
                +
              </button>
              <button
                aria-label={`Remove ${line.name}`}
                className="cart-line__remove"
                onClick={() => onRemove(line.productId)}
              >
                ✕
              </button>
            </div>
            <span className="cart-line__total">{formatMoney(line.unitPrice * line.quantity)}</span>
          </div>
        ))}
      </div>

      <div className="cart-panel__total">
        <span>TOTAL</span>
        <span>{formatMoney(total)}</span>
      </div>
    </div>
  );
}
