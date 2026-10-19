/**
 * picks.ts - "Pick for me": three things, chosen for you, the same all day.
 *
 * With 469 free things on the list, the hard part is choosing, not finding.
 * A random three turns a wall into a choice.
 *
 * STABLE, AND STABLE UNDER CHANGE. Shuffling the pool with Math.random would
 * show three new things every time the screen rendered, which reads as noise.
 * Seeding a shuffle by the date fixes that, but a seeded shuffle still
 * reshuffles everything the moment the pool changes - tick the first pick and
 * all three are replaced. So instead every item gets its own score, a hash of
 * (seed, its id), and the picks are the three lowest scores. An item's score
 * does not depend on anything else in the pool, so ticking, hiding or pinning
 * one pick replaces exactly that one, and the order rows arrive in does not
 * matter at all.
 */
import { matchesQuery, wantOf, type BucketItem, type Cost, type Want } from './types';
import { addDaysTo } from './when';

export const PICK_COUNT = 3;

/** "Not now" hides an item from the picks for this long. */
export const SNOOZE_DAYS = 30;

export type PickFilters = {
  cost: Cost | 'any';
  category: string;
  query: string;
  want: Want | 'any';
};

/**
 * FNV-1a, 32-bit. Not cryptographic and not meant to be: it is small, has no
 * dependencies, spreads similar inputs ("…-41", "…-42") well, and gives the
 * same number on the phone and the website.
 */
export function hashSeed(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    // Math.imul keeps the multiply in 32 bits; plain * would lose precision.
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** The day is the seed; each Shuffle that day adds a roll. */
export function pickSeed(today: string, roll: number): string {
  return roll === 0 ? today : `${today}#${roll}`;
}

export function snoozeUntil(today: string): string {
  return addDaysTo(today, SNOOZE_DAYS);
}

/** Snoozed until the morning of `snoozed_until`, when it may be picked again. */
export function isSnoozed(item: BucketItem, today: string): boolean {
  return item.snoozed_until !== null && item.snoozed_until > today;
}

/**
 * What the picks are drawn from.
 *
 * Never what is done, never what you said "not now" to, and never what is
 * already on Now - you have chosen those, and suggesting them again wastes a
 * slot. Next stays in: wanted, but not yet chosen, which is exactly what a
 * nudge is for. Everything else follows the screen's filters, so narrowing
 * the list to Music narrows the picks to Music.
 */
export function pickPool(items: BucketItem[], filters: PickFilters, today: string): BucketItem[] {
  return items.filter((item) => {
    if (item.is_done || item.focus === 'now' || isSnoozed(item, today)) return false;
    if (filters.cost !== 'any' && item.cost !== filters.cost) return false;
    if (filters.category !== 'any' && item.category !== filters.category) return false;
    if (filters.want !== 'any' && wantOf(item) !== filters.want) return false;
    return matchesQuery(item, filters.query);
  });
}

/** The `count` items with the lowest score for this seed, lowest first. */
export function picksFor(
  pool: BucketItem[],
  seed: string,
  count: number = PICK_COUNT,
): BucketItem[] {
  return pool
    .map((item) => ({ item, score: hashSeed(`${seed}|${item.id}`) }))
    // Ids break a tie between equal scores, so even that is order-independent.
    .sort((a, b) => a.score - b.score || a.item.id.localeCompare(b.item.id))
    .slice(0, count)
    .map(({ item }) => item);
}

/* WHAT THE CARD REMEMBERS ------------------------------------------------------
 * Today's shuffle count and whether the card is folded, stored as JSON on the
 * device (pickPrefs.ts). A new day starts unshuffled; the fold persists.
 * Parsing never throws - storage can hand back nothing, garbage, or an older
 * shape, and a preference must never be why the list fails to open.
 */

export type StoredPickPrefs = { day: string; roll: number; collapsed: boolean };
export type PickPrefs = { roll: number; collapsed: boolean };

export const FRESH_PICK_PREFS: PickPrefs = { roll: 0, collapsed: false };

export function serialisePickPrefs(prefs: StoredPickPrefs): string {
  return JSON.stringify(prefs);
}

export function parsePickPrefs(raw: string | null, today: string): PickPrefs {
  if (!raw) return FRESH_PICK_PREFS;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return FRESH_PICK_PREFS;

    const { day, roll, collapsed } = value as Partial<StoredPickPrefs>;
    if (typeof roll !== 'number' || !Number.isInteger(roll) || roll < 0) return FRESH_PICK_PREFS;

    return { roll: day === today ? roll : 0, collapsed: collapsed === true };
  } catch {
    return FRESH_PICK_PREFS;
  }
}
