/**
 * sheets.js — thin wrapper around the Google Sheets API v4.
 *
 * The service-account credentials are read from environment variables so the
 * JSON key file never has to live on disk in production.
 *
 * Sheet layout expected in the Google Spreadsheet
 * ─────────────────────────────────────────────────
 *  Tab "Transactions"  : Date | Time | Type | Category | Amount | Payment Mode | Notes
 *  Tab "Debts"         : Date | Time | Debt Type | Person Name | Amount | Due Date | Notes
 *  Tab "Wallet"        : Date | Cash Opening | GPay Opening | Bank Opening | Notes
 *  Tab "Summary"       : Date | Total Income | Total Expense | Closing Balance | Notes
 *
 * Every tab must have a header row (row 1).  Data starts at row 2.
 */

import { google } from 'googleapis';

// ── Auth ──────────────────────────────────────────────────────────
function buildAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key   = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

  if (!email || !key) {
    throw new Error(
      'Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_PRIVATE_KEY in .env'
    );
  }

  return new google.auth.JWT(
    email,
    null,
    key,
    ['https://www.googleapis.com/auth/spreadsheets']
  );
}

let _sheets = null;

export function getSheetsClient() {
  if (!_sheets) {
    const auth = buildAuth();
    _sheets    = google.sheets({ version: 'v4', auth });
  }
  return _sheets;
}

export const SPREADSHEET_ID = () => {
  const id = process.env.SPREADSHEET_ID;
  if (!id) throw new Error('SPREADSHEET_ID not set in .env');
  return id;
};

// ── Generic helpers ───────────────────────────────────────────────

/**
 * Read all rows from a named sheet tab.
 * Returns an array of plain objects, keyed by the header row.
 */
export async function readSheet(tabName) {
  const sheets = getSheetsClient();
  const res    = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID(),
    range:         tabName,
  });

  const rows = res.data.values || [];
  if (rows.length < 2) return [];              // only header or empty

  const [headers, ...dataRows] = rows;
  return dataRows.map(row =>
    Object.fromEntries(headers.map((h, i) => [h, row[i] ?? '']))
  );
}

/**
 * Append a single row to a named tab.
 * `rowValues` should be an ordered array matching the sheet's columns.
 */
export async function appendRow(tabName, rowValues) {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId:     SPREADSHEET_ID(),
    range:             `${tabName}!A1`,
    valueInputOption:  'USER_ENTERED',
    insertDataOption:  'INSERT_ROWS',
    requestBody:       { values: [rowValues] },
  });
}

/**
 * Delete a data row by its 1-based row index (row 1 = header).
 * We find the row by matching the first column value (usually Date+Time id).
 */
export async function deleteRowById(tabName, matchColumn, matchValue) {
  const sheets  = getSheetsClient();
  const sid     = SPREADSHEET_ID();

  // Get all values to find the row number
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sid,
    range:         tabName,
  });

  const rows    = res.data.values || [];
  const headers = rows[0] || [];
  const colIdx  = headers.indexOf(matchColumn);
  if (colIdx === -1) throw new Error(`Column "${matchColumn}" not found in ${tabName}`);

  const rowIndex = rows.findIndex((r, i) => i > 0 && r[colIdx] === String(matchValue));
  if (rowIndex === -1) throw new Error(`Row with ${matchColumn}="${matchValue}" not found`);

  // Get the internal sheetId for the tab name
  const meta    = await sheets.spreadsheets.get({ spreadsheetId: sid });
  const sheet   = meta.data.sheets.find(s => s.properties.title === tabName);
  if (!sheet)   throw new Error(`Tab "${tabName}" not found in spreadsheet`);
  const sheetId = sheet.properties.sheetId;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: sid,
    requestBody: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId,
            dimension:  'ROWS',
            startIndex: rowIndex,       // 0-based
            endIndex:   rowIndex + 1,
          },
        },
      }],
    },
  });
}

/**
 * Update a specific cell range within a tab.
 */
export async function updateCells(range, values) {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId:    SPREADSHEET_ID(),
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody:      { values },
  });
}

// ── Date helpers ──────────────────────────────────────────────────

export function nowDate() {
  return new Date().toLocaleDateString('en-IN', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  }).replace(/\//g, '-');   // DD-MM-YYYY
}

export function nowTime() {
  return new Date().toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: true
  }).toUpperCase();
}
