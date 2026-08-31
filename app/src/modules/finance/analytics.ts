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
import { formatMoney } from '../../core/money';
import type { LedgerPoint, TransactionKind } from './types';

/**
 * Everything you have, ever: income minus expense across all transactions.
 *
 * NOT scoped to a month, which is the whole point of it. The month view
 * answers "how am I doing right now"; this answers "what is actually left",
 * and the two disagreeing is normal rather than a bug.
 *
 * WHEN TRANSFERS ARRIVE, this needs a third branch that ignores them. A
 * transfer is money moving between your own accounts, so counting it as either
 * income or expense would double-count every rupee you shuffle around. The
 * kind does not exist yet - migration 0008 would add it and is unapplied - so
 * handling it here would mean widening TransactionKind to a value the database
 * currently rejects, which is worse than leaving the gap documented.
 */
export function runningBalance(points: LedgerPoint[]): number {
  return points.reduce(
    (total, point) =>
      point.kind === 'income' ? total + point.amount_minor : total - point.amount_minor,
    0,
  );
}

export type MonthTotal = {
  /** 'YYYY-MM', which sorts correctly as a string. */
  month: string;
  /** Short label for a chart axis, e.g. 'Aug'. */
  label: string;
  incomeMinor: number;
  expenseMinor: number;
};

/**
 * Income and expense per month, oldest first, for the trend chart.
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
): MonthTotal[] {
  const months: MonthTotal[] = [];

  for (let offset = monthsBack - 1; offset >= 0; offset -= 1) {
    // Day 1 avoids the month-end trap: new Date(2026, 0, 31) minus a month is
    // 3 March, so stepping months from today's day-of-month skips February.
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    months.push({
      month: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      label: date.toLocaleDateString(undefined, { month: 'short' }),
      incomeMinor: 0,
      expenseMinor: 0,
    });
  }

  // Indexed once, so this is a single pass rather than a scan per month.
  const byMonth = new Map(months.map((m) => [m.month, m]));

  points.forEach((point) => {
    // 'YYYY-MM-DD' sliced to 'YYYY-MM'. No Date parsing, so no timezone shift
    // can move a transaction into the neighbouring month.
    const bucket = byMonth.get(point.date.slice(0, 7));
    if (!bucket) return; // outside the window

    if (point.kind === 'income') bucket.incomeMinor += point.amount_minor;
    else if (point.kind === 'expense') bucket.expenseMinor += point.amount_minor;
  });

  return months;
}

// CSV export

/** Column order, and the header row. */
const CSV_COLUMNS = ['date', 'type', 'category', 'note', 'amount'] as const;

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

/**
 * Rows to CSV text.
 *
 * This is the ONE place paise become rupees. Everywhere else in the app the
 * amount is an integer; a spreadsheet expects a decimal, and this is the
 * boundary. Two decimal places always, so the column stays aligned and does
 * not round to something that fails to add up.
 */
export function toCsv(
  rows: { date: string; kind: TransactionKind; category: string; note: string; amount_minor: number }[],
): string {
  const lines = [CSV_COLUMNS.join(',')];

  rows.forEach((row) => {
    lines.push(
      [
        row.date,
        row.kind,
        escapeCsv(row.category),
        escapeCsv(row.note),
        (row.amount_minor / 100).toFixed(2),
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
