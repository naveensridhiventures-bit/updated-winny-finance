import { Router } from 'express';
import { appendRow, nowDate, nowTime } from '../lib/sheets.js';

export const router = Router();

// ── POST /api/summary ─────────────────────────────────────────────
// Body: { total_income, total_expense, closing_balance, notes }
router.post('/summary', async (req, res, next) => {
  try {
    const {
      total_income     = 0,
      total_expense    = 0,
      closing_balance  = 0,
      notes            = '',
    } = req.body;

    const date = nowDate();
    const time = nowTime();

    // Columns: Date | Time | Total Income | Total Expense | Closing Balance | Notes
    await appendRow('Summary', [
      date, time,
      Number(total_income),
      Number(total_expense),
      Number(closing_balance),
      notes,
    ]);

    res.status(201).json({ success: true, message: 'Daily summary saved' });
  } catch (err) { next(err); }
});
