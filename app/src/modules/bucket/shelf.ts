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
import type { BucketItem, BucketStep, Focus } from './types';

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

/**
 * The focus an item should have when it is reopened - unticked, or a tick
 * undone.
 *
 * A done Now item keeps its focus but frees its slot, so while it was done
 * something else may have taken the place. Reopening it as Now would then put
 * six on the shelf; it goes to Next instead, which the caller says aloud.
 */
export function focusOnReopen(item: BucketItem, items: BucketItem[]): Focus | null {
  if (item.focus !== 'now') return item.focus;
  return isShelfFull(items.filter((other) => other.id !== item.id)) ? 'next' : 'now';
}

/** Position order, oldest first where two share one. */
const stepOrder = (a: BucketStep, b: BucketStep) =>
  a.position - b.position || a.created_at.localeCompare(b.created_at);

/** Steps per item, in their order. */
export function stepsByItem(steps: BucketStep[]): Map<string, BucketStep[]> {
  const grouped = new Map<string, BucketStep[]>();
  steps.forEach((step) => {
    const rows = grouped.get(step.item_id) ?? [];
    grouped.set(step.item_id, rows);
    rows.push(step);
  });
  grouped.forEach((rows) => rows.sort(stepOrder));
  return grouped;
}

/** Where a new step goes: after the last one. */
export function nextStepPosition(steps: BucketStep[]): number {
  return steps.reduce((max, step) => Math.max(max, step.position + 1), 0);
}

/**
 * The position writes that move one step up or down.
 *
 * The whole list is renumbered 0..n-1 and only the rows that changed are
 * returned - usually the two that swapped. Renumbering rather than trading two
 * numbers means a clash left by an interrupted move (two steps on the same
 * position) is repaired by the next move instead of living on.
 */
export function stepMoves(
  steps: BucketStep[],
  stepId: string,
  direction: -1 | 1,
): { id: string; position: number }[] {
  const ordered = [...steps].sort(stepOrder);
  const from = ordered.findIndex((step) => step.id === stepId);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= ordered.length) return [];

  [ordered[from], ordered[to]] = [ordered[to], ordered[from]];
  return ordered
    .map((step, position) => ({ id: step.id, position, was: step.position }))
    .filter(({ position, was }) => position !== was)
    .map(({ id, position }) => ({ id, position }));
}

/** What to do next: the first step not yet done. */
export function nextStep(steps: BucketStep[]): BucketStep | null {
  return [...steps].sort(stepOrder).find((step) => !step.is_done) ?? null;
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
