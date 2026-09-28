/**
 * types.ts - shapes and maths for the B-List.
 *
 * The pure functions at the bottom are the part worth reading: what "progress"
 * means on a list of 818 things, and why it is reported the way it is.
 */

/** What it costs to actually do, not how much you want it. */
export type Cost = 'low' | 'moderate' | 'high';

export const COSTS: Cost[] = ['low', 'moderate', 'high'];

/**
 * The labels from the original list, kept word for word.
 *
 * "No/low cost" and "Big investment" say what the tier MEANS in a way that
 * Low / Medium / High does not: the question is what it takes to do the thing,
 * and those words answer it without needing a legend.
 */
export const COST_LABEL: Record<Cost, string> = {
  low: 'No/low cost',
  moderate: 'Moderate',
  high: 'Big investment',
};

/** Short form, for chips and table cells where the full label will not fit. */
export const COST_SHORT: Record<Cost, string> = {
  low: 'Low',
  moderate: 'Moderate',
  high: 'Big',
};

export type BucketItem = {
  id: string;
  user_id: string;
  category: string;
  title: string;
  cost: Cost;
  is_done: boolean;
  /** The day you did it. Null while undone. */
  done_on: string | null;
  note: string;
  position: number;
  created_at: string;
  updated_at: string;
};

export type BucketInput = {
  category: string;
  title: string;
  cost: Cost;
  note: string;
};

export type BucketProgress = {
  total: number;
  done: number;
  /** Remaining, by what it would cost to do. */
  byCost: Record<Cost, number>;
  /** 0 to 100, rounded. */
  percent: number;
};

/**
 * The headline figures.
 *
 * `byCost` counts what is LEFT rather than everything, because the number that
 * changes your afternoon is "how many free things are still on this list", not
 * how many the list started with. A total that never moves is not progress.
 *
 * Percent is rounded but never rounds UP to 100 while anything is outstanding:
 * 817 of 818 is 99.88%, and showing "100%" next to an unticked item is the kind
 * of small lie that makes you stop trusting the number.
 */
export function progressOf(items: BucketItem[]): BucketProgress {
  const total = items.length;
  const done = items.filter((item) => item.is_done).length;

  const byCost: Record<Cost, number> = { low: 0, moderate: 0, high: 0 };
  items.forEach((item) => {
    if (!item.is_done) byCost[item.cost] += 1;
  });

  // An empty list is 0%, not 100%. `done === total` is true at zero and zero,
  // so the completeness check has to come after the emptiness one - otherwise
  // a brand new list congratulates you for finishing nothing.
  const raw = total === 0 ? 0 : (done / total) * 100;
  const percent = total === 0 ? 0 : done === total ? 100 : Math.min(99, Math.round(raw));

  return { total, done, byCost, percent };
}

/** Every category in use, with how many of each are left. */
export function categorySummary(
  items: BucketItem[],
): { category: string; total: number; done: number }[] {
  const map = new Map<string, { total: number; done: number }>();

  items.forEach((item) => {
    const entry = map.get(item.category) ?? { total: 0, done: 0 };
    entry.total += 1;
    if (item.is_done) entry.done += 1;
    map.set(item.category, entry);
  });

  return [...map.entries()]
    .map(([category, counts]) => ({ category, ...counts }))
    .sort((a, b) => a.category.localeCompare(b.category));
}

/**
 * Does an item match a search?
 *
 * Matches the category as well as the title, so typing "water" finds the whole
 * Water Adventures section rather than only the items with "water" in their
 * name - which on a list this long is usually what you meant.
 */
export function matchesQuery(item: BucketItem, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;

  return (
    item.title.toLowerCase().includes(needle) ||
    item.category.toLowerCase().includes(needle) ||
    item.note.toLowerCase().includes(needle)
  );
}
