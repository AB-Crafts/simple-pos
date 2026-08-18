# Simple POS

An offline-first Point of Sale PWA. Simple on the outside
(Products → Cart → Payment → Complete Sale), sophisticated underneath
(local database, sync queue, REST API, PostgreSQL, auth, hardware hooks).

All 12 phases from the original spec are now built.

## What's included

**Frontend (offline-first, works with zero backend running)**
- React + TypeScript + Vite, installable PWA (service worker, manifest, offline caching)
- Dexie.js / IndexedDB — every read/write happens locally first; the app
  never waits on the network to complete a sale
- POS screen: large product buttons, live cart, Cash/Card/Credit, cash change
- Barcode scanner support: any USB/Bluetooth "keyboard wedge" scanner just
  works — scan a barcode and the matching product is added to the cart
- Products page: add / edit / deactivate / search
- Sales history, with a "print receipt" action (plain-text formatter,
  ready to wire into a real thermal printer later)
- Expenses page: description, amount, category, payment method, notes
- Money Flow page: today's cash/card/credit sales, expenses, withdrawals,
  net cash flow — explicitly **not** the same thing as profit
- Reports page: Today / This Week / This Month / Custom date range —
  total sales, total expenses, cost of goods sold, gross profit, net profit
- Money always handled as integer paisa — never floating-point currency math
- Background sync engine: pushes queued sales/expenses/products to the
  backend whenever a connection is available, retries failures, never
  blocks the UI. Connection indicator shows ONLINE ✓ / OFFLINE / SYNCING... /
  SYNCED ✓ / SYNC ERROR

**Backend**
- Node.js + Express + TypeScript, REST API under `/api/*`
- PostgreSQL schema mirroring the frontend's local schema (money as
  `BIGINT` paisa, timestamps as epoch-millis for direct comparability)
- Layered structure: `routes/` → `controllers/` → `services/` (business
  logic never lives in route handlers)
- `/api/sync/:entity` — idempotent upsert endpoints (keyed on the
  record's own id) that the frontend's sync engine calls; safe to retry
- `/api/products`, `/api/categories`, `/api/sales`, `/api/expenses`,
  `/api/reports/profit`, `/api/reports/money-flow`
- JWT-based auth (`/api/auth/register`, `/api/auth/login`) with
  Owner/Manager/Cashier roles, kept intentionally minimal per the spec —
  no refresh tokens or session management yet
- All secrets (`DATABASE_URL`, `JWT_SECRET`) come from `backend/.env`
  (gitignored) — never hardcoded, never sent to the frontend

## Running it

### Frontend only (fully usable — this is the primary way to use the app)

```bash
cd frontend
npm install
npm run dev
```

Open the printed local URL. To test offline behavior: load the app once
online (so the service worker + assets cache), then disconnect and reload —
everything keeps working, and anything you create persists in IndexedDB.
No backend needs to be running for any of this.

### Backend (optional — only needed for cross-device sync)

```bash
cd backend
cp .env.example .env   # fill in DATABASE_URL and a JWT_SECRET
npm install
npm run migrate        # creates tables in your Postgres database
npm run dev
```

Then, in `frontend/.env` (copy from `frontend/.env.example`), point
`VITE_API_URL` at the backend if it's not on `http://localhost:4000/api`.
With the backend running and the frontend online, queued sales/expenses
sync automatically in the background.

## Architecture

```
USER
 ↓
React PWA  (src/pages, src/components)
 ↓
Local IndexedDB via Dexie (src/database/db.ts)
 ↓
Offline operation — every sale/expense completes here, always

When online:

React PWA → services/syncService.ts → services/apiClient.ts
 ↓
REST API (backend/src/routes → controllers → services)
 ↓
PostgreSQL (backend/src/database/pool.ts)
```

The frontend never talks to Postgres directly — only `apiClient.ts` calls
the backend, and only over REST endpoints. No secret ever ships in the
frontend bundle.

## What's intentionally still light

Per the original spec's own instruction not to overbuild V1:

- **Auth** has no frontend login screen yet (backend is ready for one) —
  the offline POS itself needs no login to ring up a sale
- **Hardware**: barcode scanning works now; a receipt *printer* has a
  ready-made text formatter (`utils/receipt.ts`) but prints via the
  browser's print dialog rather than a native driver; a cash drawer
  (typically opened via the receipt printer's own trigger command) isn't
  wired up — there's nothing to test it against without real hardware
