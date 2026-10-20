/**
 * summary.ts - a month of rows turned into what the screens show.
 *
 * Pure, so both clients compute the same figures from the same rows, and so
 * the one rule that is easy to forget can be tested everywhere it applies: a
 * TRANSFER IS NEVER MONEY IN OR OUT. Moving ₹2,000 from HDFC to your wallet is
 * not spending ₹2,000, and counting it would double-count every rupee you then
 * spend from the wallet. So every function here that adds money up looks at
 * expenses and income only, and transfers appear in lists as one neutral row.
 */
import { categoryDef } from '../../core/categories';
import { formatMoney, parseAmountToMinor } from '../../core/money';
import type { Account, Transaction } from './types';

type Money = Pick<Transaction, 'kind' | 'amount_minor' | 'category'>;

export type CategoryTotal = {
  key: string;
  label: string;
  color: string;
  icon: string;
  totalMinor: number;
  /** 0-1, this category's share of the period's spending. Drives the bar width. */
  share: number;
  count: number;
};

export type PeriodSummary = {
  spentMinor: number;
  earnedMinor: number;
  netMinor: number;
  /** Expenses only, biggest first. Income is not a slice of where it went. */
  categoryTotals: CategoryTotal[];
};

/** Expense total per category. Income and transfers are not spending. */
export function expenseByCategory(rows: Money[]): Map<string, number> {
  const totals = new Map<string, number>();
  rows.forEach((row) => {
    if (row.kind !== 'expense') return;
    totals.set(row.category, (totals.get(row.category) ?? 0) + row.amount_minor);
  });
  return totals;
}

export function summarize(rows: Money[]): PeriodSummary {
  let spentMinor = 0;
  let earnedMinor = 0;
  // A Map preserves insertion order and avoids the prototype-key pitfalls of a
  // bare object used as a dictionary.
  const byCategory = new Map<string, { totalMinor: number; count: number }>();

  rows.forEach((row) => {
    if (row.kind === 'income') earnedMinor += row.amount_minor;
    if (row.kind !== 'expense') return;
    spentMinor += row.amount_minor;
    const current = byCategory.get(row.category) ?? { totalMinor: 0, count: 0 };
    byCategory.set(row.category, {
      totalMinor: current.totalMinor + row.amount_minor,
      count: current.count + 1,
    });
  });

  const categoryTotals: CategoryTotal[] = Array.from(byCategory.entries())
    .map(([key, value]) => {
      const def = categoryDef(key);
      return {
        key,
        label: def.label,
        color: def.color,
        icon: def.icon,
        totalMinor: value.totalMinor,
        // Guard the divide: a month with no spending would give 0/0 = NaN, and
        // NaN in a style width silently breaks the layout.
        share: spentMinor > 0 ? value.totalMinor / spentMinor : 0,
        count: value.count,
      };
    })
    .sort((a, b) => b.totalMinor - a.totalMinor);

  return { spentMinor, earnedMinor, netMinor: earnedMinor - spentMinor, categoryTotals };
}

/** Below this, last period is too small a base for a percentage to mean anything. */
export const SMALL_BASE_MINOR = 50_000; // ₹500

export type Delta =
  | { kind: 'new' }
  | { kind: 'same' }
  | { kind: 'percent'; direction: 'up' | 'down'; percent: number }
  | { kind: 'amount'; direction: 'up' | 'down'; diffMinor: number };

/**
 * This period against the last one.
 *
 * A percentage, except when last period was under ₹500: going from ₹45 to ₹450
 * is "+900%", which is alarming and tells you nothing. Wallet's own help pages
 * document exactly that failure; the rupee difference is the honest figure.
 * Null when both are zero, because "same as September" about nothing at all is
 * noise.
 */
