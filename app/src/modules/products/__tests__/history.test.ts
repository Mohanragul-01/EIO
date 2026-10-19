/**
 * Usage history: the last-fortnight strip and the grouped history list.
 *
 * Both exist to answer "did I forget to log a day?", which is the complaint
 * they were built for - so the cases that matter are the empty days, and the
 * boundaries of the window those empty days live in.
 */
import { formatQuantity, groupByDay, recentDays } from '../types';

const use = (used_on: string, quantity: number, id = `${used_on}-${quantity}`) => ({
  id,
  used_on,
  quantity,
});

describe('recentDays', () => {
  it('returns the window oldest first, ending today', () => {
    const days = recentDays([], '2026-10-19', 3);
    expect(days.map((d) => d.date)).toEqual(['2026-10-17', '2026-10-18', '2026-10-19']);
  });

  it('keeps days with nothing logged, as zeros', () => {
    // The gap IS the information: an empty yesterday is the day you forgot.
    const days = recentDays([use('2026-10-19', 30)], '2026-10-19', 3);
    expect(days).toEqual([
      { date: '2026-10-17', total: 0, count: 0 },
      { date: '2026-10-18', total: 0, count: 0 },
      { date: '2026-10-19', total: 30, count: 1 },
    ]);
  });

  it('adds up several uses on the same day', () => {
    // Face wash morning and evening is two uses, one day.
    const days = recentDays([use('2026-10-19', 2, 'a'), use('2026-10-19', 3, 'b')], '2026-10-19', 1);
    expect(days).toEqual([{ date: '2026-10-19', total: 5, count: 2 }]);
  });

  it('ignores uses outside the window', () => {
    const days = recentDays([use('2026-09-01', 30), use('2026-10-20', 30)], '2026-10-19', 2);
    expect(days.every((d) => d.count === 0)).toBe(true);
  });

  it('crosses a month boundary', () => {
    const days = recentDays([], '2026-11-01', 3);
    expect(days.map((d) => d.date)).toEqual(['2026-10-30', '2026-10-31', '2026-11-01']);
  });

  it('defaults to a fortnight', () => {
    expect(recentDays([], '2026-10-19')).toHaveLength(14);
  });
});

describe('groupByDay', () => {
  it('puts the newest day first', () => {
    const groups = groupByDay([use('2026-10-10', 1), use('2026-10-12', 1), use('2026-10-11', 1)]);
    expect(groups.map((g) => g.date)).toEqual(['2026-10-12', '2026-10-11', '2026-10-10']);
  });

  it('totals each day and keeps its uses together', () => {
    const groups = groupByDay([use('2026-10-12', 2, 'a'), use('2026-10-12', 3, 'b')]);
    expect(groups).toHaveLength(1);
    expect(groups[0].total).toBe(5);
    expect(groups[0].uses.map((u) => u.id)).toEqual(['a', 'b']);
  });

  it('returns nothing for no uses', () => {
    expect(groupByDay([])).toEqual([]);
  });
});

describe('formatQuantity', () => {
  it('drops trailing zeroes', () => {
    expect(formatQuantity(30, 'g')).toBe('30 g');
    expect(formatQuantity(30.5, 'g')).toBe('30.5 g');
  });

  it('rounds to two places', () => {
    expect(formatQuantity(1 / 3, 'ml')).toBe('0.33 ml');
  });
});
