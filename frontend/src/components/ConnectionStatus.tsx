import { useEffect, useState } from 'react';
import { apiClient } from '../services/apiClient';

/**
 * Shows the local SQLite backend connection state:
 * ONLINE ✓ / OFFLINE
 */
export function ConnectionStatus() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function checkHealth() {
      try {
        await apiClient.get<{ ok: boolean }>('/health');
        if (mounted) setOnline(true);
      } catch {
        if (mounted) setOnline(false);
      }
    }

    checkHealth();
    const interval = setInterval(checkHealth, 5000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const label = online ? 'ONLINE ✓' : 'OFFLINE';
  const modifier = online ? 'online' : 'offline';

  return <span className={`connection-status connection-status--${modifier}`}>{label}</span>;
}
