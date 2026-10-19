/**
 * analytics.ts - the figures, as pure functions.
 *
 * Deliberately separate from api.ts. These take rows and return numbers, with
 * no network, no clock beyond what is passed in, and no React. That is what
 * makes the running balance testable: the thing most likely to be quietly
 * wrong is arithmetic, and arithmetic is exactly what is cheap to test when it
 * is not tangled up with a query.
 *
 * Everything here works in integer paise. See core/money.ts for why.
 */
import { toISODate } from '../../core/date';
import { formatMoney } from '../../core/money';
import { periodOf, recentPeriods, shortMonth } from './period';
import type { LedgerPoint, TransactionKind, TransferDirection } from './types';

/**
 * Income minus expense across all transactions, ever.
 *
 * Transfers are ignored: they move money between your own accounts, so
 * counting either half would double-count every rupee you shuffle around. A
 * lone half (its partner deleted elsewhere) is ignored for the same reason.
 *
 * The headline balance is accounts.netBalance now, which adds opening balances
 * to this; this stays as the figure with no accounts involved.
 */
export function runningBalance(points: LedgerPoint[]): number {
  return points.reduce((total, point) => {
    if (point.kind === 'income') return total + point.amount_minor;
    if (point.kind === 'expense') return total - point.amount_minor;
    return total;
  }, 0);
}

export type MonthTotal = {
  /** 'YYYY-MM' of the finance month, which sorts correctly as a string. */
  month: string;
  /** Short label for a chart axis, e.g. 'Aug'. */
  label: string;
  incomeMinor: number;
  expenseMinor: number;
};

/**
 * Income and expense per finance month, oldest first, for the trend chart.
 *
 * With a month that starts on a salary day, each bar is that period, not the
 * calendar month (see period.ts), so the trend agrees with the totals above it.
 *
 * Months with no transactions are INCLUDED as zeroes. Skipping them would
 * compress the gap and draw a line that implies a steady trend across a period
 * when nothing happened at all, which is a chart that lies.
 *
 * `now` is a parameter rather than being read inside, so the tests do not need
 * a clock fixture and do not break in January.
 */
export function monthlyTotals(
  points: LedgerPoint[],
  monthsBack: number,
  now: Date = new Date(),
  startDay = 1,
): MonthTotal[] {
  const key = (p: { year: number; month: number }) => `${p.year}-${String(p.month).padStart(2, '0')}`;

  const months: MonthTotal[] = recentPeriods(periodOf(toISODate(now), startDay), monthsBack).map(
    (period) => ({ month: key(period), label: shortMonth(period), incomeMinor: 0, expenseMinor: 0 }),
  );

  // Indexed once, so this is a single pass rather than a scan per month.
  const byMonth = new Map(months.map((m) => [m.month, m]));

  points.forEach((point) => {
    // From the 'YYYY-MM-DD' string, never a parsed Date, so no timezone shift
    // can move a transaction into the neighbouring month.
    const bucket = byMonth.get(key(periodOf(point.date, startDay)));
    if (!bucket) return; // outside the window

    if (point.kind === 'income') bucket.incomeMinor += point.amount_minor;
    else if (point.kind === 'expense') bucket.expenseMinor += point.amount_minor;
  });

  return months;
}

// CSV export

/** Column order, and the header row. */
const CSV_COLUMNS = ['date', 'type', 'category', 'note', 'amount', 'account'] as const;

/**
 * Escape one CSV field.
 *
 * A note is free text, so it can and will contain commas, quotes and newlines.
 * Any of those unescaped produces a file that opens in a spreadsheet with the
 * columns silently shifted, which is worse than failing outright because it
 * looks fine until you read it.
 */
function escapeCsv(value: string): string {
  if (!/[",\n\r]/.test(value)) return value;
  // Double the quotes, wrap the whole field: the RFC 4180 rule.
  return `"${value.replace(/"/g, '""')}"`;
}

export type CsvRow = {
  date: string;
  kind: TransactionKind;
  category: string;
  note: string;
  amount_minor: number;
  account_id: string | null;
  transfer_direction: TransferDirection | null;
};

/**
 * Rows to CSV text.
 *
 * This is the ONE place paise become rupees. Everywhere else in the app the
 * amount is an integer; a spreadsheet expects a decimal, and this is the
 * boundary. Two decimal places always, so the column stays aligned and does
 * not round to something that fails to add up.
 *
 * A transfer's halves are typed "transfer out" and "transfer in", so a
 * spreadsheet that sums the expense rows never picks them up by accident.
 */
export function toCsv(rows: CsvRow[], accountName: (id: string) => string = () => ''): string {
  const lines = [CSV_COLUMNS.join(',')];

  rows.forEach((row) => {
    const type = row.kind === 'transfer' ? `transfer ${row.transfer_direction ?? ''}`.trim() : row.kind;
    lines.push(
      [
        row.date,
        type,
        escapeCsv(row.category),
        escapeCsv(row.note),
        (row.amount_minor / 100).toFixed(2),
        escapeCsv(row.account_id ? accountName(row.account_id) : ''),
      ].join(','),
    );
  });

  // Trailing newline: some tools treat a file without one as truncated.
  return `${lines.join('\n')}\n`;
}

/** Filename for an export, dated so repeated exports do not overwrite. */
export function exportFilename(now: Date = new Date()): string {
  const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate(),
  ).padStart(2, '0')}`;
  return `eio-transactions-${stamp}.csv`;
}

/** Balance formatted for display, with an explicit sign when negative. */
export function formatBalance(minor: number): string {
  const formatted = formatMoney(Math.abs(minor), { compact: true });
  return minor < 0 ? `-${formatted}` : formatted;
}
