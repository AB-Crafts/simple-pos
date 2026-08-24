import { useEffect, useState } from 'react';
import { Navigation, type Page } from './components/Navigation';
import { UpdateStatus } from './components/UpdateStatus';
import { POSPage } from './pages/POSPage';
import { OrdersPage } from './pages/OrdersPage';
import { ProductsPage } from './pages/ProductsPage';
import { SalesHistoryPage } from './pages/SalesHistoryPage';
import { ExpensesPage } from './pages/ExpensesPage';
import { MoneyFlowPage } from './pages/MoneyFlowPage';
import { ReportsPage } from './pages/ReportsPage';
import { getPendingOrdersCount } from './services/salesService';
import type { Sale, SaleItem } from './types';

export default function App() {
  const [page, setPage] = useState<Page>('pos');
  const [clock, setClock] = useState(new Date());
  const [editingOrder, setEditingOrder] = useState<{ sale: Sale; items: SaleItem[] } | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [appVersion, setAppVersion] = useState('0.1.1');

  useEffect(() => {
    if (window.electronAPI?.getAppVersion) {
      window.electronAPI.getAppVersion().then((v) => {
        if (v) setAppVersion(v.replace(/^v/, ''));
      }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000 * 30);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    // Keep pending count updated for navigation badge
    async function updateCount() {
      try {
        const count = await getPendingOrdersCount();
        setPendingCount(count);
      } catch {
        // ignore if initializing or server starting
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

  return (
    <div className="app-shell">
      <header className="app-header">
        <span className="app-header__title">
          Banu Pyala Cafe
          <sub className="app-header__version">v{appVersion}</sub>
        </span>
        <div className="app-header__right">
          <span className="app-header__clock">
            {clock.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })} ·{' '}
            {clock.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })}
          </span>
          <UpdateStatus />
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
