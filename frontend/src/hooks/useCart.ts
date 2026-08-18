import { useMemo, useState } from 'react';
import type { CartLine, Product } from '../types';
import { sumPaisa } from '../utils/money';

export function useCart() {
  const [lines, setLines] = useState<CartLine[]>([]);

  function addProduct(product: Product) {
    setLines((prev) => {
      const existing = prev.find((l) => l.productId === product.id);
      if (existing) {
        return prev.map((l) =>
          l.productId === product.id ? { ...l, quantity: l.quantity + 1 } : l
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          department: product.department,
          unitPrice: product.sellingPrice,
          quantity: 1,
        },
      ];
    });
  }

  function increment(productId: string) {
    setLines((prev) =>
      prev.map((l) => (l.productId === productId ? { ...l, quantity: l.quantity + 1 } : l))
    );
  }

  function decrement(productId: string) {
    setLines((prev) =>
      prev
        .map((l) => (l.productId === productId ? { ...l, quantity: l.quantity - 1 } : l))
        .filter((l) => l.quantity > 0)
    );
  }

  function removeLine(productId: string) {
    setLines((prev) => prev.filter((l) => l.productId !== productId));
  }

  function loadCart(newLines: CartLine[]) {
    setLines(newLines);
  }

  function clear() {
    setLines([]);
  }

  const total = useMemo(() => sumPaisa(lines.map((l) => l.unitPrice * l.quantity)), [lines]);

  return { lines, addProduct, increment, decrement, removeLine, loadCart, clear, total };
}
