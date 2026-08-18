import { useEffect, useState } from 'react';
import { Navigation, type Page } from './components/Navigation';
import { ConnectionStatus } from './components/ConnectionStatus';
import { POSPage } from './pages/POSPage';
import { OrdersPage } from './pages/OrdersPage';
import { ProductsPage } from './pages/ProductsPage';
import { SalesHistoryPage } from './pages/SalesHistoryPage';
import { ExpensesPage } from './pages/ExpensesPage';
import { MoneyFlowPage } from './pages/MoneyFlowPage';
import { ReportsPage } from './pages/ReportsPage';
import { seedIfEmpty } from './database/seed';
import { db } from './database/db';
import { startAutoSync } from './services/syncService';
import type { Sale, SaleItem } from './types';

export default function App() {
  const [page, setPage] = useState<Page>('pos');
  const [ready, setReady] = useState(false);
  const [clock, setClock] = useState(new Date());
  const [editingOrder, setEditingOrder] = useState<{ sale: Sale; items: SaleItem[] } | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    seedIfEmpty().finally(() => setReady(true));
  }, []);

  useEffect(() => {
    // Best-effort background push of queued sales/expenses/products to the
    // backend. Runs independently of the UI — never blocks a sale.
    return startAutoSync();
  }, []);

  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000 * 30);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    // Keep pending count updated for navigation badge
    async function updateCount() {
      try {
        const count = await db.sales.where('status').equals('PENDING').count();
        setPendingCount(count);
      } catch {
        // ignore if initializing
      }
    }
    updateCount();
    const interval = setInterval(updateCount, 3000);
    return () => clearInterval(interval);
  }, []);

  function handleEditOrder(sale: Sale, items: SaleItem[]) {
    setEditingOrder({ sale, items });
    setPage('pos');
  }

  if (!ready) return null;

  return (
    <div className="app-shell">
      <header className="app-header">
        <span className="app-header__title">Simple POS · Bany Pyala</span>
        <div className="app-header__right">
          <span className="app-header__clock">
            {clock.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })} ·{' '}
            {clock.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })}
          </span>
          <ConnectionStatus />
        </div>
      </header>

      <main className="app-main">
        {page === 'pos' && (
          <POSPage
            editingOrder={editingOrder}
            onClearEditingOrder={() => setEditingOrder(null)}
            onNavigateToOrders={() => setPage('orders')}
          />
        )}
        {page === 'orders' && (
          <OrdersPage
            onEditOrder={handleEditOrder}
            onNavigateToPOS={() => {
              setEditingOrder(null);
              setPage('pos');
            }}
          />
        )}
        {page === 'products' && <ProductsPage />}
        {page === 'sales' && <SalesHistoryPage />}
        {page === 'expenses' && <ExpensesPage />}
        {page === 'moneyflow' && <MoneyFlowPage />}
        {page === 'reports' && <ReportsPage />}
      </main>

      <Navigation current={page} onNavigate={setPage} pendingOrdersCount={pendingCount} />
    </div>
  );
}
