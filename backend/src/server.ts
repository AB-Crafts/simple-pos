import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { authRoutes } from './routes/auth.routes.js';
import { productsRoutes } from './routes/products.routes.js';
import { categoriesRoutes } from './routes/categories.routes.js';
import { waitersRoutes } from './routes/waiters.routes.js';
import { salesRoutes } from './routes/sales.routes.js';
import { expensesRoutes } from './routes/expenses.routes.js';
import { moneyFlowRoutes } from './routes/moneyFlow.routes.js';
import { reportsRoutes } from './routes/reports.routes.js';
import { settingsRoutes } from './routes/settings.routes.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import './database/db.js'; // Ensures SQLite DB is initialized & seeded

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'simple-pos-backend', database: 'sqlite' }));

app.use('/api/auth', authRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/waiters', waitersRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/expenses', expensesRoutes);
app.use('/api/money-transactions', moneyFlowRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/settings', settingsRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => {
  console.log(`Simple POS backend listening on http://localhost:${port}`);
});
