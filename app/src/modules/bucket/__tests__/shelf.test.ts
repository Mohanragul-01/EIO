/**
 * The Now shelf: at most five things you are actually going to do.
 *
 * The cap is the point - a Now with forty things on it is the list again.
 * What counts towards it, what order the cards come in, and what each card's
 * bar measures are the rules worth pinning.
 */
import {
  NOW_CAP,
  focusOnReopen,
  isShelfFull,
  nextStep,
  nextStepPosition,
  nowShelf,
  shelfProgress,
  stepMoves,
  stepsByItem,
} from '../shelf';
import type { BucketItem, BucketStep } from '../types';

let seq = 0;
const item = (over: Partial<BucketItem> = {}): BucketItem => ({
  id: `item-${++seq}`,
  user_id: 'u1',
  category: 'Travel & Exploration',
  title: 'Thing',
  cost: 'high',
  is_done: false,
  done_on: null,
  done_precision: null,
  note: '',
  memory: '',
  place: '',
  again: null,
  snoozed_until: null,
  focus: 'now',
  target_on: null,
  target_precision: null,
  est_cost_minor: null,
  saved_minor: 0,
  position: 0,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...over,
});

const step = (over: Partial<BucketStep> = {}): BucketStep => ({
  id: `step-${++seq}`,
  user_id: 'u1',
  item_id: 'item-x',
  title: 'Step',
  is_done: false,
  position: 0,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...over,
});

const titles = (rows: { title: string }[]) => rows.map((row) => row.title);

describe('nowShelf', () => {
  it('holds only undone Now items', () => {
    const rows = [
      item({ title: 'Now' }),
      item({ title: 'Next', focus: 'next' }),
      item({ title: 'Someday', focus: null }),
      item({ title: 'Done', is_done: true, done_on: '2026-10-01' }),
    ];
    expect(titles(nowShelf(rows))).toEqual(['Now']);
  });

  it('puts the soonest target first, and untargeted ones after', () => {
    const rows = [
      item({ title: 'No target' }),
      item({ title: 'Next year', target_on: '2027-01-01', target_precision: 'year' }),
      item({ title: 'March', target_on: '2027-03-01', target_precision: 'month' }),
      item({ title: 'A day', target_on: '2027-02-10', target_precision: 'day' }),
    ];
    // "2027" runs to December, so it comes after March 2027.
    expect(titles(nowShelf(rows))).toEqual(['A day', 'March', 'Next year', 'No target']);
  });
});

describe('isShelfFull', () => {
  it('is full at five', () => {
    expect(NOW_CAP).toBe(5);
    expect(isShelfFull(Array.from({ length: 4 }, () => item()))).toBe(false);
    expect(isShelfFull(Array.from({ length: 5 }, () => item()))).toBe(true);
  });

  it('does not count what is already done', () => {
    // Doing a Now thing frees its slot, without anyone having to un-pin it.
    const rows = [
      ...Array.from({ length: 4 }, () => item()),
      item({ is_done: true, done_on: '2026-10-01' }),
    ];
    expect(isShelfFull(rows)).toBe(false);
  });
});

describe('steps', () => {
  it('groups by item, in position order', () => {
    const grouped = stepsByItem([
      step({ item_id: 'a', title: 'Second', position: 1 }),
      step({ item_id: 'b', title: 'Other', position: 0 }),
      step({ item_id: 'a', title: 'First', position: 0 }),
    ]);
    expect(titles(grouped.get('a') ?? [])).toEqual(['First', 'Second']);
    expect(titles(grouped.get('b') ?? [])).toEqual(['Other']);
  });

  it('names the first step not yet done as the next one', () => {
    const steps = [
      step({ title: 'Book', position: 0, is_done: true }),
      step({ title: 'Pack', position: 1 }),
      step({ title: 'Go', position: 2 }),
    ];
    expect(nextStep(steps)?.title).toBe('Pack');
    expect(nextStep(steps.map((s) => ({ ...s, is_done: true })))).toBeNull();
  });
});

