const { app, BrowserWindow, ipcMain, Menu, utilityProcess } = require('electron');
const { autoUpdater } = require('electron-updater');

const path = require('node:path');
const http = require('node:http');
const fs = require('node:fs');
const { fork } = require('node:child_process');

let mainWindow = null;
let backendProcess = null;
let isQuitting = false;

const isDev =
  process.env.NODE_ENV === 'development' ||
  (!app.isPackaged && process.env.NODE_ENV !== 'production');

const PORT = process.env.PORT || '4000';

/* ---------------------------------------------------------
   DATABASE
--------------------------------------------------------- */

function getDatabasePath() {
  if (process.env.POS_DB_PATH) {
    return process.env.POS_DB_PATH;
  }

  const os = require('node:os');

  // Keep compatibility with the old database location.
  const legacyDb = path.join(os.homedir(), '.simple-pos', 'pos.db');

  if (fs.existsSync(legacyDb)) {
    return legacyDb;
  }

  const userDataPath = app.getPath('userData');
  const dbFileName = isDev ? 'pos-dev.db' : 'pos.db';

  return path.join(userDataPath, dbFileName);
}

const dbPath = getDatabasePath();

const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

/* ---------------------------------------------------------
   BACKEND HEALTH CHECK
--------------------------------------------------------- */

function checkBackendHealth(retries = 40, delayMs = 300) {
  return new Promise((resolve) => {
    let attempts = 0;
    let settled = false;
    let timeoutId = null;

    function done(result) {
      if (!settled) {
        settled = true;

        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }

        resolve(result);
      }
    }

    function ping() {
      if (settled) return;

      attempts++;

      const req = http.get(
        `http://127.0.0.1:${PORT}/api/health`,
        (res) => {
          if (res.statusCode === 200) {
            console.log(
              `[Electron] Backend is healthy on port ${PORT}`
            );

            return done(true);
          }

          retry();
        }
      );

      req.on('error', () => {
        retry();
      });

      req.setTimeout(500, () => {
        req.destroy();
        retry();
      });
    }

    function retry() {
      if (settled) return;

      if (attempts >= retries) {
        console.warn(
          `[Electron] Backend did not respond after ${attempts} attempts`
        );

        return done(false);
      }

      timeoutId = setTimeout(ping, delayMs);
    }

    ping();
  });
}

/* ---------------------------------------------------------
   BACKEND SERVICE
--------------------------------------------------------- */

function startBackendService() {
  return new Promise((resolve) => {
    // In development, reuse an already-running backend.
    checkBackendHealth(3, 200).then((alreadyRunning) => {
      if (alreadyRunning) {
        console.log(
          '[Electron] Connected to existing backend service.'
        );

        return resolve();
      }

      const serverPath = app.isPackaged
        ? path.join(
          app.getAppPath(),
          'backend/dist/server.js'
        )
        : path.join(
          __dirname,
          '../backend/dist/server.js'
        );

      console.log(
        `[Electron] Starting backend service from: ${serverPath}`
      );

      console.log(
        `[Electron] Persistent Database Path: ${dbPath}`
      );

      const env = {
        ...process.env,

        PORT: String(PORT),

        POS_DB_PATH: dbPath,

        NODE_ENV: isDev
          ? 'development'
          : 'production',
      };

      try {
        if (
          utilityProcess &&
          typeof utilityProcess.fork === 'function'
        ) {
          backendProcess = utilityProcess.fork(
            serverPath,
            [],
            {
              env,
              stdio: 'inherit',
            }
          );
        } else {
          backendProcess = fork(
            serverPath,
            [],
            {
              env: {
                ...env,
                ELECTRON_RUN_AS_NODE: '1',
              },

              execPath: process.execPath,

              execArgv: [],

              stdio: 'inherit',
            }
          );
        }

        if (backendProcess.on) {
          backendProcess.on(
            'error',
            (err) => {
              console.error(
                '[Electron] Failed to spawn backend process:',
                err
              );
            }
          );

          backendProcess.on(
            'exit',
            (code) => {
              console.log(
                `[Electron] Backend process exited with code ${code}`
              );

              backendProcess = null;
            }
          );
        }

        checkBackendHealth(50, 300).then(() =>
          resolve()
        );
      } catch (err) {
        console.error(
          '[Electron] Error launching backend:',
          err
        );

        resolve();
      }
    });
  });
}

/* ---------------------------------------------------------
   STOP BACKEND
--------------------------------------------------------- */

