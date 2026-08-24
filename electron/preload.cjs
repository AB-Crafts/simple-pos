const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getDbPath: () => ipcRenderer.invoke('get-db-path'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  quitAndInstall: () => ipcRenderer.invoke('quit-and-install'),
  onUpdateStatus: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('updater-status', listener);
    return () => ipcRenderer.removeListener('updater-status', listener);
  },
});
