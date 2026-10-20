/**
 * types.ts - shapes and projections for the product tracker.
 *
 * The projection at the bottom is the whole reason this module exists: how
 * long will this last, and when should I reorder. Everything else is storage.
 */

export type Product = {
  id: string;
  user_id: string;
  name: string;
  category: string;
  /** Free text - g, ml, capsules, sprays. Only ever displayed. */
  unit: string;
  total_quantity: number;
  /** How much one use consumes. Null when you never measured it. */
  per_use: number | null;
  /** Paise, like every other amount of money in this app. */
  price_minor: number | null;
  /**
   * Null for a SPARE: bought, not opened yet. Its clock - the measured rate,
   * the period after opening - has not started.
   */
  opened_on: string | null;
  /** Set when it runs out. A finished product is kept, not deleted. */
  finished_on: string | null;
  note: string;
  /**
   * The container this one replaced, when it was started from "Start a new
   * one" or "Add a spare". Its lifespan is this one's first estimate.
   */
  previous_id: string | null;
  /** The printed expiry date. */
  expires_on: string | null;
  /** Period after opening, in months: the open-jar "12M" on the pack. */
  pao_months: number | null;
  /** Days before it runs out to reorder. Null means DEFAULT_LEAD_DAYS. */
  reorder_lead_days: number | null;
  created_at: string;
  updated_at: string;
};

export type ProductInput = {
  name: string;
  category: string;
  unit: string;
  total_quantity: number;
  per_use: number | null;
  price_minor: number | null;
  opened_on: string | null;
  note: string;
  expires_on: string | null;
  pao_months: number | null;
  reorder_lead_days: number | null;
  /** Only set when starting a container from another one. */
  previous_id?: string | null;
};

/**
 * Days before running out at which "Reorder now" begins, when a product does
 * not say. A week is the point at which ordering today still arrives in time.
 */
export const DEFAULT_LEAD_DAYS = 7;

/** "Running low" begins this many days before "Reorder now". */
export const LOW_BUFFER_DAYS = 14;

export function leadDaysOf(product: Pick<Product, 'reorder_lead_days'>): number {
  return product.reorder_lead_days ?? DEFAULT_LEAD_DAYS;
}

export type ProductUse = {
  id: string;
  product_id: string;
  user_id: string;
  used_on: string;
  quantity: number;
  note: string;
  created_at: string;
};