function stopBackendService() {
  if (!backendProcess) {
    return;
  }

  console.log(
    '[Electron] Stopping backend service gracefully...'
  );

  try {
    if (typeof backendProcess.kill === 'function') {
      backendProcess.kill();
    }

    backendProcess = null;
  } catch (err) {
    console.error(
      '[Electron] Error stopping backend:',
      err
    );
  }
}

/* ---------------------------------------------------------
   AUTO UPDATE
--------------------------------------------------------- */

let currentUpdateStatus = { status: 'idle', version: app.getVersion() };

function broadcastUpdateStatus(data) {
  currentUpdateStatus = { ...currentUpdateStatus, ...data };
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('updater-status', currentUpdateStatus);
  }
}

function isNewerVersion(remoteTag, currentVersion) {
  const cleanRemote = String(remoteTag || '').replace(/^v/, '').trim();
  const cleanCurrent = String(currentVersion || '').replace(/^v/, '').trim();
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

function checkGitHubReleaseFallback() {
  return new Promise((resolve) => {
    const https = require('node:https');
    const options = {
      hostname: 'api.github.com',
      path: '/repos/AB-Crafts/simple-pos/releases/latest',
      headers: { 'User-Agent': 'Banu-Pyala-POS-App' },
      timeout: 6000,
    };
    const req = https.get(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          if (res.statusCode === 200) {
            const release = JSON.parse(data);
            const currentVer = app.getVersion();
            const hasUpdate = isNewerVersion(release.tag_name, currentVer);
            if (hasUpdate) {
              const result = {
                status: 'available',
                version: release.tag_name,
                releaseNotes: release.body,
              };
              broadcastUpdateStatus(result);
              return resolve(result);
            }
          }
          const result = { status: 'not-available', version: app.getVersion() };
          broadcastUpdateStatus(result);
          resolve(result);
        } catch {
          const result = { status: 'not-available', version: app.getVersion() };
          broadcastUpdateStatus(result);
          resolve(result);
        }
      });
    });
    req.on('error', () => {
      const result = { status: 'not-available', version: app.getVersion() };
      broadcastUpdateStatus(result);
      resolve(result);
    });
    req.on('timeout', () => {
      req.destroy();
      const result = { status: 'not-available', version: app.getVersion() };
      broadcastUpdateStatus(result);
      resolve(result);
    });
  });
}

async function triggerCheckForUpdates() {
  broadcastUpdateStatus({ status: 'checking' });

  if (isDev || !app.isPackaged) {
    console.log('[Updater] Development mode - checking GitHub releases directly...');
    return await checkGitHubReleaseFallback();
  }

  try {
    const result = await autoUpdater.checkForUpdates();
    if (result && result.updateInfo) {
      const isNew = isNewerVersion(result.updateInfo.version, app.getVersion());
      const statusData = {
        status: isNew ? 'available' : 'not-available',
        version: result.updateInfo.version,
      };
      broadcastUpdateStatus(statusData);
      return statusData;
    }
    return currentUpdateStatus;
  } catch (error) {
    console.error('[Updater] AutoUpdater check failed, falling back to GitHub API:', error);
    return await checkGitHubReleaseFallback();
  }
}

