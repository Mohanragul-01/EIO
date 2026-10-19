/**
 * The year heatmap: a year of training at a glance, one square per day,
 * rows are weekdays and columns are weeks, with this week on the right.
 */
import { toISODate } from '../../../core/date';
import { heatLevel, heatmapDays, levelRanges, monthStarts, yearGrid } from '../heatmap';

/** The calendar day after `iso`, built from (y, m, d) so DST cannot shift it. */
function nextDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return toISODate(new Date(y, m - 1, d + 1));
}

/** The grid read week by week, Monday to Sunday: every day in order. */
function columnMajor(grid: string[][]): string[] {
  const out: string[] = [];
  for (let c = 0; c < grid[0].length; c++)
    for (let r = 0; r < grid.length; r++) out.push(grid[r][c]);
  return out;
}

describe('yearGrid', () => {
  // Mon 19 Oct 2026.
  const grid = yearGrid('2026-10-19');

  it('is seven weekday rows of 53 weeks', () => {
    expect(grid).toHaveLength(7);
    grid.forEach((row) => expect(row).toHaveLength(53));
  });

  it('ends with the week holding today, Monday first', () => {
    expect(grid[0][52]).toBe('2026-10-19');
    // The rest of this week is still to come; it is drawn, and marked by the caller.
    expect(grid[6][52]).toBe('2026-10-25');
    expect(grid[0][0]).toBe('2025-10-20');
  });

  it('starts weeks on Sunday when asked', () => {
    const sunday = yearGrid('2026-10-19', 53, 0);
    expect(sunday[0][52]).toBe('2026-10-18');
    expect(sunday[1][52]).toBe('2026-10-19');
  });

  it('holds every day exactly once, in order, across both daylight-saving changes', () => {
    const days = columnMajor(grid);
    expect(new Set(days).size).toBe(53 * 7);
    for (let i = 1; i < days.length; i++) expect(days[i]).toBe(nextDay(days[i - 1]));
    // The range spans 8 Mar 2026 and 1 Nov 2025, where New York changes clocks.
    expect(days).toContain('2026-03-08');
    expect(days).toContain('2025-11-02');
  });

  it('can be shorter', () => {
    const small = yearGrid('2026-10-21', 4);
    expect(small[0]).toEqual(['2026-09-28', '2026-10-05', '2026-10-12', '2026-10-19']);
  });
});

describe('heatmapDays', () => {
  it('counts working sets per day, marks the modes, and keeps a day with no sets', () => {
    const days = heatmapDays(
      [
        { id: 's1', date: '2026-10-19', mode: 'gym' },
        { id: 's2', date: '2026-10-19', mode: 'calisthenics' },
        { id: 's3', date: '2026-10-17', mode: 'calisthenics' },
      ],
      [
        { session_id: 's1', date: '2026-10-19', set_type: 'warmup' },
        { session_id: 's1', date: '2026-10-19', set_type: 'normal' },
        { session_id: 's1', date: '2026-10-19', set_type: 'drop' },
        // Written by v2: no set type, an ordinary working set.
        { session_id: 's2', date: '2026-10-19', set_type: null },
        { session_id: 's2', date: '2026-10-19', set_type: 'failure' },
      ],
    );
    expect(days['2026-10-19']).toEqual({ sets: 4, sessions: 2, gym: true, calisthenics: true });
    expect(days['2026-10-17']).toEqual({ sets: 0, sessions: 1, gym: false, calisthenics: true });
    expect(days['2026-10-18']).toBeUndefined();
  });

  it('counts sets even when their session row is missing from the list', () => {
    const days = heatmapDays([], [{ session_id: 'x', date: '2026-10-01', set_type: 'normal' }]);
    expect(days['2026-10-01']).toEqual({ sets: 1, sessions: 0, gym: false, calisthenics: false });
  });
});

describe('heatLevel', () => {
  it('is 0 with nothing done, and 1 to 4 by share of the busiest day', () => {
    expect(heatLevel(0, 10)).toBe(0);
    expect(heatLevel(1, 10)).toBe(1);
    expect(heatLevel(2, 10)).toBe(1);
    expect(heatLevel(3, 10)).toBe(2);
    expect(heatLevel(5, 10)).toBe(2);
    expect(heatLevel(6, 10)).toBe(3);
    expect(heatLevel(8, 10)).toBe(4);
    expect(heatLevel(10, 10)).toBe(4);
  });

  it('never exceeds 4, and is 0 for an empty year', () => {
    expect(heatLevel(12, 10)).toBe(4);
    expect(heatLevel(3, 0)).toBe(0);
  });
});

describe('levelRanges', () => {
  it('describes each level in sets, matching heatLevel', () => {
    expect(levelRanges(10)).toEqual([
      { level: 1, from: 1, to: 2 },
      { level: 2, from: 3, to: 5 },
      { level: 3, from: 6, to: 7 },
      { level: 4, from: 8, to: 10 },
    ]);
    for (const max of [1, 2, 3, 7, 10, 23]) {
      for (const range of levelRanges(max)) {
        for (let s = range.from; s <= range.to; s++) expect(heatLevel(s, max)).toBe(range.level);
      }
    }
  });

  it('leaves out levels no whole number of sets can reach', () => {
    expect(levelRanges(2)).toEqual([
      { level: 2, from: 1, to: 1 },
      { level: 4, from: 2, to: 2 },
    ]);
    expect(levelRanges(0)).toEqual([]);
  });
});

describe('monthStarts', () => {
  it('puts each month over the week that holds its first day', () => {
    const starts = monthStarts(yearGrid('2026-10-19'));
    expect(starts).toHaveLength(12);
    // Sat 1 Nov 2025 is in the week of Mon 27 Oct, the second column.
    expect(starts[0]).toEqual({ column: 1, year: 2025, month: 11 });
    // Thu 1 Oct 2026 is in the week of Mon 28 Sep, three before this one.
    expect(starts[11]).toEqual({ column: 49, year: 2026, month: 10 });
  });
});
