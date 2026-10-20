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

/**
 * How much you want it now, kept apart from cost on purpose: cost answers "can
 * I afford it", this answers "am I actually going to do it". Stored as null for
 * Someday, which is where everything starts.
 */
export type Focus = 'now' | 'next';
export type Want = Focus | 'someday';

export const WANTS: Want[] = ['now', 'next', 'someday'];

export const WANT_LABEL: Record<Want, string> = {
  now: 'Now',
  next: 'Next',
  someday: 'Someday',
};

/** Would you do it again? */
export type Again = 'yes' | 'maybe' | 'no';

export const AGAINS: Again[] = ['yes', 'maybe', 'no'];

export const AGAIN_LABEL: Record<Again, string> = {
  yes: 'Yes',
  maybe: 'Maybe',
  no: 'No',
};

/**
 * How precisely a date is known. "2019", "March 2019" and "14 March 2019" are
 * different claims, and a year stored as 1 January must never be shown as one.
 */
export type Precision = 'year' | 'month' | 'day';

export type BucketItem = {
  id: string;
  user_id: string;
  category: string;
  title: string;
  cost: Cost;
  is_done: boolean;
  /** The day you did it. Null while undone. */
  done_on: string | null;
  /** How precisely done_on is known. Null on rows ticked before v3: a day. */
  done_precision: Precision | null;
  note: string;

  /** What happened, in your own words. */
  memory: string;
  place: string;
  again: Again | null;

  /** Pick for me skips the item until this day has passed. */
  snoozed_until: string | null;
  /** Null is Someday. */
  focus: Focus | null;

  /** A target with its precision: both set, or neither. */
  target_on: string | null;
  target_precision: Precision | null;
  /** Paise. Null until you estimate it. */
  est_cost_minor: number | null;
  /** Paise saved towards it so far. */
  saved_minor: number;

  position: number;
  created_at: string;
  updated_at: string;
};

/** One step of a planned item's checklist. */
export type BucketStep = {
  id: string;
  user_id: string;
  item_id: string;
  title: string;
  is_done: boolean;
  position: number;
  created_at: string;
  updated_at: string;
};

/**
 * The three columns a tick writes, together.
 *
 * Kept as one value so Undo can put back exactly what was there - including a
 * backdated date and its precision - rather than "undone", which would lose a
 * memory's date if you unticked by mistake and undid it.
 */
export type DoneState = {
  is_done: boolean;
  done_on: string | null;
  done_precision: Precision | null;
};

export const UNDONE: DoneState = { is_done: false, done_on: null, done_precision: null };

/** A tick: done today, to the day. */
export function tickedState(today: string): DoneState {
  return { is_done: true, done_on: today, done_precision: 'day' };
}

export function doneStateOf(item: BucketItem): DoneState {
  if (!item.is_done) return { is_done: false, done_on: item.done_on, done_precision: null };
  // Rows ticked before v3 carry no precision; every one of those was a tick on
  // a real day.
  return { is_done: true, done_on: item.done_on, done_precision: item.done_precision ?? 'day' };
}

export function wantOf(item: BucketItem): Want {
  return item.focus ?? 'someday';
}

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

  // Memory and place too: "Goa" should find what you did in Goa, not only
  // what is named after it.
  return (
    item.title.toLowerCase().includes(needle) ||
    item.category.toLowerCase().includes(needle) ||
    item.note.toLowerCase().includes(needle) ||
    item.memory.toLowerCase().includes(needle) ||
    item.place.toLowerCase().includes(needle)
  );
}
