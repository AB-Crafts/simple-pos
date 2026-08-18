import type { Product } from '../types';
import { formatMoney } from '../utils/money';

interface Props {
  product: Product;
  onClick: (product: Product) => void;
}

export function ProductButton({ product, onClick }: Props) {
  const lowStock = product.stock <= 5;
  const outOfStock = product.stock <= 0;

  return (
    <button
      className="product-btn"
      onClick={() => onClick(product)}
      disabled={outOfStock}
      aria-label={`Add ${product.name}, ${formatMoney(product.sellingPrice)}`}
    >
      <span className="product-btn__name">{product.name}</span>
      <span className="product-btn__price">{formatMoney(product.sellingPrice)}</span>
      {outOfStock && <span className="product-btn__badge product-btn__badge--out">OUT OF STOCK</span>}
      {!outOfStock && lowStock && (
        <span className="product-btn__badge product-btn__badge--low">LOW STOCK</span>
      )}
    </button>
  );
}