function setupAutoUpdater() {
  if (isDev || !app.isPackaged) {
    console.log(
      '[Updater] Development mode - autoUpdater listeners in standby.'
    );
    // Initial check in dev after 4s
    setTimeout(() => {
      triggerCheckForUpdates().catch(() => {});
    }, 4000);
    return;
  }

  // Download the update automatically.
  autoUpdater.autoDownload = true;

  // Install the downloaded update when the application quits.
  autoUpdater.autoInstallOnAppQuit = true;

  // Logging
  autoUpdater.logger = console;

  autoUpdater.on('checking-for-update', () => {
    console.log('[Updater] Checking for updates...');
    broadcastUpdateStatus({ status: 'checking' });
  });

  autoUpdater.on('update-available', (info) => {
    console.log(`[Updater] Update available: ${info.version}`);
    broadcastUpdateStatus({ status: 'available', version: info.version });
  });

  autoUpdater.on('update-not-available', (info) => {
    console.log(`[Updater] Already up to date: ${info.version}`);
    broadcastUpdateStatus({ status: 'not-available', version: info.version });
  });

  autoUpdater.on('download-progress', (progress) => {
    console.log(`[Updater] Download progress: ${progress.percent.toFixed(1)}%`);
    broadcastUpdateStatus({
      status: 'downloading',
      percent: Math.round(progress.percent),
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log(`[Updater] Update downloaded: ${info.version}`);
    broadcastUpdateStatus({ status: 'downloaded', version: info.version });
  });

  autoUpdater.on('error', (error) => {
    console.error('[Updater] Update error:', error);
    broadcastUpdateStatus({
      status: 'error',
      error: error && error.message ? error.message : 'Update check failed',
    });
  });

  // Check shortly after the application starts.
  setTimeout(() => {
    triggerCheckForUpdates().catch((error) => {
      console.error('[Updater] Initial check failed:', error);
    });
  }, 5000);
}

/* ---------------------------------------------------------
   MAIN WINDOW
--------------------------------------------------------- */

function createMainWindow() {
  const iconPath = path.join(
    __dirname,
    '../frontend/public/icons/icon-512.png'
  );

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,

    minWidth: 1024,
    minHeight: 700,

    title: 'Banu Pyala Cafe · POS',

    icon: fs.existsSync(iconPath)
      ? iconPath
      : undefined,

    backgroundColor: '#0f172a',

    show: false,

    webPreferences: {
      preload: path.join(
        __dirname,
        'preload.cjs'
      ),

      contextIsolation: true,

      nodeIntegration: false,

      devTools: true,
    },
  });

  if (isDev) {
    mainWindow.loadURL(
      'http://127.0.0.1:5173'
    );
  } else {
    const indexPath = app.isPackaged
      ? path.join(
        app.getAppPath(),
        'frontend/dist/index.html'
      )
      : path.join(
        __dirname,
        '../frontend/dist/index.html'
      );

    mainWindow.loadFile(indexPath);
  }

  mainWindow.once(
    'ready-to-show',
    () => {
      mainWindow.show();
    }
  );

  mainWindow.on(
    'closed',
    () => {
      mainWindow = null;
    }
  );

  setupMenu();
}

/* ---------------------------------------------------------
   MENU
--------------------------------------------------------- */

function setupMenu() {
  const template = [
    {
      label: 'View',

      submenu: [
        {
          role: 'reload',
          accelerator: 'Ctrl+R',
        },

        {
          role: 'forceReload',
          accelerator: 'Ctrl+Shift+R',
        },

        {
          role: 'toggleDevTools',
          accelerator: 'Ctrl+Shift+I',
        },

        {
          type: 'separator',
        },

        {
          role: 'resetZoom',
        },

        {
          role: 'zoomIn',
        },

        {
          role: 'zoomOut',
        },

        {
          type: 'separator',
        },

        {
          role: 'togglefullscreen',
          accelerator: 'F11',
        },
      ],
    },

    {
      label: 'Window',

      submenu: [
        {
          role: 'minimize',
        },

        {
          role: 'close',
        },
      ],
    },
  ];

  const menu =
    Menu.buildFromTemplate(template);

  Menu.setApplicationMenu(menu);
}

/* ---------------------------------------------------------
   SINGLE INSTANCE LOCK
--------------------------------------------------------- */

const gotTheLock =
  app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on(
    'second-instance',
    () => {
      if (mainWindow) {
        if (mainWindow.isMinimized()) {
          mainWindow.restore();
        }

        mainWindow.focus();
      }
    }
  );

  app.whenReady().then(async () => {
    ipcMain.handle(
      'get-app-version',
      () => app.getVersion()
    );

    ipcMain.handle(
      'get-db-path',
      () => dbPath
    );

    ipcMain.handle(
      'check-for-updates',
      async () => {
        return await triggerCheckForUpdates();
      }
    );

    ipcMain.handle(
      'quit-and-install',
      () => {
        try {
          autoUpdater.quitAndInstall();
        } catch (err) {
          console.error('[Updater] quitAndInstall failed:', err);
        }
      }
    );

    await startBackendService();

    createMainWindow();

    // Start checking for updates after the
    // application has started.
    setupAutoUpdater();

    app.on(
      'activate',
      () => {
        if (
          BrowserWindow.getAllWindows()
            .length === 0
        ) {
          createMainWindow();
        }
      }
    );
  });
}

/* ---------------------------------------------------------
   QUIT
--------------------------------------------------------- */

app.on(
  'before-quit',
  () => {
    isQuitting = true;

    stopBackendService();
  }
);

app.on(
  'window-all-closed',
  () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  }
);