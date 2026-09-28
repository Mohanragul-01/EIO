/**
 * B-List progress.
 *
 * Small maths, but the rounding decision matters on a list of 818: at that
 * size almost every percentage rounds to something that looks finished long
 * before it is.
 */
import { categorySummary, matchesQuery, progressOf, type BucketItem } from '../types';

const item = (over: Partial<BucketItem> = {}): BucketItem => ({
  id: Math.random().toString(36).slice(2),
  user_id: 'u1',
  category: 'Water Adventures',
  title: 'Surfing',
  cost: 'moderate',
  is_done: false,
  done_on: null,
  note: '',
  position: 0,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...over,
});

describe('progressOf', () => {
  it('counts what is left by cost, not what there ever was', () => {
    // The number that changes your afternoon is how many FREE things are still
    // on the list, not how many it started with.
    const items = [
      item({ cost: 'low' }),
      item({ cost: 'low', is_done: true }),
      item({ cost: 'high' }),
    ];

    const p = progressOf(items);
    expect(p.total).toBe(3);
    expect(p.done).toBe(1);
    expect(p.byCost).toEqual({ low: 1, moderate: 0, high: 1 });
  });

  it('never rounds up to 100 while anything is outstanding', () => {
    // THE CASE THAT MATTERS AT THIS SIZE. 817 of 818 is 99.88%, which rounds
    // to 100 - and "100%" beside an unticked item is the kind of small lie
    // that makes you stop trusting the number.
    const items = Array.from({ length: 818 }, (_, i) => item({ is_done: i < 817 }));
    expect(progressOf(items).percent).toBe(99);
  });

  it('reaches 100 only when everything is actually done', () => {
    const items = Array.from({ length: 10 }, () => item({ is_done: true }));
    expect(progressOf(items).percent).toBe(100);
  });

  it('handles an empty list without dividing by zero', () => {
    const p = progressOf([]);
    expect(p.percent).toBe(0);
    expect(p.total).toBe(0);
  });
});

describe('categorySummary', () => {
  it('counts per category, alphabetically', () => {
    const items = [
      item({ category: 'Water Adventures', is_done: true }),
      item({ category: 'Water Adventures' }),
      item({ category: 'Music & Sound' }),
    ];

    expect(categorySummary(items)).toEqual([
      { category: 'Music & Sound', total: 1, done: 0 },
      { category: 'Water Adventures', total: 2, done: 1 },
    ]);
  });
});

describe('matchesQuery', () => {
  it('matches the category as well as the title', () => {
    // On a list this long, typing "water" usually means "show me that whole
    // section", not "titles containing the word water".
    expect(matchesQuery(item({ title: 'Surfing' }), 'water')).toBe(true);
  });

  it('matches the note, so your own words find it back', () => {
    expect(matchesQuery(item({ note: 'booked for June' }), 'june')).toBe(true);
  });

  it('is case-insensitive and ignores surrounding space', () => {
    expect(matchesQuery(item({ title: 'Surfing' }), '  SURF ')).toBe(true);
  });

  it('matches everything when the query is empty', () => {
    expect(matchesQuery(item(), '   ')).toBe(true);
  });

  it('does not match what is not there', () => {
    expect(matchesQuery(item({ title: 'Surfing' }), 'skydiv')).toBe(false);
  });
});
