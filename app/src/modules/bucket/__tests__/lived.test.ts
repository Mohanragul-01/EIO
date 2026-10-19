/**
 * The Lived timeline: what you actually did, by year and month.
 *
 * The migration that created the list kept done_on "so the list can answer
 * 'what did I actually do this year'". This is the code that answers it - and
 * the part worth testing is where things land when their date is only a month,
 * only a year, or not known at all.
 */
import { livedTimeline, monthLevels, summariseYear } from '../lived';
import type { BucketItem } from '../types';

let seq = 0;
const item = (over: Partial<BucketItem> = {}): BucketItem => ({
  id: `i${++seq}`,
  user_id: 'u1',
  category: 'Water Adventures',
  title: 'Surfing',
  cost: 'moderate',
  is_done: true,
  done_on: '2026-03-14',
  done_precision: 'day',
  note: '',
  memory: '',
  place: '',
  again: null,
  snoozed_until: null,
  focus: null,
  target_on: null,
  target_precision: null,
  est_cost_minor: null,
  saved_minor: 0,
  position: 0,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...over,
});

const titles = (rows: BucketItem[]) => rows.map((row) => row.title);

describe('livedTimeline', () => {
  it('leaves out what is not done', () => {
    expect(livedTimeline([item({ is_done: false, done_on: null })])).toEqual([]);
  });

  it('puts years newest first, and months newest first within them', () => {
    const timeline = livedTimeline([
      item({ title: 'A', done_on: '2025-06-01' }),
      item({ title: 'B', done_on: '2026-01-10' }),
      item({ title: 'C', done_on: '2026-09-02' }),
    ]);

    expect(timeline.map((y) => y.year)).toEqual([2026, 2025]);
    expect(timeline[0].months.map((m) => m.month)).toEqual([9, 1]);
    expect(timeline[0].items).toHaveLength(2);
  });

  it('orders a month by day, newest first, then by title', () => {
    const [year] = livedTimeline([
      item({ title: 'Early', done_on: '2026-03-02' }),
      item({ title: 'Zebra', done_on: '2026-03-20' }),
      item({ title: 'Apple', done_on: '2026-03-20' }),
    ]);
    expect(titles(year.months[0].items)).toEqual(['Apple', 'Zebra', 'Early']);
  });

  it('puts a month-only memory after the dated days of its month', () => {
    // It happened in March; which day is unknown, so it claims no place among
    // the days.
    const [year] = livedTimeline([
      item({ title: 'Dated', done_on: '2026-03-02' }),
      item({ title: 'Sometime in March', done_on: '2026-03-01', done_precision: 'month' }),
    ]);
    expect(titles(year.months[0].items)).toEqual(['Dated', 'Sometime in March']);
  });

  it('gives year-only memories their own group at the end of the year', () => {
    const [year] = livedTimeline([
      item({ title: 'Sometime', done_on: '2019-01-01', done_precision: 'year' }),
      item({ title: 'January', done_on: '2019-01-05' }),
    ]);
    // Not filed under January, where the stored date would put it.
    expect(year.months.map((m) => m.month)).toEqual([1, null]);
    expect(titles(year.months[1].items)).toEqual(['Sometime']);
  });

  it('collects done items with no date last, under an unknown year', () => {
    const timeline = livedTimeline([
      item({ title: 'Undated', done_on: null, done_precision: null }),
      item({ title: 'Dated', done_on: '2026-03-02' }),
    ]);
    expect(timeline.map((y) => y.year)).toEqual([2026, null]);
    expect(titles(timeline[1].items)).toEqual(['Undated']);
  });

  it('reads a tick from before v3, with no precision, as a day', () => {
    const [year] = livedTimeline([item({ done_on: '2026-05-02', done_precision: null })]);
    expect(year.months[0].month).toBe(5);
  });
});

describe('summariseYear', () => {
  const year = [
    item({ category: 'Music & Sound', cost: 'low', done_on: '2026-01-04' }),
    item({ category: 'Music & Sound', cost: 'low', done_on: '2026-01-20' }),
    item({ category: 'Water Adventures', cost: 'high', done_on: '2026-03-02' }),
    item({ category: 'Health & Longevity', cost: 'moderate', done_on: '2026-03-01', done_precision: 'month' }),
    item({ category: 'Games, Puzzles & Play', cost: 'low', done_on: '2026-01-01', done_precision: 'year' }),
  ];

  it('counts the year and splits it by cost', () => {
    const summary = summariseYear(year);
    expect(summary.count).toBe(5);
    expect(summary.byCost).toEqual({ low: 3, moderate: 1, high: 1 });
  });

  it('fills the month strip from the dated ones, and counts the rest apart', () => {
    const summary = summariseYear(year);
    expect(summary.months).toEqual([2, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    // The year-only one is in no month - putting it in January would make
    // January look busier than it was.
    expect(summary.sometime).toBe(1);
  });

  it('names the top three categories, ties alphabetically', () => {
    const summary = summariseYear(year);
    expect(summary.topCategories).toEqual([
      { category: 'Music & Sound', count: 2 },
      { category: 'Games, Puzzles & Play', count: 1 },
      { category: 'Health & Longevity', count: 1 },
    ]);
    expect(summary.categoriesTouched).toBe(4);
  });
});

describe('monthLevels', () => {
  it('scales months against the busiest one, from 0 to 4', () => {
    expect(monthLevels([0, 1, 2, 4, 8, 0, 0, 0, 0, 0, 0, 0])).toEqual([
      0, 1, 1, 2, 4, 0, 0, 0, 0, 0, 0, 0,
    ]);
  });

  it('never shows a month with something in it as empty', () => {
    // 1 of 40 rounds to nothing; a month you did something in must not look
    // like a month you did nothing in.
    expect(monthLevels([40, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])[1]).toBe(1);
  });

  it('is all zeros for an empty year', () => {
    expect(monthLevels(new Array(12).fill(0))).toEqual(new Array(12).fill(0));
  });
});
