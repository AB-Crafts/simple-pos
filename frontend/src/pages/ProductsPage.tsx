import { useEffect, useMemo, useState } from 'react';
import { apiClient } from '../services/apiClient';
import { formatMoney, toPaisa, toRupees } from '../utils/money';
import type { Product, Category, Department } from '../types';

interface ProductFormData {
  name: string;
  costPrice: string;
  sellingPrice: string;
  stock: string;
  categoryId: string;
  department: Department;
  active: boolean;
}

const emptyForm: ProductFormData = {
  name: '',
  costPrice: '',
  sellingPrice: '',
  stock: '50',
  categoryId: '',
  department: 'GENERAL',
  active: true,
};

export function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<'ALL' | Department>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [stockFilter, setStockFilter] = useState<'ALL' | 'LOW' | 'ACTIVE' | 'INACTIVE'>('ALL');

  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductFormData>(emptyForm);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [prods, cats] = await Promise.all([
        apiClient.get<Product[]>('/products'),
        apiClient.get<Category[]>('/categories'),
      ]);
      setProducts(prods);
      setCategories(cats);
    } catch (err) {
      console.error('Failed to load products/categories:', err);
    }
  }

  // Filtered product list
  const filteredProducts = useMemo(() => {
    let list = products ?? [];

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }

    if (departmentFilter !== 'ALL') {
      list = list.filter((p) => (p.department || 'GENERAL') === departmentFilter);
    }

    if (categoryFilter !== 'ALL') {
      list = list.filter((p) => (p.categoryId || '') === categoryFilter);
    }

    if (stockFilter === 'LOW') {
      list = list.filter((p) => p.stock <= 5);
    } else if (stockFilter === 'ACTIVE') {
      list = list.filter((p) => p.active);
    } else if (stockFilter === 'INACTIVE') {
      list = list.filter((p) => !p.active);
    }

    return list;
  }, [products, search, departmentFilter, categoryFilter, stockFilter]);

  // Stats calculation
  const totalCount = products?.length ?? 0;
  const activeCount = products?.filter((p) => p.active).length ?? 0;
  const lowStockCount = products?.filter((p) => p.stock <= 5).length ?? 0;
  const chaiCount = products?.filter((p) => p.department === 'CHAI').length ?? 0;
  const parhataCount = products?.filter((p) => p.department === 'PARHATA').length ?? 0;

  function startAdd() {
    setEditingProduct(null);
    setForm(emptyForm);
    setShowModal(true);
  }

  function startEdit(p: Product) {
    setEditingProduct(p);
    setForm({
      name: p.name,
      costPrice: String(toRupees(p.costPrice)),
      sellingPrice: String(toRupees(p.sellingPrice)),
      stock: String(p.stock),
      categoryId: p.categoryId ?? '',
      department: p.department || 'GENERAL',
      active: p.active,
    });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      alert('Please enter a product name');
      return;
    }
    const sell = parseFloat(form.sellingPrice);
    if (isNaN(sell) || sell < 0) {
      alert('Please enter a valid selling price');
      return;
    }

    setSaving(true);
    try {
      const cost = parseFloat(form.costPrice || '0');
      const stockQty = parseInt(form.stock || '0', 10);

      const payload = {
        id: editingProduct ? editingProduct.id : undefined,
        name: form.name.trim(),
        costPrice: toPaisa(isNaN(cost) ? 0 : cost),
        sellingPrice: toPaisa(sell),
        stock: isNaN(stockQty) ? 0 : stockQty,
        categoryId: form.categoryId || null,
        department: form.department,
        active: form.active,
      };

      await apiClient.post<Product>('/products', payload);
      setToast(`Product "${form.name.trim()}" ${editingProduct ? 'updated' : 'created'}!`);

      await loadData();
      setShowModal(false);
      setForm(emptyForm);
    } catch (err: any) {
      alert(err.message || 'Failed to save product');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(p: Product) {
    try {
      const updated = await apiClient.patch<Product>(`/products/${p.id}/toggle-active`, {});
      setToast(`Product "${p.name}" ${updated.active ? 'activated' : 'deactivated'}`);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to toggle product status');
    }
  }

  // Live profit calculation for modal form
  const sellingNum = parseFloat(form.sellingPrice || '0');
  const costNum = parseFloat(form.costPrice || '0');
  const profitNum = sellingNum - costNum;
  const marginPercent = sellingNum > 0 ? Math.round((profitNum / sellingNum) * 100) : 0;

  return (
    <div className="products-page">
      {/* Top Header & Metrics */}
      <div className="products-page__header">
        <div>
          <h2 className="products-title">Menu & Products</h2>
          <p className="products-subtitle">
            Manage hotel menu items, prices, stock quantities, and department routing for kitchen slips.
          </p>
        </div>

        <button className="btn btn-primary btn-large add-product-btn" onClick={startAdd}>
          + Add New Product
        </button>
      </div>

      {/* Metrics Row */}
      <div className="products-stats-row">
        <div className="product-stat-card">
          <span className="stat-card__label">Total Products</span>
          <span className="stat-card__val">{totalCount}</span>
        </div>
        <div className="product-stat-card">
          <span className="stat-card__label">Active Menu Items</span>
          <span className="stat-card__val text-success">{activeCount}</span>
        </div>
        <div className="product-stat-card">
          <span className="stat-card__label">☕ Chai Department</span>
          <span className="stat-card__val text-chai">{chaiCount}</span>
        </div>
        <div className="product-stat-card">
          <span className="stat-card__label">🫓 Parhata Department</span>
          <span className="stat-card__val text-parhata">{parhataCount}</span>
        </div>
        {lowStockCount > 0 && (
          <div
            className="product-stat-card product-stat-card--warn"
            onClick={() => setStockFilter(stockFilter === 'LOW' ? 'ALL' : 'LOW')}
            style={{ cursor: 'pointer' }}
          >
            <span className="stat-card__label">⚠️ Low Stock (&le; 5)</span>
            <span className="stat-card__val text-warn">{lowStockCount}</span>
          </div>
        )}
      </div>

      {/* Filters Toolbar */}
      <div className="products-toolbar-card">
        <div className="products-search-wrap">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search by product name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="products-search-input"
          />
          {search && (
            <button className="clear-search-btn" onClick={() => setSearch('')}>
              ✕
            </button>
          )}
        </div>

        {/* Department Filter Chips */}
        <div className="filter-chips-group">
          <span className="filter-label">Dept:</span>
          <button
            className={`filter-chip ${departmentFilter === 'ALL' ? 'filter-chip--active' : ''}`}
            onClick={() => setDepartmentFilter('ALL')}
          >
            All
          </button>
          <button
            className={`filter-chip ${departmentFilter === 'CHAI' ? 'filter-chip--active' : ''}`}
            onClick={() => setDepartmentFilter('CHAI')}
          >
            ☕ Chai
          </button>
          <button
            className={`filter-chip ${departmentFilter === 'PARHATA' ? 'filter-chip--active' : ''}`}
            onClick={() => setDepartmentFilter('PARHATA')}
          >
            🫓 Parhata
          </button>
          <button
            className={`filter-chip ${departmentFilter === 'GENERAL' ? 'filter-chip--active' : ''}`}
            onClick={() => setDepartmentFilter('GENERAL')}
          >
            📦 General
          </button>
        </div>

        {/* Category Dropdown */}
        {categories && categories.length > 0 && (
          <div className="filter-select-wrap">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="filter-select"
            >
              <option value="ALL">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Stock Filter */}
        <div className="filter-select-wrap">
          <select
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value as any)}
            className="filter-select"
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active Only</option>
            <option value="LOW">Low Stock (&le; 5)</option>
            <option value="INACTIVE">Inactive Only</option>
          </select>
        </div>
      </div>

      {/* Products Table Card (Desktop / Tablet) */}
      <div className="products-table-card desktop-only">
        <table className="products-modern-table">
          <thead>
            <tr>
              <th>Product Name</th>
              <th>Department</th>
              <th>Category</th>
              <th style={{ textAlign: 'right' }}>Selling Price</th>
              <th style={{ textAlign: 'right' }}>Cost Price</th>
              <th style={{ textAlign: 'center' }}>Stock</th>
              <th style={{ textAlign: 'center' }}>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.map((p) => {
              const catName = categories?.find((c) => c.id === p.categoryId)?.name ?? '—';
              const profit = p.sellingPrice - p.costPrice;
              return (
                <tr key={p.id} className={!p.active ? 'product-row--inactive' : ''}>
                  <td className="product-name-cell">
                    <div className="product-title-text">{p.name}</div>
                    <div className="product-cat-subtext">{catName}</div>
                  </td>

                  <td>
                    <span className={`dept-badge dept-badge--${p.department?.toLowerCase() || 'general'}`}>
                      {p.department === 'CHAI' ? '☕ Chai' : p.department === 'PARHATA' ? '🫓 Parhata' : '📦 General'}
                    </span>
                  </td>

                  <td className="product-category-cell">{catName}</td>

                  <td style={{ textAlign: 'right' }}>
                    <div className="price-primary">{formatMoney(p.sellingPrice)}</div>
                    {p.costPrice > 0 && profit > 0 && (
                      <div className="profit-subtext">+{formatMoney(profit)}</div>
                    )}
                  </td>

                  <td style={{ textAlign: 'right' }} className="text-muted">
                    {p.costPrice > 0 ? formatMoney(p.costPrice) : '—'}
                  </td>

                  <td style={{ textAlign: 'center' }}>
                    <span
                      className={`stock-badge ${
                        p.stock <= 0
                          ? 'stock-badge--out'
                          : p.stock <= 5
                          ? 'stock-badge--low'
                          : 'stock-badge--ok'
                      }`}
                    >
                      {p.stock <= 0 ? 'Out of stock' : `${p.stock} units`}
                    </span>
                  </td>

                  <td style={{ textAlign: 'center' }}>
                    <button
                      className={`status-toggle-pill ${p.active ? 'status-toggle-pill--active' : 'status-toggle-pill--inactive'}`}
                      onClick={() => handleToggleActive(p)}
                      title={`Click to ${p.active ? 'deactivate' : 'activate'}`}
                    >
                      {p.active ? 'Active' : 'Inactive'}
                    </button>
                  </td>

                  <td style={{ textAlign: 'right' }}>
                    <div className="product-action-btns">
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => startEdit(p)}
                        title="Edit product details"
                      >
                        ✏️ Edit
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {filteredProducts.length === 0 && (
              <tr>
                <td colSpan={8} className="products-empty-cell">
                  <div className="empty-state-wrap">
                    <span className="empty-icon">📦</span>
                    <p className="empty-title">No products found</p>
                    <p className="empty-desc">
                      {search || departmentFilter !== 'ALL' || stockFilter !== 'ALL'
                        ? 'Try clearing or changing your search filters.'
                        : 'Click "+ Add New Product" above to create your first menu item.'}
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Products Mobile Card List (<= 768px) */}
      <div className="products-mobile-list mobile-only">
        {filteredProducts.map((p) => {
          const catName = categories?.find((c) => c.id === p.categoryId)?.name ?? '—';
          const profit = p.sellingPrice - p.costPrice;
          return (
            <div key={p.id} className={`product-card-mobile ${!p.active ? 'product-card-mobile--inactive' : ''}`}>
              <div className="product-card-mobile__header">
                <div>
                  <h4 className="product-card-mobile__title">{p.name}</h4>
                  <div className="product-card-mobile__cat">{catName}</div>
                </div>
                <span className={`dept-badge dept-badge--${p.department?.toLowerCase() || 'general'}`}>
                  {p.department === 'CHAI' ? '☕ Chai' : p.department === 'PARHATA' ? '🫓 Parhata' : '📦 General'}
                </span>
              </div>

              <div className="product-card-mobile__pricing">
                <div className="price-item">
                  <span className="price-label">Selling:</span>
                  <strong className="price-val">{formatMoney(p.sellingPrice)}</strong>
                </div>
                {p.costPrice > 0 && (
                  <div className="price-item">
                    <span className="price-label">Cost:</span>
                    <span className="price-val text-muted">{formatMoney(p.costPrice)}</span>
                  </div>
                )}
                {profit > 0 && p.costPrice > 0 && (
                  <div className="price-item">
                    <span className="price-label">Profit:</span>
                    <span className="price-val text-success">+{formatMoney(profit)}</span>
                  </div>
                )}
              </div>

              <div className="product-card-mobile__footer">
                <div className="product-card-mobile__status">
                  <span
                    className={`stock-badge ${
                      p.stock <= 0
                        ? 'stock-badge--out'
                        : p.stock <= 5
                        ? 'stock-badge--low'
                        : 'stock-badge--ok'
                    }`}
                  >
                    {p.stock <= 0 ? 'Out of stock' : `${p.stock} units`}
                  </span>
                  <button
                    className={`status-toggle-pill ${p.active ? 'status-toggle-pill--active' : 'status-toggle-pill--inactive'}`}
                    onClick={() => handleToggleActive(p)}
                  >
                    {p.active ? 'Active' : 'Inactive'}
                  </button>
                </div>

                <button className="btn btn-sm btn-secondary" onClick={() => startEdit(p)}>
                  ✏️ Edit
                </button>
              </div>
            </div>
          );
        })}

        {filteredProducts.length === 0 && (
          <div className="empty-state-wrap" style={{ padding: '32px 16px' }}>
            <span className="empty-icon">📦</span>
            <p className="empty-title">No products found</p>
            <p className="empty-desc">
              {search || departmentFilter !== 'ALL' || stockFilter !== 'ALL'
                ? 'Try clearing or changing your search filters.'
                : 'Click "+ Add New Product" above to create your first menu item.'}
            </p>
          </div>
        )}
      </div>


      {/* Add / Edit Product Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div
            className="modal-card product-form-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h3 className="modal-title">
                  {editingProduct ? '✏️ Edit Product' : '✨ Add New Product'}
                </h3>
                <span className="modal-subtitle">
                  Configure menu item, prices, stock, and kitchen slip department.
                </span>
              </div>
              <button
                className="btn-icon"
                onClick={() => setShowModal(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="modal-body product-modal-body">
              {/* Product Name */}
              <div className="form-group">
                <label className="form-label">
                  Product Name <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Karak Chai, Aloo Parhata, Cheese Omelette"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="form-input"
                  autoFocus
                />
              </div>

              {/* Department Selector */}
              <div className="form-group">
                <label className="form-label">
                  Kitchen Department <span className="text-danger">*</span>
                </label>
                <div className="dept-radio-grid">
                  <label
                    className={`dept-radio-card ${
                      form.department === 'CHAI' ? 'dept-radio-card--active-chai' : ''
                    }`}
                  >
                    <input
                      type="radio"
                      name="dept"
                      value="CHAI"
                      checked={form.department === 'CHAI'}
                      onChange={() => setForm({ ...form, department: 'CHAI' })}
                    />
                    <div className="dept-radio-card__icon">☕</div>
                    <div className="dept-radio-card__text">
                      <strong>Chai Dept</strong>
                      <span>Prints on Chai Slip</span>
                    </div>
                  </label>

                  <label
                    className={`dept-radio-card ${
                      form.department === 'PARHATA' ? 'dept-radio-card--active-parhata' : ''
                    }`}
                  >
                    <input
                      type="radio"
                      name="dept"
                      value="PARHATA"
                      checked={form.department === 'PARHATA'}
                      onChange={() => setForm({ ...form, department: 'PARHATA' })}
                    />
                    <div className="dept-radio-card__icon">🫓</div>
                    <div className="dept-radio-card__text">
                      <strong>Parhata Dept</strong>
                      <span>Prints on Parhata Slip</span>
                    </div>
                  </label>

                  <label
                    className={`dept-radio-card ${
                      form.department === 'GENERAL' ? 'dept-radio-card--active-general' : ''
                    }`}
                  >
                    <input
                      type="radio"
                      name="dept"
                      value="GENERAL"
                      checked={form.department === 'GENERAL'}
                      onChange={() => setForm({ ...form, department: 'GENERAL' })}
                    />
                    <div className="dept-radio-card__icon">📦</div>
                    <div className="dept-radio-card__text">
                      <strong>General</strong>
                      <span>Snacks / Drinks</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Category Dropdown */}
              <div className="form-group">
                <label className="form-label">Category</label>
                <select
                  value={form.categoryId}
                  onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                  className="form-select"
                >
                  <option value="">(No Category / General)</option>
                  {categories?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Pricing Row */}
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">
                    Selling Price (Rs.) <span className="text-danger">*</span>
                  </label>
                  <div className="currency-input-wrap">
                    <span className="currency-prefix">Rs.</span>
                    <input
                      type="number"
                      min={0}
                      step="1"
                      placeholder="0"
                      value={form.sellingPrice}
                      onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })}
                      className="form-input currency-input"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Cost Price (Rs.)</label>
                  <div className="currency-input-wrap">
                    <span className="currency-prefix">Rs.</span>
                    <input
                      type="number"
                      min={0}
                      step="1"
                      placeholder="0"
                      value={form.costPrice}
                      onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
                      className="form-input currency-input"
                    />
                  </div>
                </div>
              </div>

              {/* Margin feedback */}
              {sellingNum > 0 && (
                <div className="margin-indicator-banner">
                  <span>
                    Est. Profit: <strong>Rs. {profitNum > 0 ? profitNum : 0}</strong> per item
                  </span>
                  {marginPercent > 0 && (
                    <span className="margin-badge">
                      {marginPercent}% Margin
                    </span>
                  )}
                </div>
              )}

              {/* Stock Quantity */}
              <div className="form-group">
                <label className="form-label">Stock Quantity</label>
                <input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: e.target.value })}
                  className="form-input"
                />
              </div>

              {/* Active Toggle Checkbox */}
              <div className="form-checkbox-row" style={{ marginTop: '8px' }}>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) => setForm({ ...form, active: e.target.checked })}
                  />
                  <span>Active item (Available for sale on POS immediately)</span>
                </label>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setShowModal(false)}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-large"
                onClick={handleSave}
                disabled={saving || !form.name.trim() || !form.sellingPrice}
              >
                {saving ? 'Saving...' : editingProduct ? 'Save Changes' : 'Create Product'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="toast" role="status" onAnimationEnd={() => setToast(null)}>
          {toast}
        </div>
      )}
    </div>
  );
}
