export type Page = 'pos' | 'orders' | 'products' | 'sales' | 'expenses' | 'moneyflow' | 'reports';

interface Props {
  current: Page;
  onNavigate: (page: Page) => void;
  pendingOrdersCount?: number;
}

const ITEMS: { id: Page; label: string; icon: string; enabled: boolean }[] = [
  { id: 'pos', label: 'POS', icon: '⚡', enabled: true },
  { id: 'orders', label: 'Orders & Bills', icon: '📋', enabled: true },
  { id: 'sales', label: 'Sales History', icon: '📜', enabled: true },
  { id: 'products', label: 'Products', icon: '📦', enabled: true },
  { id: 'expenses', label: 'Expenses', icon: '💸', enabled: true },
  { id: 'moneyflow', label: 'Money Flow', icon: '💰', enabled: true },
  { id: 'reports', label: 'Reports', icon: '📊', enabled: true },
];

export function Navigation({ current, onNavigate, pendingOrdersCount = 0 }: Props) {
  return (
    <nav className="nav-bar" aria-label="Main Navigation">
      {ITEMS.map((item) => (
        <button
          key={item.id}
          className={`nav-item ${current === item.id ? 'nav-item--active' : ''}`}
          onClick={() => item.enabled && onNavigate(item.id)}
          disabled={!item.enabled}
          title={item.enabled ? item.label : 'Coming soon'}
        >
          <span className="nav-icon">{item.icon}</span>
          <span className="nav-label">{item.label}</span>
          {item.id === 'orders' && pendingOrdersCount > 0 && (
            <span className="nav-badge" aria-label={`${pendingOrdersCount} pending orders`}>
              {pendingOrdersCount}
            </span>
          )}
        </button>
      ))}
    </nav>
  );
}

