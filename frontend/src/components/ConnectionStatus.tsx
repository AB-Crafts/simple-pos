import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../database/db';
import { onSyncEvent } from '../services/syncService';

/**
 * Shows the device's connection + sync state, per the spec:
 * ONLINE ✓ / OFFLINE / SYNCING... / SYNCED ✓ / SYNC ERROR
 *
 * Sales/expenses always save locally regardless of this status — this
 * is purely informational so the user always knows whether their data
 * has reached the backend yet.
 */
export function ConnectionStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [justSynced, setJustSynced] = useState(false);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  useEffect(() => {
    return onSyncEvent((event) => {
      if (event === 'start') {
        setSyncing(true);
        setJustSynced(false);
      } else {
        setSyncing(false);
        if (event === 'success') {
          setJustSynced(true);
          setTimeout(() => setJustSynced(false), 4000);
        }
      }
    });
  }, []);

  const failedCount = useLiveQuery(() => db.syncQueue.where('status').equals('FAILED').count(), []) ?? 0;
  const pendingCount = useLiveQuery(() => db.syncQueue.where('status').equals('PENDING').count(), []) ?? 0;

  let label: string;
  let modifier: string;

  if (!online) {
    label = 'OFFLINE';
    modifier = 'offline';
  } else if (syncing) {
    label = 'SYNCING...';
    modifier = 'syncing';
  } else if (failedCount > 0) {
    label = `SYNC ERROR (${failedCount})`;
    modifier = 'error';
  } else if (justSynced) {
    label = 'SYNCED ✓';
    modifier = 'synced';
  } else if (pendingCount > 0) {
    label = 'SYNCING...';
    modifier = 'syncing';
  } else {
    label = 'ONLINE ✓';
    modifier = 'online';
  }

  return <span className={`connection-status connection-status--${modifier}`}>{label}</span>;
}