export function compareToPrevious(
  currentMinor: number,
  previousMinor: number,
  smallBaseMinor: number = SMALL_BASE_MINOR,
): Delta | null {
  if (currentMinor === 0 && previousMinor === 0) return null;
  if (previousMinor === 0) return { kind: 'new' };

  const diff = currentMinor - previousMinor;
  if (diff === 0) return { kind: 'same' };
  const direction = diff > 0 ? 'up' : 'down';

  if (previousMinor < smallBaseMinor) return { kind: 'amount', direction, diffMinor: Math.abs(diff) };

  const percent = Math.round((Math.abs(diff) / previousMinor) * 100);
  return percent === 0 ? { kind: 'same' } : { kind: 'percent', direction, percent };
}

/**
 * '+18% vs Sep'. The sign is in the words, so the direction never rests on an
 * arrow's colour; the arrow beside it is a second cue, not the only one.
 */
export function deltaShort(delta: Delta, versus: string): string {
  switch (delta.kind) {
    case 'new':
      return `none in ${versus}`;
    case 'same':
      return `same as ${versus}`;
    case 'percent':
      return `${delta.direction === 'up' ? '+' : '−'}${delta.percent}% vs ${versus}`;
    case 'amount':
      return `${delta.direction === 'up' ? '+' : '−'}${formatMoney(delta.diffMinor, { compact: true })} vs ${versus}`;
  }
}

/** The same, as a sentence a screen reader can say. */
export function deltaSpoken(delta: Delta, versus: string): string {
  switch (delta.kind) {
    case 'new':
      return `none in ${versus}`;
    case 'same':
      return `same as ${versus}`;
    case 'percent':
      return `${delta.percent}% ${delta.direction === 'up' ? 'more' : 'less'} than ${versus}`;
    case 'amount':
      return `${formatMoney(delta.diffMinor, { compact: true })} ${delta.direction === 'up' ? 'more' : 'less'} than ${versus}`;
  }
}

export type ListItem =
  | { type: 'entry'; key: string; tx: Transaction }
  | {
      type: 'transfer';
      key: string;
      groupId: string;
      date: string;
      amountMinor: number;
      note: string;
      /** Null when that half is missing or has no account. */
      fromAccountId: string | null;
      toAccountId: string | null;
      rows: Transaction[];
    };

/**
 * Rows as the list shows them: a transfer's two halves become one item, placed
 * where its first half was.
 *
 * A lone half - its partner deleted elsewhere, or outside the rows fetched - is
 * still shown, as a transfer with an unknown side. Dropping it would hide money
 * that does move a balance.
 */
export function toListItems(rows: Transaction[]): ListItem[] {
  const items: ListItem[] = [];
  const groups = new Map<string, Extract<ListItem, { type: 'transfer' }>>();

  rows.forEach((row) => {
    if (row.kind !== 'transfer' || !row.transfer_group_id) {
      items.push({ type: 'entry', key: row.id, tx: row });
      return;
    }
    let group = groups.get(row.transfer_group_id);
    if (!group) {
      group = {
        type: 'transfer',
        key: `transfer-${row.transfer_group_id}`,
        groupId: row.transfer_group_id,
        date: row.date,
        amountMinor: row.amount_minor,
        note: row.note,
        fromAccountId: null,
        toAccountId: null,
        rows: [],
      };
      groups.set(row.transfer_group_id, group);
      items.push(group);
    }
    group.rows.push(row);
    if (row.transfer_direction === 'out') group.fromAccountId = row.account_id;
    if (row.transfer_direction === 'in') group.toAccountId = row.account_id;
  });

  return items;
}

export type DayGroup = {
  date: string;
  outMinor: number;
  inMinor: number;
  items: ListItem[];
};

/** List items under a header per day, in the order given (newest first from the query). */
export function groupByDay(items: ListItem[]): DayGroup[] {
  const days = new Map<string, DayGroup>();
  items.forEach((item) => {
    const date = item.type === 'entry' ? item.tx.date : item.date;
    let day = days.get(date);
    if (!day) {
      day = { date, outMinor: 0, inMinor: 0, items: [] };
      days.set(date, day);
    }
    day.items.push(item);
    if (item.type === 'entry') {
      if (item.tx.kind === 'expense') day.outMinor += item.tx.amount_minor;
      if (item.tx.kind === 'income') day.inMinor += item.tx.amount_minor;
    }
  });
  return Array.from(days.values());
}

