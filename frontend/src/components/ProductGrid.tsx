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

  const visible = useMemo(() => {
    const source = (allProducts ?? []).filter((p) => p.active);
    return source.filter((p) => {
      const matchesCategory = categoryId === 'all' || p.categoryId === categoryId;
      const matchesSearch = p.name.toLowerCase().includes(search.trim().toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [allProducts, categoryId, search]);

  return (
    <div className="product-panel">
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

      <div className="product-grid">
        {visible.map((p) => (
          <ProductButton key={p.id} product={p} onClick={onAddProduct} />
        ))}
        {visible.length === 0 && <p className="empty-hint">No products match.</p>}
      </div>
    </div>
  );
}
