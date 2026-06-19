import { Router } from 'express';
import { readSheet } from '../lib/sheets.js';
import { nowDate }   from '../lib/sheets.js';

export const router = Router();

// ── GET /api/dashboard ────────────────────────────────────────────
router.get('/dashboard', async (req, res, next) => {
  try {
    const [txRows, walletRows] = await Promise.all([
      readSheet('Transactions'),
      readSheet('Wallet'),
    ]);

    // ── Today's date string (DD-MM-YYYY) ──────────────────────────
    const today = nowDate();

    // ── Current month prefix (MM-YYYY) ───────────────────────────
    const [dd, mm, yyyy] = today.split('-');
    const monthPrefix    = `${mm}-${yyyy}`;   // e.g. "06-2025"

    // ── Aggregate transactions ────────────────────────────────────
    let today_income    = 0;
    let today_expense   = 0;
    let monthly_income  = 0;
    let monthly_expense = 0;
    const category_totals = {};

    let cash_balance = 0;
    let gpay_balance = 0;
    let bank_balance = 0;

    // Opening balance from latest wallet row
    const latestWallet  = walletRows[walletRows.length - 1] || {};
    cash_balance = Number(latestWallet['Cash Opening'])  || 0;
    gpay_balance = Number(latestWallet['GPay Opening'])  || 0;
    bank_balance = Number(latestWallet['Bank Opening'])  || 0;

    for (const tx of txRows) {
      const amt    = Number(tx.Amount) || 0;
      const type   = (tx.Type     || '').trim();
      const date   = (tx.Date     || '').trim();
      const mode   = (tx['Payment Mode'] || '').trim();
      const cat    = (tx.Category || '').trim();
      const sign   = type === 'Income' ? 1 : -1;

      // Wallet running balance
      if (mode === 'Cash')                              cash_balance += sign * amt;
      else if (['GPay','PhonePe','UPI','Paytm'].includes(mode)) gpay_balance += sign * amt;
      else if (['Bank','Credit Card'].includes(mode))   bank_balance += sign * amt;

      // Today
      if (date === today) {
        if (type === 'Income')  today_income  += amt;
        if (type === 'Expense') today_expense += amt;
      }

      // This month (date ends with mm-yyyy)
      if (date.endsWith(monthPrefix)) {
        if (type === 'Income')  monthly_income  += amt;
        if (type === 'Expense') {
          monthly_expense += amt;
          category_totals[cat] = (category_totals[cat] || 0) + amt;
        }
      }
    }

    const total_available       = cash_balance + gpay_balance + bank_balance;
    const balance               = monthly_income - monthly_expense;
    const savings_percentage    = monthly_income > 0
      ? Math.round((balance / monthly_income) * 100)
      : 0;
    const last_closing_balance  = total_available;

    const danger_message = savings_percentage < 20
      ? '⚠️ High spending this month'
      : '✅ Good financial control';

    const recent_transactions = [...txRows]
      .reverse()
      .slice(0, 30)
      .map(r => ({
        ...r,
        Amount: Number(r.Amount) || 0,
        id: `${r.Date}_${r.Time}_${r.Category}_${r.Amount}`,
      }));

    res.json({
      success: true,
      today_income, today_expense,
      monthly_income, monthly_expense,
      balance, savings_percentage,
      danger_message,
      last_closing_balance,
      wallet: { cash_balance, gpay_balance, bank_balance, total_available },
      category_totals,
      recent_transactions,
    });
  } catch (err) { next(err); }
});
