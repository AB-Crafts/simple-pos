import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../database/db';
import type { Department, Product } from '../types';
import { ProductButton } from './ProductButton';

interface Props {
  onAddProduct: (product: Product) => void;
  onCustomAmount?: (product: Product) => void;
}

const DEPARTMENT_ORDER: Record<Department, number> = {
  CHAI: 1,
  PARHATA: 2,
  GENERAL: 3,
};

const CHAI_ITEM_PRIORITY = [
  'karak chai',
  'doodh patti',
  'fresh milk',
  'elaichi chai',
  'kashmiri chai',
  'green tea / qahwa',
  'green tea',
  'qahwa',
  'chai',
];

const PARHATA_ITEM_PRIORITY = [
  'lacha parhata',
  'sada parhata',
  'aloo parhata',
  'anda parhata',
  'cheese parhata',
  'keema parhata',
  'meetha parhata',
];

function getProductDepartment(p: Product): Department {
  if (p.department === 'CHAI' || p.department === 'PARHATA' || p.department === 'GENERAL') {
    return p.department;
  }
  const name = p.name.toLowerCase();
  if (
    name.includes('chai') ||
    name.includes('tea') ||
    name.includes('doodh') ||
    name.includes('milk') ||
    name.includes('qahwa') ||
    name.includes('kahwa') ||
    name.includes('elaichi')
  ) {
    return 'CHAI';
  }
  if (
    name.includes('parhata') ||
    name.includes('paratha') ||
    name.includes('lacha') ||
    name.includes('roti')
  ) {
    return 'PARHATA';
  }
  return 'GENERAL';
}

