import { useMemo, useState } from 'react';
import type { CartLine, Paisa, Product } from '../types';
import { generateId } from '../utils/id';
import { formatMoney, sumPaisa } from '../utils/money';

export function useCart() {
  const [lines, setLines] = useState<CartLine[]>([]);

  function addProduct(
    product: Product,
    customUnitPrice?: Paisa,
    customName?: string,
    quantity = 1
  ) {
    const isCustom = customUnitPrice !== undefined && customUnitPrice !== product.sellingPrice;
    const price = customUnitPrice !== undefined ? customUnitPrice : product.sellingPrice;
    const name =
      customName ||
      (isCustom ? `${product.name} (${formatMoney(price)})` : product.name);

    setLines((prev) => {
      // Find matching line by productId, unitPrice, and name
      const existingIdx = prev.findIndex(
        (l) => l.productId === product.id && l.unitPrice === price && l.name === name
      );

      if (existingIdx >= 0) {
        return prev.map((l, idx) =>
          idx === existingIdx ? { ...l, quantity: l.quantity + quantity } : l
        );
      }

      return [
        ...prev,
        {
          id: generateId(),
          productId: product.id,
          name,
          department: product.department,
          unitPrice: price,
          quantity,
          isCustomPrice: isCustom,
        },
      ];
    });
  }

  function increment(lineKey: string) {
    setLines((prev) =>
      prev.map((l) =>
        (l.id === lineKey || l.productId === lineKey)
          ? { ...l, quantity: l.quantity + 1 }
          : l
      )
    );
  }

  function decrement(lineKey: string) {
    setLines((prev) =>
      prev
        .map((l) =>
          (l.id === lineKey || l.productId === lineKey)
            ? { ...l, quantity: l.quantity - 1 }
            : l
        )
        .filter((l) => l.quantity > 0)
    );
  }

  function removeLine(lineKey: string) {
    setLines((prev) =>
      prev.filter((l) => (l.id ? l.id !== lineKey : l.productId !== lineKey))
    );
  }

  function updateLinePrice(lineKey: string, newUnitPrice: Paisa, newName?: string) {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id === lineKey || l.productId === lineKey) {
          return {
            ...l,
            unitPrice: newUnitPrice,
            name: newName || l.name,
            isCustomPrice: true,
          };
        }
        return l;
      })
    );
  }

  function loadCart(newLines: CartLine[]) {
    setLines(
      newLines.map((l) => ({
        ...l,
        id: l.id || generateId(),
      }))
    );
  }

  function clear() {
    setLines([]);
  }

  const total = useMemo(() => sumPaisa(lines.map((l) => l.unitPrice * l.quantity)), [lines]);

  return {
    lines,
    addProduct,
    increment,
    decrement,
    removeLine,
    updateLinePrice,
    loadCart,
    clear,
    total,
  };
}

