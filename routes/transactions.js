import { Router } from 'express';
import { readSheet, appendRow, deleteRowById, nowDate, nowTime } from '../lib/sheets.js';

export const router = Router();

const TAB = 'Transactions';

// ── GET /api/transactions ─────────────────────────────────────────
// Query params: type, category, search, limit (default 200)
router.get('/transactions', async (req, res, next) => {
  try {
    let rows = await readSheet(TAB);

    const { type, category, search, limit = 200 } = req.query;

    if (type)     rows = rows.filter(r => r.Type === type);
    if (category) rows = rows.filter(r => r.Category === category);
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(r =>
        (r.Category || '').toLowerCase().includes(q) ||
        (r.Notes    || '').toLowerCase().includes(q) ||
        (r['Payment Mode'] || '').toLowerCase().includes(q)
      );
    }

    // Newest first
    rows.reverse();

    // Attach a stable id = original 1-based row index for deletion
    const withIds = rows.slice(0, Number(limit)).map((r, i) => ({
      id: `${r.Date}_${r.Time}_${r.Category}_${r.Amount}`,
      ...r,
      Amount: Number(r.Amount) || 0,
    }));

    res.json({ success: true, data: withIds, total: withIds.length });
  } catch (err) { next(err); }
});

// ── POST /api/transactions ────────────────────────────────────────
// Body: { type, category, amount, payment_mode, notes }
router.post('/transactions', async (req, res, next) => {
  try {
    const { type, category, amount, payment_mode, notes = '' } = req.body;

    if (!type || !category || !amount || !payment_mode) {
      return res.status(400).json({ error: 'type, category, amount, payment_mode are required' });
    }

    const date = nowDate();
    const time = nowTime();

    // Columns: Date | Time | Type | Category | Amount | Payment Mode | Notes
    await appendRow(TAB, [date, time, type, category, Number(amount), payment_mode, notes]);

    res.status(201).json({ success: true, message: 'Transaction saved' });
  } catch (err) { next(err); }
});

// ── PUT /api/transactions/:id ─────────────────────────────────────
// Not supported via Sheet row key — return 501 with helpful message
router.put('/transactions/:id', (_req, res) => {
  res.status(501).json({
    error: 'In-place edit is not supported for Google Sheets. Delete and re-add the transaction.',
  });
});

// ── DELETE /api/transactions/:id ──────────────────────────────────
// id format: "DD-MM-YYYY_HH:MM AM_Category_Amount"
router.delete('/transactions/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // id is composite — we need to find the row that matches Date+Time+Category+Amount
    const [date, time, category, amount] = id.split('_');
    const rows = await readSheet(TAB);
    const row  = rows.find(
      r => r.Date === date && r.Time === time && r.Category === category && String(r.Amount) === amount
    );

    if (!row) return res.status(404).json({ error: 'Transaction not found' });

    // Use Date as the match column (unique enough with time)
    await deleteRowById(TAB, 'Date', date);

    res.json({ success: true, message: 'Deleted' });
  } catch (err) { next(err); }
});