export const PRODUCT_CATEGORIES = [
  'supplement',
  'skincare',
  'haircare',
  'hygiene',
  'household',
  'other',
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export const CATEGORY_LABEL: Record<string, string> = {
  supplement: 'Supplements',
  skincare: 'Skincare',
  haircare: 'Haircare',
  hygiene: 'Hygiene',
  household: 'Household',
  other: 'Other',
};

/** Common units, offered as shortcuts. The field still accepts anything. */
export const UNITS = ['g', 'ml', 'capsules', 'sprays', 'uses', 'sheets'] as const;

export type Projection = {
  used: number;
  remaining: number;
  /** 0 to 100 of the container consumed. */
  percentUsed: number;
  /** Average consumed per day, measured rather than assumed. Null if unknown. */
  dailyRate: number | null;
  /** Whole days of supply left at the measured rate. Null if not yet knowable. */
  daysLeft: number | null;
  /** 'YYYY-MM-DD' the container is projected to empty. */
  emptyOn: string | null;
  /** Paise per day, for the things worth knowing that about. */
  costPerDay: number | null;
  /**
   * How many days it has been open, counting the opening day, up to today or
   * to the day it was finished. At least 1 once opened; 0 for a spare.
   */
  daysOpen: number;
  /** The days the rate is measured over; 0 while there is no rate. */
  measuredDays: number;
};

/**
 * Days with a use logged before an open container's pace counts. Reminders
 * are planned from it, so one scoop is not a pace: three days of use is the
 * least that tells a daily habit from a twice-a-week one.
 */
export const MIN_USE_DAYS = 3;

/** Whole days between two calendar dates, ignoring time and timezone. */
export function daysBetween(fromISO: string, toISO: string): number {
  const [fy, fm, fd] = fromISO.split('-').map(Number);
  const [ty, tm, td] = toISO.split('-').map(Number);
  // Local dates, so a timezone cannot shift the answer by a day.
  const from = new Date(fy, fm - 1, fd);
  const to = new Date(ty, tm - 1, td);
  return Math.round((to.getTime() - from.getTime()) / 86400000);
}

/** A calendar date moved by whole days, built from (y, m, d) so DST cannot shift it. */
export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * How long this will last.
 *
 * THE RATE IS MEASURED, NOT ASSUMED. It would be easier to compute
 * total / per_use and call that the number of uses left, but that answers a
 * different question - how many uses remain if you never miss a day - and days
 * get missed. Dividing what you have ACTUALLY used by the days it has been
 * in use gives a rate that already accounts for the days you skipped, so the
 * projection degrades gracefully rather than being permanently optimistic.
 *
 * `per_use` is therefore not needed for the projection at all. It exists to
 * pre-fill the amount when you log a use, so logging is one tap.
 *
 * Nothing is projected from thin evidence. One use on the first day implies a
 * rate of one-per-day, which for a product you use twice a week would predict
 * an empty bottle three times too soon - and a confident wrong number is worse
 * than "not enough data yet". So an open container needs uses on
 * MIN_USE_DAYS different days, and until then the previous container's
 * lifespan (outlook.ts) stands in.
 *
 * AN OPEN CONTAINER IS MEASURED FROM ITS FIRST LOGGED USE. Days before it
 * are not days of nothing used, they are days not logged: a tub added with
 * its true opened date weeks back and a first log today spread one scoop
 * over all those weeks and projected 2004 days. Days since the LAST use do
 * count, since by then logging had begun. A finished container is history,
 * not a forecast, and keeps its whole life: opened to finished.
 */
export function project(
  product: Product,
  uses: Pick<ProductUse, 'quantity' | 'used_on'>[],
  today: string,
): Projection {
  const used = uses.reduce((total, use) => total + use.quantity, 0);
  const remaining = Math.max(0, product.total_quantity - used);
  const percentUsed =
    product.total_quantity === 0
      ? 0
      : Math.min(100, Math.round((used / product.total_quantity) * 100));

  // A spare has not started emptying, so there is nothing to measure yet.
  if (!product.opened_on) {
    return {
      used,
      remaining,
      percentUsed,
      dailyRate: null,
      daysLeft: null,
      emptyOn: null,
      costPerDay: null,
      daysOpen: 0,
      measuredDays: 0,
    };
  }

  // A finished container's life ended when it was finished. Counting to today
  // instead made "Lasted 10 days" grow every day the card was looked at, and
  // diluted its measured rate with days it was not even in use.
  const end = product.finished_on ?? today;

  // At least 1, so a product opened today never divides by zero.
  const daysOpen = Math.max(1, daysBetween(product.opened_on, end) + 1);

  // Something actually used, always - a rate of zero would project an
  // infinite lifespan.
  let measuredDays = 0;
  if (product.finished_on) {
    if (daysOpen >= 2 && used > 0) measuredDays = daysOpen;
  } else {
    const useDays = [...new Set(uses.map((use) => use.used_on))].sort();
    if (useDays.length >= MIN_USE_DAYS && used > 0) {
      // A use dated before the opening (a typing slip) does not stretch it.
      const from = useDays[0] > product.opened_on ? useDays[0] : product.opened_on;
      measuredDays = Math.max(1, daysBetween(from, end) + 1);
    }
  }
  const dailyRate = measuredDays > 0 ? used / measuredDays : null;

  // Days left only for something still in use with something left in it. A
  // finished container keeps its rate - it is what it actually used a day -
  // but it has no future to project.
  const daysLeft =
    dailyRate !== null && remaining > 0 && !product.finished_on
      ? Math.floor(remaining / dailyRate)
      : null;
  const emptyOn = daysLeft === null ? null : addDays(today, daysLeft);

  const costPerDay =
    product.price_minor === null || dailyRate === null || product.total_quantity === 0
      ? null
      : Math.round((product.price_minor / product.total_quantity) * dailyRate);

  return {
    used,
    remaining,
    percentUsed,
    dailyRate,
    daysLeft,
    emptyOn,
    costPerDay,
    daysOpen,
    measuredDays,
  };
}

/**
 * How urgently this needs replacing.
 *
 * Thresholds rather than a raw number, because "7 days left" only means
 * something once you know how long delivery takes - which is what the
 * product's lead time says. "Reorder now" starts at the lead time, "Running
 * low" two weeks before that. At the default week that is 7 and 21 days,
 * exactly the bands v2 always had.
 */
export type Urgency = 'finished' | 'unopened' | 'critical' | 'soon' | 'ok' | 'unknown';

export function urgencyOf(
  product: Pick<Product, 'finished_on' | 'opened_on' | 'reorder_lead_days'>,
  projection: Pick<Projection, 'remaining' | 'daysLeft'>,
): Urgency {
  if (product.finished_on) return 'finished';
  if (!product.opened_on) return 'unopened';
  if (projection.remaining <= 0) return 'critical';
  if (projection.daysLeft === null) return 'unknown';

  const lead = leadDaysOf(product);
  if (projection.daysLeft <= lead) return 'critical';
  if (projection.daysLeft <= lead + LOW_BUFFER_DAYS) return 'soon';
  return 'ok';
}

export const URGENCY_LABEL: Record<Urgency, string> = {
  finished: 'Finished',
  unopened: 'Not opened',
  critical: 'Reorder now',
  soon: 'Running low',
  ok: 'Plenty left',
  unknown: 'Not enough data',
};

/** One calendar day of use. */
export type UsageDay = {
  /** 'YYYY-MM-DD'. */
  date: string;
  /** Total quantity used that day. */
  total: number;
  /** How many separate uses were logged. */
  count: number;
};

/**
 * The last `days` days, oldest first, ending today.
 *
 * Days with nothing logged are INCLUDED, as zeros. The gaps are the point:
 * "did I forget yesterday?" is answered by seeing an empty day, and tapping
 * that empty day is how a missed use gets backfilled. A list of only the days
 * with entries would hide exactly the days you are looking for.
 */
export function recentDays(
  uses: Pick<ProductUse, 'used_on' | 'quantity'>[],
  today: string,
  days = 14,
): UsageDay[] {
  const byDate = new Map<string, UsageDay>();
  for (let i = days - 1; i >= 0; i--) {
    const date = addDays(today, -i);
    byDate.set(date, { date, total: 0, count: 0 });
  }

  uses.forEach((use) => {
    const day = byDate.get(use.used_on);
    if (!day) return;
    day.total += use.quantity;
    day.count += 1;
  });

  return [...byDate.values()];
}

/**
 * Uses grouped under their day, newest day first.
 *
 * Within a day the order the uses arrived in is kept. Morning and evening
 * face wash are two uses on one day, and they read as one day's line with a
 * total, not as two unrelated rows.
 */
export function groupByDay<T extends Pick<ProductUse, 'used_on' | 'quantity'>>(
  uses: T[],
): { date: string; total: number; uses: T[] }[] {
  const groups = new Map<string, { date: string; total: number; uses: T[] }>();

  uses.forEach((use) => {
    const group = groups.get(use.used_on) ?? { date: use.used_on, total: 0, uses: [] };
    group.total += use.quantity;
    group.uses.push(use);
    groups.set(use.used_on, group);
  });

  return [...groups.values()].sort((a, b) => b.date.localeCompare(a.date));
}

/** A human span: "12 days", "about 2 months". */
export function formatDaysLeft(days: number | null): string {
  if (days === null) return 'Unknown';
  if (days <= 0) return 'Empty';
  if (days === 1) return '1 day';
  if (days < 45) return `${days} days`;

  const months = Math.round(days / 30);
  return `about ${months} month${months === 1 ? '' : 's'}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * "3 Nov", or "3 Jan 2027" when the year is not today's. Day first, with
 * fixed month names rather than the phone's locale, because it is also baked
 * into notification text at scheduling time and must read the same on every
 * device - and in the tests.
 */
export function formatDayMonth(iso: string, today?: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  const base = `${day} ${MONTHS[month - 1]}`;
  return today && today.slice(0, 4) !== iso.slice(0, 4) ? `${base} ${year}` : base;
}

/**
 * Trims trailing zeroes: 30.00 reads as 30, 30.50 as 30.5.
 *
 * String() already does this - 30 prints as "30", 30.5 as "30.5" - so rounding
 * to two places is the whole job. This used to branch on Number.isInteger with
 * the same expression on both sides, which did nothing either way.
 */
export function formatQuantity(value: number, unit: string): string {
  const rounded = Math.round(value * 100) / 100;
  return `${rounded} ${unit}`;
}
