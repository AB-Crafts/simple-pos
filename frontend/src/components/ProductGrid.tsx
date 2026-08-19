import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../database/db';
import type { Product } from '../types';
import { ProductButton } from './ProductButton';

interface Props {
  onAddProduct: (product: Product) => void;
}

export function ProductGrid({ onAddProduct }: Props) {
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<string | 'all'>('all');

  const allProducts = useLiveQuery(() => db.products.toArray(), []);
  const categories = useLiveQuery(() => db.categories.toArray(), []);
  const saleItems = useLiveQuery(() => db.saleItems.toArray(), []);

  // Compute product sales frequencies
  const salesCountByProduct = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of saleItems ?? []) {
      if (item.productId) {
        counts[item.productId] = (counts[item.productId] || 0) + (item.quantity || 1);
      }
    }
    return counts;
  }, [saleItems]);

  // Filter active products by category and search
  const filteredProducts = useMemo(() => {
    const source = (allProducts ?? []).filter((p) => p.active);
    return source.filter((p) => {
      const matchesCategory = categoryId === 'all' || p.categoryId === categoryId;
      const matchesSearch = p.name.toLowerCase().includes(search.trim().toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [allProducts, categoryId, search]);

  // Partition into Frequently Sold / Popular items vs Other items
  const { popularProducts, otherProducts } = useMemo(() => {
    const activeList = filteredProducts;

    // Helper to check default priority items: chai, lacha parhata, milk
    function isDefaultPriority(p: Product): boolean {
      const name = p.name.toLowerCase();
      return (
        name.includes('chai') ||
        name.includes('lacha') ||
        name.includes('milk') ||
        name.includes('doodh')
      );
    }

    // Sort by:
    // 1. Sales count in database (if > 0)
    // 2. Default priority keywords (chai, lacha parhata, milk)
    // 3. Name alphabetical
    const sorted = [...activeList].sort((a, b) => {
      const countA = salesCountByProduct[a.id] || 0;
      const countB = salesCountByProduct[b.id] || 0;

      if (countA !== countB && (countA > 0 || countB > 0)) {
        return countB - countA;
      }

      const prioA = isDefaultPriority(a) ? 1 : 0;
      const prioB = isDefaultPriority(b) ? 1 : 0;
      if (prioA !== prioB) {
        return prioB - prioA;
      }

      return a.name.localeCompare(b.name);
    });

    // When actively searching, display as a single unified list
    if (search.trim().length > 0) {
      return { popularProducts: [], otherProducts: sorted };
    }

    // Top 3 to 6 items as popular
    const popular: Product[] = [];
    const others: Product[] = [];

    for (const p of sorted) {
      const hasSales = (salesCountByProduct[p.id] || 0) > 0;
      const isDefault = isDefaultPriority(p);

      if ((hasSales || isDefault) && popular.length < 6) {
        popular.push(p);
      } else {
        others.push(p);
      }
    }

    return { popularProducts: popular, otherProducts: others };
  }, [filteredProducts, salesCountByProduct, search]);

  return (
    <div className="product-panel">
      {/* Search & Category Filter Toolbar */}
      <div className="product-panel__toolbar">
        <input
          type="text"
          placeholder="Search product..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
        />
        <div className="category-tabs">
          <button
            className={`category-tab ${categoryId === 'all' ? 'category-tab--active' : ''}`}
            onClick={() => setCategoryId('all')}
          >
            All
          </button>
          {(categories ?? []).map((c) => (
            <button
              key={c.id}
              className={`category-tab ${categoryId === c.id ? 'category-tab--active' : ''}`}
              onClick={() => setCategoryId(c.id)}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <div className="product-scroll-area">
        {/* ⭐ Frequently Sold / Popular Items Section */}
        {popularProducts.length > 0 && (
          <div className="popular-products-section">
            <div className="popular-products-header">
              <div className="popular-title-wrap">
                <span className="popular-icon">⭐</span>
                <span className="popular-products-title">Frequently Sold (Quick Order)</span>
              </div>
              <span className="popular-products-badge">Top Sellers</span>
            </div>

            <div className="product-grid product-grid--popular">
              {popularProducts.map((p) => (
                <ProductButton key={p.id} product={p} onClick={onAddProduct} />
              ))}
            </div>

            {/* Separating Divider */}
            {otherProducts.length > 0 && (
              <div className="product-grid-divider">
                <span className="product-grid-divider__label">All Menu Items</span>
              </div>
            )}
          </div>
        )}

        {/* Remaining / All Products Grid */}
        <div className="product-grid">
          {otherProducts.map((p) => (
            <ProductButton key={p.id} product={p} onClick={onAddProduct} />
          ))}
        </div>

        {popularProducts.length === 0 && otherProducts.length === 0 && (
          <p className="empty-hint">No products match your search or filter.</p>
        )}
      </div>
    </div>
  );
}
