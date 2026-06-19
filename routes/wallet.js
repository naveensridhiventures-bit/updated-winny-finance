import { Router } from 'express';
import { readSheet, appendRow, nowDate, nowTime } from '../lib/sheets.js';

export const router = Router();

const TAB          = 'Wallet';
const TRANS_TAB    = 'Transactions';

// ── GET /api/wallet ───────────────────────────────────────────────
router.get('/wallet', async (req, res, next) => {
  try {
    const walletRows = await readSheet(TAB);
    const txRows     = await readSheet(TRANS_TAB);

    // Latest opening balance row
    const latest = walletRows[walletRows.length - 1] || {};
    const cash_opening  = Number(latest['Cash Opening'])  || 0;
    const gpay_opening  = Number(latest['GPay Opening'])  || 0;
    const bank_opening  = Number(latest['Bank Opening'])  || 0;

    // Compute running balance from transactions
    let cash_balance = cash_opening;
    let gpay_balance = gpay_opening;
    let bank_balance = bank_opening;

    for (const tx of txRows) {
      const amt  = Number(tx.Amount) || 0;
      const mode = (tx['Payment Mode'] || '').trim();
      const type = (tx.Type           || '').trim();
      const sign = type === 'Income' ? 1 : -1;

      if (mode === 'Cash')                             cash_balance += sign * amt;
      else if (['GPay','PhonePe','UPI','Paytm'].includes(mode)) gpay_balance += sign * amt;
      else if (['Bank','Credit Card'].includes(mode))  bank_balance += sign * amt;
    }

    const total_available = cash_balance + gpay_balance + bank_balance;

    res.json({
      success: true,
      cash_opening, gpay_opening, bank_opening,
      cash_balance, gpay_balance, bank_balance,
      total_available,
    });
  } catch (err) { next(err); }
});

// ── POST /api/wallet/opening ──────────────────────────────────────
// Body: { cash_opening, gpay_opening, bank_opening, notes }
router.post('/wallet/opening', async (req, res, next) => {
  try {
    const { cash_opening = 0, gpay_opening = 0, bank_opening = 0, notes = '' } = req.body;

    const date = nowDate();
    const time = nowTime();

    // Columns: Date | Time | Cash Opening | GPay Opening | Bank Opening | Notes
    await appendRow(TAB, [date, time, Number(cash_opening), Number(gpay_opening), Number(bank_opening), notes]);

    res.status(201).json({ success: true, message: 'Opening balances saved' });
  } catch (err) { next(err); }
});
