import type { Product } from '../types';
import { formatMoney } from '../utils/money';

interface Props {
  product: Product;
  onClick: (product: Product) => void;
  onCustomAmount?: (product: Product) => void;
}

export function ProductButton({ product, onClick, onCustomAmount }: Props) {
  const lowStock = product.stock <= 5;
  const outOfStock = product.stock <= 0;

  const isKarakChai =
    product.name.toLowerCase().includes('karak');

  return (
    <div
      className={`product-btn ${outOfStock ? 'product-btn--disabled' : ''}`}
      onClick={() => !outOfStock && onClick(product)}
      role="button"
      tabIndex={outOfStock ? -1 : 0}
      onKeyDown={(e) => {
        if (!outOfStock && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick(product);
        }
      }}
      aria-label={`Add ${product.name}, ${formatMoney(product.sellingPrice)}`}
    >
      <span className="product-btn__name">{product.name}</span>
      <div className="product-btn__bottom-row">
        <span className="product-btn__price">{formatMoney(product.sellingPrice)}</span>
        {!outOfStock && isKarakChai && onCustomAmount && (
          <button
            type="button"
            className="product-btn__custom-action"
            onClick={(e) => {
              e.stopPropagation();
              onCustomAmount(product);
            }}
            title="Set custom amount for Karak Chai"
            aria-label="Set custom amount for Karak Chai"
          >
            ✏️ Custom
          </button>
        )}
      </div>

      {outOfStock && <span className="product-btn__badge product-btn__badge--out">OUT OF STOCK</span>}
      {!outOfStock && lowStock && (
        <span className="product-btn__badge product-btn__badge--low">LOW STOCK</span>
      )}
    </div>
  );
}

