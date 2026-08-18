import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { authRoutes } from './routes/auth.routes.js';
import { productsRoutes } from './routes/products.routes.js';
import { categoriesRoutes } from './routes/categories.routes.js';
import { salesRoutes } from './routes/sales.routes.js';
import { expensesRoutes } from './routes/expenses.routes.js';
import { syncRoutes } from './routes/sync.routes.js';
import { reportsRoutes } from './routes/reports.routes.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'simple-pos-backend' }));

app.use('/api/auth', authRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/expenses', expensesRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/reports', reportsRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => {
  console.log(`Simple POS backend listening on http://localhost:${port}`);
});
