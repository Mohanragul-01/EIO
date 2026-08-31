/**
 * Finance analytics.
 *
 * The running balance is the highest-risk figure in the app: it is a single
 * number the user will trust, derived from every transaction ever, and a wrong
 * one looks exactly like a right one. The CSV escaping matters for a different
 * reason - an unescaped comma in a note does not crash anything, it silently
 * shifts every column after it.
 */
import {
  exportFilename,
  formatBalance,
  monthlyTotals,
  runningBalance,
  toCsv,
} from '../analytics';
import type { LedgerPoint } from '../types';

const point = (
  date: string,
  kind: LedgerPoint['kind'],
  amount_minor: number,
): LedgerPoint => ({ date, kind, amount_minor });

describe('runningBalance', () => {
  it('is income minus expense', () => {
    expect(
      runningBalance([
        point('2026-01-05', 'income', 5000000),
        point('2026-01-06', 'expense', 129950),
        point('2026-02-01', 'expense', 870050),
      ]),
    ).toBe(5000000 - 129950 - 870050);
  });

  it('is zero for no transactions, not NaN', () => {
    // An empty reduce with no seed throws; with the wrong seed it yields NaN,
    // which would render as "₹NaN" on the home tile.
    expect(runningBalance([])).toBe(0);
  });

  it('goes negative when you have spent more than you received', () => {
    expect(runningBalance([point('2026-01-01', 'expense', 50000)])).toBe(-50000);
  });

  it('stays exact across many values', () => {
    // The whole reason for integer paise: as rupees these would drift.
    const points = Array.from({ length: 1000 }, () => point('2026-01-01', 'expense', 1033));
    expect(runningBalance(points)).toBe(-1033000);
  });

  it('is not scoped to a month', () => {
    // The distinction the UI makes between "Balance" and "This month" only
    // holds if this genuinely spans everything.
    const acrossYears = [
      point('2024-03-01', 'income', 100000),
      point('2025-07-15', 'expense', 30000),
      point('2026-08-30', 'expense', 20000),
    ];
    expect(runningBalance(acrossYears)).toBe(50000);
  });
});

describe('monthlyTotals', () => {
  const now = new Date(2026, 7, 30); // 30 August 2026

  it('returns the requested number of months, oldest first', () => {
    const result = monthlyTotals([], 6, now);
    expect(result).toHaveLength(6);
    expect(result[0].month).toBe('2026-03');
    expect(result[5].month).toBe('2026-08');
  });

  it('keeps empty months as zeroes rather than dropping them', () => {
    // Dropping them would compress the gap and draw a line implying a steady
    // trend across a period when nothing happened.
    const result = monthlyTotals([point('2026-08-02', 'expense', 5000)], 3, now);
    expect(result.map((m) => m.expenseMinor)).toEqual([0, 0, 5000]);
  });

  it('buckets by the date string, with no timezone parsing', () => {
    // Parsing '2026-07-31' as a Date gives UTC midnight, which in a timezone
    // behind UTC lands in June and moves the transaction a month.
    const result = monthlyTotals([point('2026-07-31', 'income', 900)], 3, now);
    const july = result.find((m) => m.month === '2026-07');
    expect(july?.incomeMinor).toBe(900);
  });

  it('ignores transactions outside the window', () => {
    const result = monthlyTotals([point('2020-01-01', 'expense', 999)], 3, now);
    expect(result.every((m) => m.expenseMinor === 0)).toBe(true);
  });

  it('rolls back across a year boundary', () => {
    const january = new Date(2026, 0, 15);
    const result = monthlyTotals([], 3, january);
    expect(result.map((m) => m.month)).toEqual(['2025-11', '2025-12', '2026-01']);
  });
});

describe('toCsv', () => {
  const row = (over: Partial<Parameters<typeof toCsv>[0][number]> = {}) => ({
    date: '2026-08-30',
    kind: 'expense' as const,
    category: 'food',
    note: 'Lunch',
    amount_minor: 24950,
    ...over,
  });

  it('writes a header and converts paise to rupees', () => {
    const csv = toCsv([row()]);
    const [header, line] = csv.trim().split('\n');
    expect(header).toBe('date,type,category,note,amount');
    expect(line).toBe('2026-08-30,expense,food,Lunch,249.50');
  });

  it('always uses two decimal places', () => {
    // A column of 250 and 249.5 does not line up, and 249.5 can be read as a
    // different number by a spreadsheet locale.
    expect(toCsv([row({ amount_minor: 25000 })])).toContain(',250.00');
    expect(toCsv([row({ amount_minor: 5 })])).toContain(',0.05');
  });

  it('quotes notes containing a comma', () => {
    // Unescaped, this shifts every column after it and the file still opens.
    const csv = toCsv([row({ note: 'Coffee, then lunch' })]);
    expect(csv).toContain('"Coffee, then lunch"');
  });

  it('doubles embedded quotes', () => {
    const csv = toCsv([row({ note: 'Said "hello"' })]);
    expect(csv).toContain('"Said ""hello"""');
  });

  it('quotes notes containing a newline', () => {
    const csv = toCsv([row({ note: 'line one\nline two' })]);
    expect(csv).toContain('"line one\nline two"');
  });

  it('leaves ordinary fields unquoted', () => {
    expect(toCsv([row({ note: 'Lunch' })])).not.toContain('"');
  });

  it('produces a header-only file for no rows', () => {
    expect(toCsv([])).toBe('date,type,category,note,amount\n');
  });
});

describe('formatBalance and exportFilename', () => {
  it('shows a minus sign for a negative balance', () => {
    expect(formatBalance(-50000)).toMatch(/^-/);
    expect(formatBalance(50000)).not.toMatch(/^-/);
  });

  it('dates the export file so repeated exports do not collide', () => {
    expect(exportFilename(new Date(2026, 7, 5))).toBe('eio-transactions-2026-08-05.csv');
  });
});
