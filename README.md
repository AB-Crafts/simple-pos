# Simple POS (Banu Pyala Cafe)

A standalone offline-first Point of Sale desktop application built with **Electron**, **React/Vite**, and an embedded **Node.js/Express SQLite backend**.

---

## Features

- **Standalone Desktop Application**: Bundled via Electron and electron-builder for Linux, Windows, and macOS.
- **Embedded Persistent Database**: High-performance SQLite database (`better-sqlite3` with WAL mode) stored in the OS user data directory.
- **Integrated Service Lifecycle**: Electron automatically manages the backend server as a background service with graceful startup, health checks, and safe database shutdown.
- **Unified Development Workflow**: Single command `npm run dev` boots the backend, Vite dev server, and Electron with live reload.
- **POS & Billing**: Touch/keyboard friendly interface, table orders, cart, sales history, thermal receipt formatting, cash flow, and reports.

---

## Development

Install all workspace dependencies:

```bash
npm install
```

Start the unified development environment (Backend + Frontend + Electron live reload):

```bash
npm run dev
```

### Individual Service Scripts

- **Frontend Dev Server**: `npm run dev:frontend` (starts Vite on http://localhost:5173)
- **Backend Dev Server**: `npm run dev:backend` (starts Express/SQLite on http://localhost:4000)
- **Electron Window**: `npm run dev:electron`

---

## Production Building & Packaging

### 1. Compile Both Frontend and Backend

```bash
npm run build
```

### 2. Package Desktop Application

Create an unpacked local directory build:
```bash
npm run dist:dir
```
The unpacked executable will be generated under `release/linux-unpacked/` (or platform equivalent).

Create production installers / packages (AppImage, deb, nsis, dmg):
```bash
npm run dist
```

---

## Desktop Architecture

```
                               Electron Container
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   Electron Main Process (electron/main.cjs)                                 │
│   ├─ Configures persistent DB path in OS userData folder                    │
│   ├─ Manages embedded Express backend background service                    │
│   └─ Creates BrowserWindow & Native POS Menu (F11 Fullscreen)               │
│                                                                             │
│   Embedded Express Backend (Port 4000)                                      │
│   ├─ Express REST API                                                       │
│   └─ SQLite DB with WAL mode (pos.db in OS userData directory)              │
│                                                                             │
│   Renderer UI (BrowserWindow)                                               │
│   └─ React 18 + Vite (offline-first UI talking to localhost:4000/api)       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Database Location

- **Linux**: `~/.config/BanuPyalaPOS/pos.db` (or `~/.simple-pos/pos.db`)
- **Windows**: `%APPDATA%\BanuPyalaPOS\pos.db`
- **macOS**: `~/Library/Application Support/BanuPyalaPOS/pos.db`
