/**
 * prices.ts - price history, and the "went up" badge.
 *
 * Stealth rises are how a fixed budget creeps: ₹499 becomes ₹649 and the
 * total quietly follows. The history is written when you edit a price, or
 * confirm a new one while marking a payment - so it is what you actually paid,
 * not what a catalogue claims.
 */
import { daysBetween } from './lifecycle';
import type { PriceChange } from './types';

export type PriceStep = {
  change: PriceChange;
  /** Whole percent, signed. */
  pct: number;
  direction: 'up' | 'down';
};

const newestFirst = (a: PriceChange, b: PriceChange) =>
  b.effective_on.localeCompare(a.effective_on) || b.created_at.localeCompare(a.created_at);

/** Each change, newest first, with its percentage. */
export function priceSteps(changes: PriceChange[]): PriceStep[] {
  return [...changes].sort(newestFirst).map((change) => ({
    change,
    pct: Math.round(((change.new_amount_minor - change.old_amount_minor) / change.old_amount_minor) * 100),
    direction: change.new_amount_minor > change.old_amount_minor ? 'up' : 'down',
  }));
}

/** How long the "↑" badge stays on a row after a rise. */
export const INCREASE_BADGE_DAYS = 60;

/**
 * The latest change, if it was a rise within the last 60 days. Only the
 * latest: a rise that a later cut undid is not news. A change dated in the
 * future has not happened yet.
 */
export function recentIncrease(changes: PriceChange[], today: string): PriceStep | null {
  const [latest] = priceSteps(changes.filter((c) => c.effective_on <= today));
  if (!latest || latest.direction !== 'up') return null;
  return daysBetween(latest.change.effective_on, today) <= INCREASE_BADGE_DAYS ? latest : null;
}

/** recentIncrease for many subscriptions at once, keyed by subscription id. */
export function recentIncreases(changes: PriceChange[], today: string): Map<string, PriceStep> {
  const bySub = new Map<string, PriceChange[]>();
  for (const c of changes) {
    const list = bySub.get(c.subscription_id);
    if (list) list.push(c);
    else bySub.set(c.subscription_id, [c]);
  }
  const result = new Map<string, PriceStep>();
  for (const [id, list] of bySub) {
    const rise = recentIncrease(list, today);
    if (rise) result.set(id, rise);
  }
  return result;
}
