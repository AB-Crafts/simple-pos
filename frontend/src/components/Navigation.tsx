export type Page = 'pos' | 'orders' | 'products' | 'sales' | 'expenses' | 'moneyflow' | 'reports';

interface Props {
  current: Page;
  onNavigate: (page: Page) => void;
  pendingOrdersCount?: number;
}

const ITEMS: { id: Page; label: string; enabled: boolean }[] = [
  { id: 'pos', label: 'POS', enabled: true },
  { id: 'orders', label: 'Orders & Bills', enabled: true },
  { id: 'sales', label: 'Sales History', enabled: true },
  { id: 'products', label: 'Products', enabled: true },
  { id: 'expenses', label: 'Expenses', enabled: true },
  { id: 'moneyflow', label: 'Money Flow', enabled: true },
  { id: 'reports', label: 'Reports', enabled: true },
];

export function Navigation({ current, onNavigate, pendingOrdersCount = 0 }: Props) {
  return (
    <nav className="nav-bar">
      {ITEMS.map((item) => (
        <button
          key={item.id}
          className={`nav-item ${current === item.id ? 'nav-item--active' : ''}`}
          onClick={() => item.enabled && onNavigate(item.id)}
          disabled={!item.enabled}
          title={item.enabled ? undefined : 'Coming in a later phase'}
        >
          {item.label}
          {item.id === 'orders' && pendingOrdersCount > 0 && (
            <span className="nav-badge">{pendingOrdersCount}</span>
          )}
        </button>
      ))}
    </nav>
  );
}
