/**
 * lived.ts - the Done view as a life rather than a list.
 *
 * A screen of struck-through rows grouped by category answers "how much is
 * left in Water Adventures", which is not what you open the Done view to ask.
 * You open it to see what you did, and when. So done items are grouped by
 * year, then month, newest first, and each year gets a summary: how many, what
 * they cost, which categories, which months.
 *
 * WHERE IMPRECISE DATES GO. A memory dated only "March 2019" is stored as
 * 1 March, and one dated only "2019" as 1 January. Filed by the stored date,
 * every year-only memory would pile into January and every month-only one
 * onto the 1st. So a month-only item sits after that month's dated days, and
 * a year-only item gets a "sometime in the year" group of its own, outside
 * the month strip.
 */
import { categorySummary, COSTS, type BucketItem, type Cost } from './types';
import { partsOf } from './when';

export type LivedMonth = {
  /** 1-12, or null for "sometime that year" (or, in the unknown year, everything). */
  month: number | null;
  items: BucketItem[];
};

export type LivedYear = {
  /** Null for done items with no date at all. */
  year: number | null;
  /** Every item in the year, for its summary. */
  items: BucketItem[];
  months: LivedMonth[];
};

const byTitle = (a: BucketItem, b: BucketItem) => a.title.localeCompare(b.title);

/** Day-precision first, newest day first; month-only after them; titles break ties. */
function compareWithinMonth(a: BucketItem, b: BucketItem): number {
  const aDay = (a.done_precision ?? 'day') === 'day';
  const bDay = (b.done_precision ?? 'day') === 'day';
  if (aDay !== bDay) return aDay ? -1 : 1;
  if (aDay && a.done_on !== b.done_on) return (b.done_on ?? '').localeCompare(a.done_on ?? '');
  return byTitle(a, b);
}

export function livedTimeline(items: BucketItem[]): LivedYear[] {
  const years = new Map<number, Map<number | null, BucketItem[]>>();
  const unknown: BucketItem[] = [];

  items.forEach((item) => {
    if (!item.is_done) return;
    if (!item.done_on) {
      unknown.push(item);
      return;
    }

    const { year, month } = partsOf(item.done_on);
    const slot = item.done_precision === 'year' ? null : month;

    const months = years.get(year) ?? new Map<number | null, BucketItem[]>();
    years.set(year, months);
    const rows = months.get(slot) ?? [];
    months.set(slot, rows);
    rows.push(item);
  });

  const timeline: LivedYear[] = [...years.entries()]
    .sort(([a], [b]) => b - a)
    .map(([year, months]) => {
      const ordered = [...months.entries()]
        // Months newest first, and "sometime this year" after all of them.
        .sort(([a], [b]) => (a === null ? 1 : b === null ? -1 : b - a))
        .map(([month, rows]) => ({ month, items: [...rows].sort(compareWithinMonth) }));

      return { year, items: ordered.flatMap((m) => m.items), months: ordered };
    });

  if (unknown.length > 0) {
    const rows = [...unknown].sort(byTitle);
    timeline.push({ year: null, items: rows, months: [{ month: null, items: rows }] });
  }

  return timeline;
}

export type YearSummary = {
  count: number;
  byCost: Record<Cost, number>;
  /** Items per month, January first. Year-only items are in none of them. */
  months: number[];
  /** The month strip's shading, 0-4. */
  levels: number[];
  /** Done that year, month unknown. */
  sometime: number;
  topCategories: { category: string; count: number }[];
  categoriesTouched: number;
};

export function summariseYear(items: BucketItem[]): YearSummary {
  const byCost = Object.fromEntries(COSTS.map((c) => [c, 0])) as Record<Cost, number>;
  const months = new Array<number>(12).fill(0);
  let sometime = 0;

  items.forEach((item) => {
    byCost[item.cost] += 1;
    if (!item.done_on || item.done_precision === 'year') {
      sometime += 1;
      return;
    }
    months[partsOf(item.done_on).month - 1] += 1;
  });

  // categorySummary already counts per category; most first, then by name so
  // a tie does not reshuffle every time the list reloads.
  const categories = categorySummary(items)
    .map(({ category, total }) => ({ category, count: total }))
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));

  return {
    count: items.length,
    byCost,
    months,
    levels: monthLevels(months),
    sometime,
    topCategories: categories.slice(0, 3),
    categoriesTouched: categories.length,
  };
}

/**
 * Shade each month 0-4 against the busiest one.
 *
 * Rounded UP, so a month with one thing in it is never drawn like a month
 * with nothing: next to a 40-item month, 1 would round to 0 and the strip
 * would say you did nothing that month, which is false.
 */
export function monthLevels(counts: number[]): number[] {
  const max = Math.max(0, ...counts);
  if (max === 0) return counts.map(() => 0);
  return counts.map((count) => (count === 0 ? 0 : Math.ceil((count / max) * 4)));
}
