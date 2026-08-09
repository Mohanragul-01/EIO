/**
 * money.ts - money handling for the whole app.
 *
 *
 * THE ONE RULE: money is stored as an INTEGER number of paise, never rupees.
 *
 *
 * WHY. JavaScript numbers are binary floating point, and most decimal
 * fractions can't be represented exactly:
 *
 *     0.1 + 0.2              === 0.30000000000000004
 *     1650.30 + 249.70       === 1900.0000000000002
 *
 * For one transaction you'd never notice. But this module SUMS hundreds of
 * amounts to produce monthly category totals, and those errors accumulate
 * into a total that's visibly a fraction of a paisa off - the kind of bug
 * that's maddening to track down later.
 *
 * Integers have no such problem. 165030 + 24970 === 190000, exactly, always.
 * So the database column is a `bigint` of paise, and rupees exist only at the
 * edges: when the user types an amount, and when we display one.
 *
 * This is what essentially every real financial system does (Stripe, banks,
 * ledgers). It costs two conversion functions and buys exactness forever.
 */

/** ₹1 = 100 paise. Named rather than inlined so the intent is obvious. */
const MINOR_UNITS_PER_RUPEE = 100;

/**
 * Parse what the user typed into paise.
 *
 * Returns null for anything unparseable, so callers can show a validation
 * error rather than silently storing NaN or 0 - a transaction that quietly
 * saves as ₹0 is worse than one that refuses to save.
 */
export function parseAmountToMinor(input: string): number | null {
  // Strip currency symbols, spaces and thousands separators, so "₹1,299.50"
  // and "1299.5" both work. People paste amounts from all sorts of places.
  const cleaned = input.replace(/[₹,\s]/g, '').trim();
  if (!cleaned) return null;

  // Digits, with an optional decimal part of at most two places.
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;

  const rupees = Number(cleaned);
  if (!Number.isFinite(rupees) || rupees < 0) return null;

  // Math.round, not Math.floor: 12.29 * 100 is 1228.9999... in floating point,
  // and flooring that would silently lose a paisa on perfectly valid input.
  return Math.round(rupees * MINOR_UNITS_PER_RUPEE);
}

/** Paise -> a plain rupee number. Only for prefilling an edit form. */
export function minorToAmountString(minor: number): string {
  return (minor / MINOR_UNITS_PER_RUPEE).toFixed(2);
}

/**
 * Paise -> a display string like "₹1,299.50".
 *
 * Intl.NumberFormat with the 'en-IN' locale gives the Indian digit grouping
 * (₹12,34,567 - lakhs and crores, not thousands), which is what you'd expect
 * to see and what hand-rolled formatting always gets wrong.
 */
export function formatMoney(minor: number, options?: { compact?: boolean }): string {
  const rupees = minor / MINOR_UNITS_PER_RUPEE;

  // In summaries, "₹1,29,900" reads better than "₹1,29,900.00".
  const showPaise = !options?.compact || rupees % 1 !== 0;

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: showPaise ? 2 : 0,
    maximumFractionDigits: showPaise ? 2 : 0,
  }).format(rupees);
}

/** Sum paise. Trivial, but it keeps `reduce` boilerplate out of the screens. */
export function sumMinor(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
