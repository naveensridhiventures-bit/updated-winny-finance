import { Router } from 'express';
import { readSheet, appendRow, deleteRowById, nowDate, nowTime } from '../lib/sheets.js';

export const router = Router();

const TAB = 'Debts';

// ── GET /api/debt_dashboard ───────────────────────────────────────
router.get('/debt_dashboard', async (req, res, next) => {
  try {
    const rows = await readSheet(TAB);

    let total_borrowed      = 0;
    let total_repaid        = 0;
    let total_given         = 0;
    let total_received_back = 0;

    // per-person buckets
    const personMap = {};

    for (const r of rows) {
      const amt    = Number(r.Amount) || 0;
      const person = (r['Person Name'] || '').trim();
      const dtype  = (r['Debt Type'] || '').trim();

      if (!personMap[person]) {
        personMap[person] = { borrowed: 0, repaid: 0, given: 0, received_back: 0 };
      }

      switch (dtype) {
        case 'I Borrowed':
          total_borrowed          += amt;
          personMap[person].borrowed += amt;
          break;
        case 'I Repaid':
          total_repaid            += amt;
          personMap[person].repaid += amt;
          break;
        case 'I Gave':
          total_given             += amt;
          personMap[person].given += amt;
          break;
        case 'I Received Back':
          total_received_back           += amt;
          personMap[person].received_back += amt;
          break;
      }
    }

    const balance_to_give    = Math.max(0, total_borrowed - total_repaid);
    const balance_to_collect = Math.max(0, total_given - total_received_back);

    const person_summary = Object.fromEntries(
      Object.entries(personMap).map(([name, p]) => [name, {
        ...p,
        balance_to_give:    Math.max(0, p.borrowed - p.repaid),
        balance_to_collect: Math.max(0, p.given - p.received_back),
      }])
    );

    const recent_debts = [...rows].reverse().slice(0, 20).map(r => ({
      ...r,
      Amount: Number(r.Amount) || 0,
      id: `${r.Date}_${r['Person Name']}_${r.Amount}`,
    }));

    res.json({
      success: true,
      total_borrowed, total_repaid, balance_to_give,
      total_given, total_received_back, balance_to_collect,
      person_summary, recent_debts,
    });
  } catch (err) { next(err); }
});

// ── POST /api/debts ───────────────────────────────────────────────
// Body: { debt_type, person_name, amount, due_date, notes }
router.post('/debts', async (req, res, next) => {
  try {
    const { debt_type, person_name, amount, due_date = '', notes = '' } = req.body;

    if (!debt_type || !person_name || !amount) {
      return res.status(400).json({ error: 'debt_type, person_name, amount are required' });
    }

    const date = nowDate();
    const time = nowTime();

    // Columns: Date | Time | Debt Type | Person Name | Amount | Due Date | Notes
    await appendRow(TAB, [date, time, debt_type, person_name, Number(amount), due_date, notes]);

    res.status(201).json({ success: true, message: 'Debt entry saved' });
  } catch (err) { next(err); }
});

// ── DELETE /api/debts/:id ─────────────────────────────────────────
router.delete('/debts/:id', async (req, res, next) => {
  try {
    const [date, person, amount] = req.params.id.split('_');
    const rows = await readSheet(TAB);
    const row  = rows.find(
      r => r.Date === date && r['Person Name'] === person && String(r.Amount) === amount
    );

    if (!row) return res.status(404).json({ error: 'Debt entry not found' });

    await deleteRowById(TAB, 'Date', date);
    res.json({ success: true, message: 'Deleted' });
  } catch (err) { next(err); }
});
