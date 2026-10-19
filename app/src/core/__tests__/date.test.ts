/**
 * Dates are the other place a quiet bug does real damage: the timezone
 * off-by-one, and the due/event wording mix-up that shipped once already.
 */
import {
  addDaysISO,
  addMonths,
  daysUntil,
  formatDueDate,
  formatEventDate,
  fromISODate,
  isOverdue,
  monthGrid,
  toISODate,
  todayISO,
} from '../date';

describe('ISO conversion', () => {
  it('uses the local calendar day, not UTC', () => {
    // `new Date('2026-08-07')` parses as UTC midnight, which formats back as
    // 6 August anywhere behind UTC. fromISODate must not do that.
    const d = fromISODate('2026-08-07');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(7); // 0-based: August
    expect(d.getDate()).toBe(7);
  });

  it('round-trips a date string unchanged', () => {
    for (const iso of ['2026-01-01', '2026-02-28', '2026-12-31', '2024-02-29']) {
      expect(toISODate(fromISODate(iso))).toBe(iso);
    }
  });

  it('pads single-digit months and days', () => {
    expect(toISODate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('daysUntil', () => {
  it('is zero for today and negative for the past', () => {
    expect(daysUntil(todayISO())).toBe(0);
    expect(daysUntil(addDaysISO(-1))).toBe(-1);
    expect(daysUntil(addDaysISO(3))).toBe(3);
  });

  it('drives isOverdue only for dates strictly before today', () => {
    expect(isOverdue(todayISO())).toBe(false);
    expect(isOverdue(addDaysISO(-1))).toBe(true);
    expect(isOverdue(addDaysISO(1))).toBe(false);
  });
});

describe('due vs event wording', () => {
  it('describes deadlines looking forward', () => {
    expect(formatDueDate(todayISO())).toBe('Today');
    expect(formatDueDate(addDaysISO(1))).toBe('Tomorrow');
    expect(formatDueDate(addDaysISO(-3))).toBe('3 days overdue');
  });

  it('describes past events looking backward, never as overdue', () => {
    expect(formatEventDate(todayISO())).toBe('Today');
    expect(formatEventDate(addDaysISO(-1))).toBe('Yesterday');
    // The bug this guards against: a purchase three days ago rendering as
    // "3 days overdue" because it went through the due-date formatter.
    expect(formatEventDate(addDaysISO(-3))).not.toContain('overdue');
  });
});

describe('monthGrid', () => {
  const weekday = (iso: string) => fromISODate(iso).getDay();

  it('covers the month in whole weeks starting on Monday', () => {
    const grid = monthGrid(2026, 10, 1);
    // 1 October 2026 is a Thursday, so the grid opens on Monday 28 September.
    expect(grid[0][0]).toBe('2026-09-28');
    expect(weekday(grid[0][0])).toBe(1);
    expect(grid.flat()).toContain('2026-10-01');
    expect(grid.flat()).toContain('2026-10-31');
    for (const week of grid) expect(week).toHaveLength(7);
  });

  it('crosses into a new year', () => {
    const grid = monthGrid(2027, 1, 1);
    expect(grid.flat()).toContain('2027-01-01');
    expect(grid.flat()).toContain('2027-01-31');
    // 1 January 2027 is a Friday: the leading days are December 2026.
    expect(grid[0][0]).toBe('2026-12-28');
  });

  it('includes 29 February in a leap year', () => {
    expect(monthGrid(2028, 2, 1).flat()).toContain('2028-02-29');
  });

  it('uses six rows when the month needs them', () => {
    // 1 August 2026 is a Saturday and August has 31 days.
    expect(monthGrid(2026, 8, 1)).toHaveLength(6);
  });

  it('starts every row on Sunday when asked to', () => {
    for (const week of monthGrid(2026, 10, 0)) expect(weekday(week[0])).toBe(0);
  });

  it.each([
    // [year, month, a day before the change, a day after it]
    [2026, 3, 7, 9],
    [2026, 11, 0, 2],
  ])('lists consecutive days across a daylight-saving change (%i-%i)', (year, month, before, after) => {
    // The suite runs in New York (jest.timezone.js). Stepping 24 hours from
    // midnight there drifts to 01:00 when the clocks spring forward and to
    // 23:00 THE DAY BEFORE when they fall back in November, so a grid built
    // that way repeats a day. The first assertion proves the zone really is in
    // effect; without it this test would be empty in India, which has no DST.
    expect(new Date(year, month - 1, before).getTimezoneOffset()).not.toBe(
      new Date(year, month - 1, after).getTimezoneOffset(),
    );
    const days = monthGrid(year, month, 1).flat();
    for (let i = 1; i < days.length; i++) {
      const [y, m, d] = days[i - 1].split('-').map(Number);
      expect(days[i]).toBe(toISODate(new Date(y, m - 1, d + 1)));
    }
  });
});

describe('addMonths', () => {
  it('rolls December forward into January of the next year', () => {
    expect(addMonths(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
  });

  it('rolls January back into December of the previous year', () => {
    expect(addMonths(2027, 1, -1)).toEqual({ year: 2026, month: 12 });
  });

  it('handles jumps of more than a year either way', () => {
    expect(addMonths(2026, 10, 15)).toEqual({ year: 2028, month: 1 });
    expect(addMonths(2026, 10, -22)).toEqual({ year: 2024, month: 12 });
  });
});
