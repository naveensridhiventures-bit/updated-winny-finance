import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import { router as authRouter }         from './routes/auth.js';
import { router as transactionsRouter } from './routes/transactions.js';
import { router as debtsRouter }        from './routes/debts.js';
import { router as walletRouter }       from './routes/wallet.js';
import { router as dashboardRouter }    from './routes/dashboard.js';
import { router as summaryRouter }      from './routes/summary.js';
import { authMiddleware }               from './middleware/auth.js';

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ────────────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json());

// ── Public routes ─────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ status: 'running', ts: new Date().toISOString() }));
app.use('/api/auth', authRouter);

// ── Protected routes ──────────────────────────────────────────────
app.use('/api', authMiddleware);
app.use('/api', transactionsRouter);
app.use('/api', debtsRouter);
app.use('/api', walletRouter);
app.use('/api', dashboardRouter);
app.use('/api', summaryRouter);

// ── 404 fallback ──────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// ── Global error handler ──────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[error]', err.message);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`✅  Winny backend running on http://localhost:${PORT}`);
  console.log(`    SPREADSHEET_ID = ${process.env.SPREADSHEET_ID || '(not set)'}`);
});