describe('shelfProgress', () => {
  it('measures steps when there are any', () => {
    const steps = [step({ is_done: true }), step(), step(), step()];
    expect(shelfProgress(item({ est_cost_minor: 100_00 }), steps)).toEqual({
      kind: 'steps',
      done: 1,
      total: 4,
      percent: 25,
    });
  });

  it('measures money saved when there are no steps', () => {
    expect(shelfProgress(item({ est_cost_minor: 50_000_00, saved_minor: 12_000_00 }), [])).toEqual({
      kind: 'money',
      done: 12_000_00,
      total: 50_000_00,
      percent: 24,
    });
  });

  it('never rounds up to 100 before it is finished', () => {
    const progress = shelfProgress(item({ est_cost_minor: 1000_00, saved_minor: 999_00 }), []);
    expect(progress?.percent).toBe(99);
    expect(shelfProgress(item({ est_cost_minor: 1000_00, saved_minor: 1200_00 }), [])?.percent).toBe(
      100,
    );
  });

  it('has no bar when there is nothing to measure', () => {
    expect(shelfProgress(item(), [])).toBeNull();
  });
});

describe('stepMoves', () => {
  const steps = [
    step({ id: 'a', position: 0 }),
    step({ id: 'b', position: 1 }),
    step({ id: 'c', position: 2 }),
  ];

  it('swaps a step with its neighbour, writing only what moved', () => {
    expect(stepMoves(steps, 'b', -1)).toEqual([
      { id: 'b', position: 0 },
      { id: 'a', position: 1 },
    ]);
    expect(stepMoves(steps, 'b', 1)).toEqual([
      { id: 'c', position: 1 },
      { id: 'b', position: 2 },
    ]);
  });

  it('does nothing at either end', () => {
    expect(stepMoves(steps, 'a', -1)).toEqual([]);
    expect(stepMoves(steps, 'c', 1)).toEqual([]);
  });

  it('repairs positions an interrupted move left shared', () => {
    // Two steps on position 1 after a dropped connection: the next move
    // renumbers the whole list, so the clash does not outlive it.
    const clashed = [
      step({ id: 'a', position: 0, created_at: '2026-01-01T00:00:00Z' }),
      step({ id: 'b', position: 1, created_at: '2026-01-02T00:00:00Z' }),
      step({ id: 'c', position: 1, created_at: '2026-01-03T00:00:00Z' }),
    ];
    expect(stepMoves(clashed, 'a', 1)).toEqual([
      { id: 'b', position: 0 },
      { id: 'a', position: 1 },
      { id: 'c', position: 2 },
    ]);
  });
});

describe('nextStepPosition', () => {
  it('goes after the last step, or first on an empty list', () => {
    expect(nextStepPosition([])).toBe(0);
    expect(nextStepPosition([step({ position: 0 }), step({ position: 4 })])).toBe(5);
  });
});

describe('focusOnReopen', () => {
  // A done Now item keeps its focus but frees its slot. Reopening it (untick,
  // or undoing a tick) must not push the shelf past five.
  const others = (n: number) => Array.from({ length: n }, () => item());

  it('keeps Now when there is room', () => {
    const reopened = item({ is_done: true, done_on: '2026-10-01' });
    expect(focusOnReopen(reopened, [...others(4), reopened])).toBe('now');
  });

  it('moves it to Next when the shelf filled up meanwhile', () => {
    const reopened = item({ is_done: true, done_on: '2026-10-01' });
    expect(focusOnReopen(reopened, [...others(5), reopened])).toBe('next');
  });

  it('leaves anything not on Now alone', () => {
    const next = item({ focus: 'next', is_done: true, done_on: '2026-10-01' });
    const someday = item({ focus: null, is_done: true, done_on: '2026-10-01' });
    expect(focusOnReopen(next, [...others(5), next])).toBe('next');
    expect(focusOnReopen(someday, [...others(5), someday])).toBeNull();
  });
});