export function ProductGrid({ onAddProduct, onCustomAmount }: Props) {
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

  // Memoized unique categories (no duplicates, ordered Chai -> Parhata -> Cold Drinks -> Snacks & Extras)
  const uniqueCategories = useMemo(() => {
    if (!categories) return [];
    const map = new Map<string, (typeof categories)[0]>();
    for (const c of categories) {
      const norm = c.name.trim().toLowerCase();
      if (!map.has(norm)) {
        map.set(norm, c);
      }
    }
    const PRIORITY: Record<string, number> = {
      chai: 1,
      parhata: 2,
      'cold drinks': 3,
      'snacks & extras': 4,
    };
    return Array.from(map.values()).sort((a, b) => {
      const pA = PRIORITY[a.name.trim().toLowerCase()] ?? 99;
      const pB = PRIORITY[b.name.trim().toLowerCase()] ?? 99;
      if (pA !== pB) return pA - pB;
      return a.name.localeCompare(b.name);
    });
  }, [categories]);

  // 1. Deduplicate active products in memory by normalized name
  const uniqueActiveProducts = useMemo(() => {
    const seen = new Set<string>();
    const list: Product[] = [];
    for (const p of allProducts ?? []) {
      if (!p.active) continue;
      const norm = p.name.trim().toLowerCase();
      if (!seen.has(norm)) {
        seen.add(norm);
        list.push(p);
      }
    }
    return list;
  }, [allProducts]);

  // 2. Filter products by category tab and search
  const filteredProducts = useMemo(() => {
    return uniqueActiveProducts.filter((p) => {
      let matchesCategory = categoryId === 'all';
      if (!matchesCategory) {
        const selectedCat = uniqueCategories.find((c) => c.id === categoryId);
        if (selectedCat) {
          const productCat = categories?.find((c) => c.id === p.categoryId);
          matchesCategory =
            p.categoryId === categoryId ||
            (productCat?.name.trim().toLowerCase() === selectedCat.name.trim().toLowerCase());
        } else {
          matchesCategory = p.categoryId === categoryId;
        }
      }
      const matchesSearch = p.name.toLowerCase().includes(search.trim().toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [uniqueActiveProducts, categoryId, search, uniqueCategories, categories]);

  // 3. Sort products strictly by category: Chai -> Parhata -> General
  const sortedProducts = useMemo(() => {
    return [...filteredProducts].sort((a, b) => {
      const deptA = getProductDepartment(a);
      const deptB = getProductDepartment(b);
      if (DEPARTMENT_ORDER[deptA] !== DEPARTMENT_ORDER[deptB]) {
        return DEPARTMENT_ORDER[deptA] - DEPARTMENT_ORDER[deptB];
      }

      // Inside same department: check custom priority list or sales count
      const nameA = a.name.toLowerCase().trim();
      const nameB = b.name.toLowerCase().trim();

      if (deptA === 'CHAI') {
        const idxA = CHAI_ITEM_PRIORITY.findIndex((k) => nameA.includes(k));
        const idxB = CHAI_ITEM_PRIORITY.findIndex((k) => nameB.includes(k));
        if (idxA !== -1 && idxB !== -1 && idxA !== idxB) return idxA - idxB;
        if (idxA !== -1 && idxB === -1) return -1;
        if (idxA === -1 && idxB !== -1) return 1;
      } else if (deptA === 'PARHATA') {
        const idxA = PARHATA_ITEM_PRIORITY.findIndex((k) => nameA.includes(k));
        const idxB = PARHATA_ITEM_PRIORITY.findIndex((k) => nameB.includes(k));
        if (idxA !== -1 && idxB !== -1 && idxA !== idxB) return idxA - idxB;
        if (idxA !== -1 && idxB === -1) return -1;
        if (idxA === -1 && idxB !== -1) return 1;
      }

      const countA = salesCountByProduct[a.id] || 0;
      const countB = salesCountByProduct[b.id] || 0;
      if (countA !== countB && (countA > 0 || countB > 0)) {
        return countB - countA;
      }

      return a.name.localeCompare(b.name);
    });
  }, [filteredProducts, salesCountByProduct]);

  // 4. Popular products for Quick Order top bar
  const popularProducts = useMemo(() => {
    if (search.trim().length > 0 || categoryId !== 'all') {
      return [];
    }

    const popularCandidates = [...uniqueActiveProducts].sort((a, b) => {
      const countA = salesCountByProduct[a.id] || 0;
      const countB = salesCountByProduct[b.id] || 0;
      if (countA !== countB && (countA > 0 || countB > 0)) {
        return countB - countA;
      }
      const isPriority = (p: Product) => {
        const n = p.name.toLowerCase();
        return (
          n.includes('karak') ||
          n.includes('doodh') ||
          n.includes('lacha') ||
          n.includes('cheese parhata') ||
          n.includes('coke') ||
          n.includes('aloo')
        );
      };
      const pA = isPriority(a) ? 1 : 0;
      const pB = isPriority(b) ? 1 : 0;
      if (pA !== pB) return pB - pA;
      return a.name.localeCompare(b.name);
    });

    return popularCandidates.slice(0, 6);
  }, [uniqueActiveProducts, salesCountByProduct, search, categoryId]);

  // Group sorted products by department for clear aligned sections
  const chaiProducts = useMemo(
    () => sortedProducts.filter((p) => getProductDepartment(p) === 'CHAI'),
    [sortedProducts]
  );
  const parhataProducts = useMemo(
    () => sortedProducts.filter((p) => getProductDepartment(p) === 'PARHATA'),
    [sortedProducts]
  );
  const generalProducts = useMemo(
    () => sortedProducts.filter((p) => getProductDepartment(p) === 'GENERAL'),
    [sortedProducts]
  );

  const isCategorizedView = categoryId === 'all' && !search.trim();

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
          {uniqueCategories.map((c) => (
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
        {/* ⭐ Frequently Sold / Quick Order Items Section */}
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
                <ProductButton
                  key={p.id}
                  product={p}
                  onClick={onAddProduct}
                  onCustomAmount={onCustomAmount}
                />
              ))}
            </div>

            {/* Separating Divider */}
            <div className="product-grid-divider">
              <span className="product-grid-divider__label">All Menu Items</span>
            </div>
          </div>
        )}

        {/* Categorized Sections: Chai at Top -> Parhata in Middle -> General at Bottom */}
        {isCategorizedView ? (
          <div className="categorized-menu-flow">
            {/* 1. ☕ Chai Items (Top) */}
            {chaiProducts.length > 0 && (
              <div className="menu-category-block">
                <div className="menu-category-header menu-category-header--chai">
                  <div className="menu-category-title-wrap">
                    <span className="menu-category-icon">☕</span>
                    <h3 className="menu-category-title">Chai Items</h3>
                  </div>
                  <span className="menu-category-count">{chaiProducts.length} items</span>
                </div>
                <div className="product-grid">
                  {chaiProducts.map((p) => (
                    <ProductButton
                      key={p.id}
                      product={p}
                      onClick={onAddProduct}
                      onCustomAmount={onCustomAmount}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* 2. 🫓 Parhata Items (Middle) */}
            {parhataProducts.length > 0 && (
              <div className="menu-category-block">
                <div className="menu-category-header menu-category-header--parhata">
                  <div className="menu-category-title-wrap">
                    <span className="menu-category-icon">🫓</span>
                    <h3 className="menu-category-title">Parhata Items</h3>
                  </div>
                  <span className="menu-category-count">{parhataProducts.length} items</span>
                </div>
                <div className="product-grid">
                  {parhataProducts.map((p) => (
                    <ProductButton
                      key={p.id}
                      product={p}
                      onClick={onAddProduct}
                      onCustomAmount={onCustomAmount}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* 3. 📦 General Items (Bottom) */}
            {generalProducts.length > 0 && (
              <div className="menu-category-block">
                <div className="menu-category-header menu-category-header--general">
                  <div className="menu-category-title-wrap">
                    <span className="menu-category-icon">📦</span>
                    <h3 className="menu-category-title">General Items</h3>
                  </div>
                  <span className="menu-category-count">{generalProducts.length} items</span>
                </div>
                <div className="product-grid">
                  {generalProducts.map((p) => (
                    <ProductButton
                      key={p.id}
                      product={p}
                      onClick={onAddProduct}
                      onCustomAmount={onCustomAmount}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Filtered / Searched Grid (ordered Chai -> Parhata -> General) */
          <div className="product-grid">
            {sortedProducts.map((p) => (
              <ProductButton
                key={p.id}
                product={p}
                onClick={onAddProduct}
                onCustomAmount={onCustomAmount}
              />
            ))}
          </div>
        )}

        {sortedProducts.length === 0 && (
          <p className="empty-hint">No products match your search or filter.</p>
        )}
      </div>
    </div>
  );
}

