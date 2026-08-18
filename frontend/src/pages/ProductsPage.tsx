import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../database/db';
import { generateId } from '../utils/id';
import { formatMoney, toPaisa, toRupees } from '../utils/money';
import type { Product } from '../types';

const emptyForm = { name: '', costPrice: '', sellingPrice: '', stock: '', categoryId: '', department: 'GENERAL' as 'CHAI' | 'PARHATA' | 'GENERAL' };

export function ProductsPage() {
  const products = useLiveQuery(() => db.products.toArray(), []);
  const categories = useLiveQuery(() => db.categories.toArray(), []);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);

  const visible = useMemo(() => {
    const list = products ?? [];
    return list.filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase()));
  }, [products, search]);

  function startAdd() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function startEdit(p: Product) {
    setEditingId(p.id);
    setForm({
      name: p.name,
      costPrice: String(toRupees(p.costPrice)),
      sellingPrice: String(toRupees(p.sellingPrice)),
      stock: String(p.stock),
      categoryId: p.categoryId ?? '',
      department: p.department || 'GENERAL',
    });
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.sellingPrice) return;
    const now = Date.now();

    if (editingId) {
      await db.products.update(editingId, {
        name: form.name.trim(),
        costPrice: toPaisa(parseFloat(form.costPrice || '0')),
        sellingPrice: toPaisa(parseFloat(form.sellingPrice)),
        stock: parseInt(form.stock || '0', 10),
        categoryId: form.categoryId || null,
        department: form.department,
        updatedAt: now,
      });
    } else {
      await db.products.add({
        id: generateId(),
        name: form.name.trim(),
        categoryId: form.categoryId || null,
        department: form.department,
        costPrice: toPaisa(parseFloat(form.costPrice || '0')),
        sellingPrice: toPaisa(parseFloat(form.sellingPrice)),
        stock: parseInt(form.stock || '0', 10),
        active: true,
        createdAt: now,
        updatedAt: now,
      });
    }
    setShowForm(false);
    setForm(emptyForm);
  }

  async function handleDeactivate(p: Product) {
    await db.products.update(p.id, { active: !p.active, updatedAt: Date.now() });
  }

  return (
    <div className="products-page">
      <div className="products-page__toolbar">
        <input
          type="text"
          placeholder="Search product..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
        />
        <button className="primary-btn" onClick={startAdd}>
          + ADD PRODUCT
        </button>
      </div>

      <table className="products-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Department</th>
            <th>Category</th>
            <th>Selling Price</th>
            <th>Cost Price</th>
            <th>Stock</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {visible.map((p) => (
            <tr key={p.id} className={!p.active ? 'products-table__row--inactive' : ''}>
              <td><strong>{p.name}</strong></td>
              <td>
                <span className={`dept-badge dept-badge--${p.department?.toLowerCase() || 'general'}`}>
                  {p.department === 'CHAI' ? '☕ Chai' : p.department === 'PARHATA' ? '🫓 Parhata' : '📦 General'}
                </span>
              </td>
              <td>{categories?.find((c) => c.id === p.categoryId)?.name ?? '—'}</td>
              <td>{formatMoney(p.sellingPrice)}</td>
              <td>{formatMoney(p.costPrice)}</td>
              <td className={p.stock <= 5 ? 'low-stock-cell' : ''}>{p.stock}</td>
              <td>{p.active ? 'Active' : 'Inactive'}</td>
              <td className="products-table__actions">
                <button onClick={() => startEdit(p)}>Edit</button>
                <button onClick={() => handleDeactivate(p)}>{p.active ? 'Deactivate' : 'Activate'}</button>
              </td>
            </tr>
          ))}
          {visible.length === 0 && (
            <tr>
              <td colSpan={8} className="empty-hint">
                No products found.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {showForm && (
        <div className="modal-backdrop" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editingId ? 'Edit Product' : 'Add Product'}</h3>

            <label>
              Name
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>

            <label>
              Department (Slip / Kitchen Routing)
              <select
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value as any })}
              >
                <option value="CHAI">☕ Chai Department</option>
                <option value="PARHATA">🫓 Parhata Department</option>
                <option value="GENERAL">📦 General / Other</option>
              </select>
            </label>

            <label>
              Category
              <select
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              >
                <option value="">Uncategorized</option>
                {categories?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="modal__row">
              <label>
                Selling price (Rs.)
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.sellingPrice}
                  onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })}
                />
              </label>
              <label>
                Cost price (Rs.)
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.costPrice}
                  onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
                />
              </label>
            </div>

            <label>
              Stock quantity
              <input
                type="number"
                min={0}
                value={form.stock}
                onChange={(e) => setForm({ ...form, stock: e.target.value })}
              />
            </label>

            <div className="modal__actions">
              <button onClick={() => setShowForm(false)}>Cancel</button>
              <button className="primary-btn" onClick={handleSave}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
