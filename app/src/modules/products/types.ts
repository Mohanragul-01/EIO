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
  opened_on: string;
  /** Set when it runs out. A finished product is kept, not deleted. */
  finished_on: string | null;
  note: string;
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
  opened_on: string;
  note: string;
};

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
  /** How many days it has been open. Always at least 1. */
  daysOpen: number;
};

/** Whole days between two calendar dates, ignoring time and timezone. */
function daysBetween(fromISO: string, toISO: string): number {
  const [fy, fm, fd] = fromISO.split('-').map(Number);
  const [ty, tm, td] = toISO.split('-').map(Number);
  // Local dates, so a timezone cannot shift the answer by a day.
  const from = new Date(fy, fm - 1, fd);
  const to = new Date(ty, tm - 1, td);
  return Math.round((to.getTime() - from.getTime()) / 86400000);
}

function addDays(iso: string, days: number): string {
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
 * open gives a rate that already accounts for the days you skipped, so the
 * projection degrades gracefully rather than being permanently optimistic.
 *
 * `per_use` is therefore not needed for the projection at all. It exists to
 * pre-fill the amount when you log a use, so logging is one tap.
 *
 * Nothing is projected from a single day. One use on the first day implies a
 * rate of one-per-day, which for a product you use twice a week would predict
 * an empty bottle three times too soon - and a confident wrong number is worse
 * than "not enough data yet".
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

  // At least 1, so a product opened today never divides by zero.
  const daysOpen = Math.max(1, daysBetween(product.opened_on, today) + 1);

  // Two days of history before predicting anything, and something actually
  // used - a rate of zero would project an infinite lifespan.
  const canProject = daysOpen >= 2 && used > 0 && remaining > 0;
  const dailyRate = canProject ? used / daysOpen : null;

  const daysLeft = dailyRate === null ? null : Math.floor(remaining / dailyRate);
  const emptyOn = daysLeft === null ? null : addDays(today, daysLeft);

  const costPerDay =
    product.price_minor === null || dailyRate === null || product.total_quantity === 0
      ? null
      : Math.round((product.price_minor / product.total_quantity) * dailyRate);

  return { used, remaining, percentUsed, dailyRate, daysLeft, emptyOn, costPerDay, daysOpen };
}

/**
 * How urgently this needs replacing.
 *
 * Thresholds rather than a raw number, because "7 days left" only means
 * something once you know how long delivery takes. A week is the point at
 * which ordering today still arrives in time.
 */
export type Urgency = 'finished' | 'critical' | 'soon' | 'ok' | 'unknown';

export function urgencyOf(product: Product, projection: Projection): Urgency {
  if (product.finished_on) return 'finished';
  if (projection.remaining <= 0) return 'critical';
  if (projection.daysLeft === null) return 'unknown';
  if (projection.daysLeft <= 7) return 'critical';
  if (projection.daysLeft <= 21) return 'soon';
  return 'ok';
}

export const URGENCY_LABEL: Record<Urgency, string> = {
  finished: 'Finished',
  critical: 'Reorder now',
  soon: 'Running low',
  ok: 'Plenty left',
  unknown: 'Not enough data',
};

/** A human span: "12 days", "about 2 months". */
export function formatDaysLeft(days: number | null): string {
  if (days === null) return 'Unknown';
  if (days <= 0) return 'Empty';
  if (days === 1) return '1 day';
  if (days < 45) return `${days} days`;

  const months = Math.round(days / 30);
  return `about ${months} month${months === 1 ? '' : 's'}`;
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
