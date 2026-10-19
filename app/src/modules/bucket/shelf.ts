/**
 * shelf.ts - the Now shelf: at most five things you are actually doing.
 *
 * Cost answers "can I afford it"; the shelf answers "am I going to do it".
 * The cap is the whole idea. A Now with forty things on it is the list again,
 * so adding a sixth asks which one to swap out rather than quietly growing.
 *
 * Done items never count. Doing a Now thing frees its slot without anyone
 * having to remember to un-pin it, and its focus is left alone, so undoing
 * the tick puts it straight back on the shelf.
 */
import { targetEnd } from './plan';
import type { BucketItem, BucketStep } from './types';

export const NOW_CAP = 5;

/** Soonest target first; untargeted after; titles break ties. */
export function nowShelf(items: BucketItem[]): BucketItem[] {
  const endOf = (item: BucketItem) =>
    item.target_on && item.target_precision ? targetEnd(item.target_on, item.target_precision) : null;

  return items
    .filter((item) => item.focus === 'now' && !item.is_done)
    .sort((a, b) => {
      const aEnd = endOf(a);
      const bEnd = endOf(b);
      if (aEnd !== bEnd) {
        if (aEnd === null) return 1;
        if (bEnd === null) return -1;
        return aEnd.localeCompare(bEnd);
      }
      return a.title.localeCompare(b.title);
    });
}

export function isShelfFull(items: BucketItem[]): boolean {
  return nowShelf(items).length >= NOW_CAP;
}

/** Steps per item, in their order. */
export function stepsByItem(steps: BucketStep[]): Map<string, BucketStep[]> {
  const grouped = new Map<string, BucketStep[]>();
  steps.forEach((step) => {
    const rows = grouped.get(step.item_id) ?? [];
    grouped.set(step.item_id, rows);
    rows.push(step);
  });
  grouped.forEach((rows) =>
    rows.sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at)),
  );
  return grouped;
}

/** What to do next: the first step not yet done. */
export function nextStep(steps: BucketStep[]): BucketStep | null {
  return [...steps].sort((a, b) => a.position - b.position).find((step) => !step.is_done) ?? null;
}

export type ShelfProgress = {
  kind: 'steps' | 'money';
  done: number;
  total: number;
  /** 0-100, reaching 100 only when it is actually complete. */
  percent: number;
};

/**
 * What a card's bar measures.
 *
 * Steps when there are any, because ticking a step is the progress you make
 * by hand; otherwise money saved against the estimate. With neither there is
 * no bar, rather than an empty one that looks like failure.
 */
export function shelfProgress(item: BucketItem, steps: BucketStep[]): ShelfProgress | null {
  if (steps.length > 0) {
    const done = steps.filter((step) => step.is_done).length;
    return { kind: 'steps', done, total: steps.length, percent: percentOf(done, steps.length) };
  }

  if (item.est_cost_minor && item.est_cost_minor > 0) {
    return {
      kind: 'money',
      done: item.saved_minor,
      total: item.est_cost_minor,
      percent: percentOf(item.saved_minor, item.est_cost_minor),
    };
  }

  return null;
}

/** Same honesty as the list's headline: 99.9% is not 100%. */
function percentOf(done: number, total: number): number {
  if (total <= 0) return 0;
  if (done >= total) return 100;
  return Math.min(99, Math.round((done / total) * 100));
}
