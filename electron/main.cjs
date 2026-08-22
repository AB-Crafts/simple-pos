const { app, BrowserWindow, ipcMain, Menu, utilityProcess } = require('electron');
const path = require('node:path');
const http = require('node:http');
const fs = require('node:fs');
const { fork } = require('node:child_process');

let mainWindow = null;
let backendProcess = null;
let isQuitting = false;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const PORT = process.env.PORT || '4000';

function getDatabasePath() {
  if (process.env.POS_DB_PATH) {
    return process.env.POS_DB_PATH;
  }
  const userDataPath = app.getPath('userData');
  const dbFileName = isDev ? 'pos-dev.db' : 'pos.db';
  return path.join(userDataPath, dbFileName);
}

const dbPath = getDatabasePath();

// Ensure DB directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

function checkBackendHealth(retries = 40, delayMs = 300) {
  return new Promise((resolve) => {
    let attempts = 0;

    function ping() {
      attempts++;
      const req = http.get(`http://127.0.0.1:${PORT}/api/health`, (res) => {
        if (res.statusCode === 200) {
          console.log(`[Electron] Backend is healthy on port ${PORT}`);
          return resolve(true);
        }
        retry();
      });

      req.on('error', () => {
        retry();
      });

      req.setTimeout(500, () => {
        req.destroy();
        retry();
      });
    }

    function retry() {
      if (attempts >= retries) {
        console.warn(`[Electron] Backend did not respond after ${attempts} attempts`);
        return resolve(false);
      }
      setTimeout(ping, delayMs);
    }

    ping();
  });
}

function startBackendService() {
  return new Promise((resolve) => {
    // In dev mode, if backend is already running (e.g. from concurrently), reuse it
    checkBackendHealth(3, 200).then((alreadyRunning) => {
      if (alreadyRunning) {
        console.log('[Electron] Connected to existing backend service.');
        return resolve();
      }

      const serverPath = isDev
        ? path.join(__dirname, '../backend/dist/server.js')
        : path.join(app.getAppPath(), 'backend/dist/server.js');

      console.log(`[Electron] Starting backend service from: ${serverPath}`);
      console.log(`[Electron] Persistent Database Path: ${dbPath}`);

      const env = {
        ...process.env,
        PORT: String(PORT),
        POS_DB_PATH: dbPath,
        NODE_ENV: isDev ? 'development' : 'production',
        ELECTRON_RUN_AS_NODE: '1',
      };

      try {
        if (utilityProcess && typeof utilityProcess.fork === 'function') {
          backendProcess = utilityProcess.fork(serverPath, [], {
            env,
            stdio: 'inherit',
          });
        } else {
          backendProcess = fork(serverPath, [], {
            env,
            execPath: process.execPath,
            execArgv: [],
            stdio: 'inherit',
          });
        }

        if (backendProcess.on) {
          backendProcess.on('error', (err) => {
            console.error('[Electron] Failed to spawn backend process:', err);
          });

          backendProcess.on('exit', (code) => {
            console.log(`[Electron] Backend process exited with code ${code}`);
            backendProcess = null;
          });
        }

        checkBackendHealth(50, 300).then(() => resolve());
      } catch (err) {
        console.error('[Electron] Error launching backend:', err);
        resolve();
      }
    });
  });
}

function stopBackendService() {
  if (backendProcess) {
    console.log('[Electron] Stopping backend service gracefully...');
    try {
      if (typeof backendProcess.kill === 'function') {
        backendProcess.kill();
      }
      backendProcess = null;
    } catch (err) {
      console.error('[Electron] Error stopping backend:', err);
    }
  }
}

function createMainWindow() {
  const iconPath = path.join(__dirname, '../frontend/public/icons/icon-512.png');

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    title: 'Banu Pyala Cafe · POS',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    backgroundColor: '#0f172a',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: true,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://127.0.0.1:5173');
  } else {
    const indexPath = path.join(app.getAppPath(), 'frontend/dist/index.html');
    mainWindow.loadFile(indexPath);
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  setupMenu();
}

function setupMenu() {
  const template = [
    {
      label: 'View',
      submenu: [
        { role: 'reload', accelerator: 'Ctrl+R' },
        { role: 'forceReload', accelerator: 'Ctrl+Shift+R' },
        { role: 'toggleDevTools', accelerator: 'Ctrl+Shift+I' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen', accelerator: 'F11' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    ipcMain.handle('get-app-version', () => app.getVersion());
    ipcMain.handle('get-db-path', () => dbPath);

    await startBackendService();
    createMainWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
      }
    });
  });
}

app.on('before-quit', () => {
  isQuitting = true;
  stopBackendService();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
