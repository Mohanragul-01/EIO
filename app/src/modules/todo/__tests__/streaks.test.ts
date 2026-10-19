/**
 * Streaks: kept = done before the next scheduled date; skips are neutral;
 * won't-do and late completions break; an open occurrence past its window
 * makes the current streak 0.
 *
 * completed_at values are local-noon instants built from (y, m, d), so the
 * closed day is the same in any zone - the suite runs in New York.
 */
import { closedDay, groupBySeries, historyDays, isKept, streakFor, type HistoryRow } from '../streaks';

function at(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d, 12).toISOString();
}

let n = 0;
function occ(due: string | null, closed: string, overrides: Partial<HistoryRow> = {}): HistoryRow {
  n += 1;
  return {
    id: `o${n}`,
    series_id: 's',
    due_date: due,
    completed_at: at(closed),
    updated_at: at(closed),
    outcome: 'done',
    is_done: true,
    frequency: 'daily',
    repeat_every: 1,
    repeat_weekdays: null,
    repeat_anchor_day: null,
    repeat_nth: null,
    repeat_from: 'due',
    ...overrides,
  };
}

const openDaily = (due: string) => ({
  due_date: due,
  frequency: 'daily' as const,
  repeat_every: 1,
  repeat_weekdays: null,
  repeat_anchor_day: null,
  repeat_nth: null,
  repeat_from: 'due' as const,
});

describe('isKept', () => {
  it('a daily task done on its day is kept; done the next day is not', () => {
    expect(isKept(occ('2026-10-10', '2026-10-10'))).toBe(true);
    expect(isKept(occ('2026-10-10', '2026-10-11'))).toBe(false);
  });

  it('a weekly task done later the same week is still kept', () => {
    const weekly = { frequency: 'weekly' as const, repeat_weekdays: [1] };
    expect(isKept(occ('2026-10-12', '2026-10-14', weekly))).toBe(true);
    expect(isKept(occ('2026-10-12', '2026-10-19', weekly))).toBe(false);
  });

  it('done early is kept; a skip or won\'t do is not kept', () => {
    expect(isKept(occ('2026-10-10', '2026-10-08'))).toBe(true);
    expect(isKept(occ('2026-10-10', '2026-10-10', { outcome: 'skipped' }))).toBe(false);
    expect(isKept(occ('2026-10-10', '2026-10-10', { outcome: 'wont_do' }))).toBe(false);
  });

  it('reads a v2 done row (no outcome) as done', () => {
    expect(isKept(occ('2026-10-10', '2026-10-10', { outcome: null }))).toBe(true);
  });
});

describe('streakFor', () => {
  it('counts consecutive kept occurrences', () => {
    const rows = [
      occ('2026-10-15', '2026-10-15'),
      occ('2026-10-16', '2026-10-16'),
      occ('2026-10-17', '2026-10-17'),
    ];
    expect(streakFor(rows, openDaily('2026-10-18'), '2026-10-18')).toEqual({
      current: 3,
      best: 3,
      done: 3,
      skipped: 0,
    });
  });

  it('a late completion breaks the run, and the best is remembered', () => {
    const rows = [
      occ('2026-10-01', '2026-10-01'),
      occ('2026-10-02', '2026-10-02'),
      occ('2026-10-03', '2026-10-03'),
      occ('2026-10-04', '2026-10-06'), // late
      occ('2026-10-07', '2026-10-07'),
    ];
    const stats = streakFor(rows, openDaily('2026-10-08'), '2026-10-08');
    expect(stats.current).toBe(1);
    expect(stats.best).toBe(3);
    expect(stats.done).toBe(5);
  });

  it('skips neither add to nor break a streak', () => {
    const rows = [
      occ('2026-10-15', '2026-10-15'),
      occ('2026-10-16', '2026-10-16', { outcome: 'skipped' }),
      occ('2026-10-17', '2026-10-17'),
    ];
    expect(streakFor(rows, openDaily('2026-10-18'), '2026-10-18')).toMatchObject({
      current: 2,
      skipped: 1,
    });
  });

  it('won\'t do breaks it', () => {
    const rows = [
      occ('2026-10-15', '2026-10-15'),
      occ('2026-10-16', '2026-10-16', { outcome: 'wont_do' }),
      occ('2026-10-17', '2026-10-17'),
    ];
    expect(streakFor(rows, openDaily('2026-10-18'), '2026-10-18').current).toBe(1);
  });

  it('is 0 once the open occurrence\'s window has passed', () => {
    const rows = [occ('2026-10-15', '2026-10-15'), occ('2026-10-16', '2026-10-16')];
    // Open one due the 17th: still fine on the 17th, lapsed on the 18th.
    expect(streakFor(rows, openDaily('2026-10-17'), '2026-10-17').current).toBe(2);
    expect(streakFor(rows, openDaily('2026-10-17'), '2026-10-18').current).toBe(0);
  });

  it('works in any order it is given, with no open occurrence', () => {
    const rows = [occ('2026-10-17', '2026-10-17'), occ('2026-10-15', '2026-10-15'), occ('2026-10-16', '2026-10-16')];
    expect(streakFor(rows, null, '2026-10-30').current).toBe(3);
  });

  it('scores v2 history, where late completions never moved the schedule', () => {
    // v2 stepped one interval from the old due date whatever day it was done,
    // so a late tick left the next occurrence on schedule but overdue. The
    // late one still breaks the run.
    const rows = [
      occ('2026-10-01', '2026-10-01', { outcome: null }),
      occ('2026-10-02', '2026-10-05', { outcome: null }),
      occ('2026-10-03', '2026-10-05', { outcome: null }),
    ];
    expect(streakFor(rows, null, '2026-10-05')).toMatchObject({ current: 0, best: 1, done: 3 });
  });
});

describe('grouping and history days', () => {
  it('groups by series key, counting the first occurrence (no series_id) by its id', () => {
    const first = occ('2026-10-01', '2026-10-01', { id: 'root', series_id: null });
    const second = occ('2026-10-02', '2026-10-02', { series_id: 'root' });
    const other = occ('2026-10-02', '2026-10-02', { series_id: 'elsewhere' });
    const groups = groupBySeries([first, second, other]);
    expect(groups.get('root')?.map((r) => r.id)).toEqual(['root', second.id]);
    expect(groups.get('elsewhere')).toHaveLength(1);
  });

  it('marks each closed day with how it closed, done winning a shared day', () => {
    const days = historyDays([
      occ('2026-10-01', '2026-10-01'),
      occ('2026-10-02', '2026-10-02', { outcome: 'skipped' }),
      occ('2026-10-03', '2026-10-02'),
    ]);
    expect(days.get('2026-10-01')).toBe('done');
    expect(days.get('2026-10-02')).toBe('done');
  });

  it('reads the closed day locally, falling back to the last edit', () => {
    expect(closedDay({ completed_at: null, updated_at: at('2026-10-09') })).toBe('2026-10-09');
  });
});
