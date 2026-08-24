import { useEffect, useState, useCallback } from 'react';
import type { UpdateStatusData } from '../vite-env';

function isNewerVersion(remoteTag: string, currentVersion: string): boolean {
  const cleanRemote = remoteTag.replace(/^v/, '').trim();
  const cleanCurrent = currentVersion.replace(/^v/, '').trim();
  const rParts = cleanRemote.split('.').map((p) => parseInt(p, 10) || 0);
  const cParts = cleanCurrent.split('.').map((p) => parseInt(p, 10) || 0);
  for (let i = 0; i < Math.max(rParts.length, cParts.length); i++) {
    const r = rParts[i] || 0;
    const c = cParts[i] || 0;
    if (r > c) return true;
    if (r < c) return false;
  }
  return false;
}

export function UpdateStatus() {
  const [status, setStatus] = useState<UpdateStatusData['status']>('idle');
  const [newVersion, setNewVersion] = useState<string | null>(null);
  const [downloadPercent, setDownloadPercent] = useState<number | null>(null);
  const [releaseNotes, setReleaseNotes] = useState<string | null>(null);
  const [isManualChecking, setIsManualChecking] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [currentAppVersion, setCurrentAppVersion] = useState<string>('0.1.0');

  // Fetch current version if available in electron
  useEffect(() => {
    if (window.electronAPI?.getAppVersion) {
      window.electronAPI.getAppVersion().then((v) => {
        if (v) setCurrentAppVersion(v);
      }).catch(() => {});
    }
  }, []);

  const handleStatusUpdate = useCallback((data: UpdateStatusData) => {
    if (data.status) {
      setStatus(data.status);
    }
    if (data.version) {
      setNewVersion(data.version);
    }
    if (typeof data.percent === 'number') {
      setDownloadPercent(data.percent);
    }
    if (data.releaseNotes) {
      setReleaseNotes(data.releaseNotes);
    }
  }, []);

  const checkUpdates = useCallback(async () => {
    setIsManualChecking(true);
    try {
      if (window.electronAPI?.checkForUpdates) {
        const result = await window.electronAPI.checkForUpdates();
        if (result) {
          handleStatusUpdate(result);
        }
      } else {
        // Fallback for Web/Browser mode
        const res = await fetch('https://api.github.com/repos/AB-Crafts/simple-pos/releases/latest', {
          headers: { Accept: 'application/vnd.github.v3+json' },
        });
        if (res.ok) {
          const release = await res.json();
          if (release && release.tag_name) {
            const hasUpdate = isNewerVersion(release.tag_name, currentAppVersion);
            if (hasUpdate) {
              setStatus('available');
              setNewVersion(release.tag_name);
              setReleaseNotes(release.body || null);
            } else {
              setStatus('not-available');
            }
          } else {
            setStatus('not-available');
          }
        } else {
          setStatus('not-available');
        }
      }
    } catch {
      setStatus('not-available');
    } finally {
      // Keep checking visual indicator visible for at least 700ms for smooth user experience
      setTimeout(() => {
        setIsManualChecking(false);
      }, 700);
    }
  }, [currentAppVersion, handleStatusUpdate]);

  // Subscribe to Electron updater events
  useEffect(() => {
    if (window.electronAPI?.onUpdateStatus) {
      const cleanup = window.electronAPI.onUpdateStatus((data) => {
        handleStatusUpdate(data);
      });
      return cleanup;
    }
  }, [handleStatusUpdate]);

  // Initial check on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      checkUpdates();
    }, 1500);

    // Periodic check every 30 minutes
    const interval = setInterval(() => {
      checkUpdates();
    }, 30 * 60 * 1000);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [checkUpdates]);

  const handleClick = () => {
    if (status === 'downloaded') {
      if (window.electronAPI?.quitAndInstall) {
        window.electronAPI.quitAndInstall();
      } else {
        setShowModal(true);
      }
      return;
    }

    if (status === 'available') {
      setShowModal(true);
      return;
    }

    // Otherwise trigger a fresh manual check
    checkUpdates();
  };

  const handleInstallNow = () => {
    if (window.electronAPI?.quitAndInstall) {
      window.electronAPI.quitAndInstall();
    } else {
      window.open('https://github.com/AB-Crafts/simple-pos/releases/latest', '_blank');
      setShowModal(false);
    }
  };

  const isChecking = isManualChecking || status === 'checking';

  // Determine button presentation
  let label = 'UP TO DATE';
  let modifier = 'uptodate';
  let title = 'Click to check for updates';

  if (isChecking) {
    label = 'CHECKING...';
    modifier = 'checking';
    title = 'Checking for updates...';
  } else if (status === 'downloaded') {
    label = 'RESTART TO UPDATE';
    modifier = 'downloaded';
    title = `Update ${newVersion ? `(${newVersion})` : ''} downloaded. Click to restart and apply.`;
  } else if (status === 'downloading') {
    label = `DOWNLOADING ${downloadPercent !== null ? `${downloadPercent}%` : '...'}`;
    modifier = 'downloading';
    title = 'Downloading update package...';
  } else if (status === 'available') {
    label = 'UPDATE AVAILABLE';
    modifier = 'available';
    title = `New version ${newVersion || ''} is available! Click for details.`;
  } else {
    label = 'UP TO DATE';
    modifier = 'uptodate';
    title = `Current version v${currentAppVersion} is up to date. Click to check for updates.`;
  }

  return (
    <>
      <button
        type="button"
        className={`update-status update-status--${modifier}`}
        onClick={handleClick}
        title={title}
        aria-label={label}
        disabled={isChecking && !isManualChecking}
      >
        {isChecking && (
          <span className="update-status__spinner" aria-hidden="true" />
        )}
        {status === 'available' && !isChecking && (
          <span className="update-status__pulse-dot" aria-hidden="true" />
        )}
        {status === 'downloaded' && !isChecking && (
          <span className="update-status__icon" aria-hidden="true">⚡</span>
        )}
        {modifier === 'uptodate' && !isChecking && (
          <span className="update-status__icon" aria-hidden="true">✓</span>
        )}
        <span className="update-status__text">{label}</span>
      </button>

      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div
            className="modal-content update-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="update-modal-title"
          >
            <div className="modal-header">
              <h3 id="update-modal-title" className="modal-title">
                🚀 New Update Available
              </h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowModal(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="update-modal__body">
              <div className="update-modal__version-badge">
                <span className="update-modal__current">Current: v{currentAppVersion}</span>
                <span className="update-modal__arrow">➜</span>
                <span className="update-modal__new">Latest: {newVersion || 'Latest'}</span>
              </div>

              {releaseNotes && (
                <div className="update-modal__notes">
                  <div className="update-modal__notes-title">Release Notes:</div>
                  <pre className="update-modal__notes-content">{releaseNotes}</pre>
                </div>
              )}

              <p className="update-modal__desc">
                {status === 'downloaded'
                  ? 'The update is downloaded and ready to apply. Would you like to restart now?'
                  : 'A newer version of Banu Pyala POS is available. Click below to install or visit releases.'}
              </p>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => setShowModal(false)}
              >
                Later
              </button>
              <button
                type="button"
                className="btn btn--primary update-modal__action-btn"
                onClick={handleInstallNow}
              >
                {status === 'downloaded' ? 'Restart & Install' : 'Get Update'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