export type DayTotal = { outMinor: number; inMinor: number };

/** Money out and in per day, for the calendar. Days with only transfers are absent. */
export function dayTotals(rows: Pick<Transaction, 'date' | 'kind' | 'amount_minor'>[]): Map<string, DayTotal> {
  const totals = new Map<string, DayTotal>();
  rows.forEach((row) => {
    if (row.kind === 'transfer') return;
    const current = totals.get(row.date) ?? { outMinor: 0, inMinor: 0 };
    if (row.kind === 'expense') current.outMinor += row.amount_minor;
    else current.inMinor += row.amount_minor;
    totals.set(row.date, current);
  });
  return totals;
}

export type SpendLevel = 0 | 1 | 2 | 3 | 4;

/**
 * How strongly to tint each calendar day: 0 for no spending, then four steps
 * measured against the month's typical spending day (the median).
 *
 * Relative rather than fixed rupee bands, because ₹500 is a heavy day for one
 * person and a light one for another. The median, not the mean, so one rent
 * day does not make every other day look light. The amount is always printed
 * in the cell too, so the tint is never the only way to read it.
 */
export function spendLevels(totals: Map<string, DayTotal>): Map<string, SpendLevel> {
  const spending = Array.from(totals.values())
    .map((t) => t.outMinor)
    .filter((v) => v > 0)
    .sort((a, b) => a - b);

  const levels = new Map<string, SpendLevel>();
  if (spending.length === 0) {
    totals.forEach((_, date) => levels.set(date, 0));
    return levels;
  }

  const mid = Math.floor(spending.length / 2);
  const median = spending.length % 2 ? spending[mid] : (spending[mid - 1] + spending[mid]) / 2;

  totals.forEach((total, date) => {
    if (total.outMinor <= 0) return levels.set(date, 0);
    const ratio = total.outMinor / median;
    levels.set(date, ratio <= 0.5 ? 1 : ratio <= 1.25 ? 2 : ratio <= 2.5 ? 3 : 4);
  });
  return levels;
}

/**
 * Rows matching a search, in the order given.
 *
 * Matches the note, the category's label (so "food" finds a row with no
 * note), the account's name, and - when the query reads as an amount - that
 * exact amount, so "250" finds every ₹250. When either half of a transfer
 * matches, both come back, so the list can show the pair as one row.
 */
export function searchTransactions(
  rows: Transaction[],
  query: string,
  accountsById: Map<string, Account>,
): Transaction[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const amount = parseAmountToMinor(needle);

  const matches = (row: Transaction) => {
    if (amount !== null && row.amount_minor === amount) return true;
    const account = row.account_id ? accountsById.get(row.account_id)?.name ?? '' : '';
    const haystack = `${row.note} ${categoryDef(row.category).label} ${account}`.toLowerCase();
    return haystack.includes(needle);
  };

  const groups = new Set<string>();
  rows.forEach((row) => {
    if (row.transfer_group_id && matches(row)) groups.add(row.transfer_group_id);
  });

  return rows.filter((row) =>
    row.transfer_group_id && row.kind === 'transfer' ? groups.has(row.transfer_group_id) : matches(row),
  );
}

/** "23 results · ₹6,480 spent": counted per list item, transfers in the count but not the money. */
export function searchTotals(items: ListItem[]): { count: number; outMinor: number; inMinor: number } {
  let outMinor = 0;
  let inMinor = 0;
  items.forEach((item) => {
    if (item.type !== 'entry') return;
    if (item.tx.kind === 'expense') outMinor += item.tx.amount_minor;
    if (item.tx.kind === 'income') inMinor += item.tx.amount_minor;
  });
  return { count: items.length, outMinor, inMinor };
}
