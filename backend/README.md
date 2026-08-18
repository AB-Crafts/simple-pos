# Backend

Node.js + Express + TypeScript REST API, backed by PostgreSQL.

## Setup

```bash
cp .env.example .env
```

Fill in `.env`:

```
DATABASE_URL=postgres://user:password@localhost:5432/simple_pos
JWT_SECRET=some-long-random-string
PORT=4000
```

`.env` is gitignored — never commit real credentials. `.env.example` stays
in version control with empty placeholders only.

```bash
npm install
npm run migrate   # applies src/database/schema.sql
npm run dev        # starts the API on PORT (default 4000)
```

## Structure

```
src/
  server.ts           Express app entry point, mounts all routes
  database/
    pool.ts           pg connection pool (reads DATABASE_URL — no hardcoded creds)
    schema.sql         table definitions
    migrate.ts          runs schema.sql against DATABASE_URL
  routes/             one file per resource, thin — just wires paths to controllers
  controllers/         parses the request, calls a service, shapes the response
  services/            all business logic and SQL queries live here
  middleware/
    auth.ts             JWT verification + role gating
    errorHandler.ts      centralized error → HTTP response mapping
  models/types.ts       shared TS interfaces, mirroring the frontend's types
```

## Endpoints

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/health` | none | liveness check |
| POST | `/api/auth/register` | none | creates a user, returns a JWT |
| POST | `/api/auth/login` | none | returns a JWT |
| GET | `/api/products` | none | full catalog, needed to bootstrap a fresh device |
| POST | `/api/products` | Owner/Manager | create/update (upsert by id) |
| GET | `/api/categories` | none | |
| POST | `/api/categories` | Owner/Manager | |
| GET | `/api/sales?from&to` | required | epoch-millis range |
| GET | `/api/expenses?from&to` | required | |
| GET | `/api/reports/profit?from&to` | required | sales, expenses, COGS, gross/net profit |
| GET | `/api/reports/money-flow?from&to` | required | cash/card/credit in, expenses/withdrawals out |
| POST | `/api/sync/sale` | none* | body: `{ sale, items }` — called by the frontend's sync engine |
| POST | `/api/sync/expense` | none* | body: an `Expense` |
| POST | `/api/sync/product` | none* | body: a `Product` |

\* The sync endpoints aren't auth-gated yet — in a real multi-device
deployment these should require a device/user token too. Left open for
now since the frontend has no login flow yet either (see root README).

## Idempotency

Every sync upsert is keyed on the record's own `id` (a UUID generated on
the device that created it). Re-sending an already-applied sale or
expense — e.g. because the device retried after a dropped response — is
a safe no-op. This is what makes it safe for the frontend to just retry
on failure without ever risking a double-counted sale.
