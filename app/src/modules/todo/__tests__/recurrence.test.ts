/**
 * Recurrence maths for repeating tasks.
 *
 * This is the highest-risk logic in the Todo module: a wrong next date is not a
 * crash, it is a task that quietly appears on the wrong day forever. These
 * tests pin the properties that matter: the schedule is anchored, an overdue
 * repeat catches up in one tick, and a month-end date comes back to the month
 * end.
 *
 * Dates are built as 'YYYY-MM-DD' strings and the suite runs in New York (see
 * jest.timezone.js), so anything that slipped into instant arithmetic would
 * fail on the daylight-saving weekends in March and November.
 */
import { addInterval } from '../../../core/date';
import { nextDueDate } from '../types';

describe('bug 1: an overdue repeat rolls forward past today', () => {
  it('a daily task three weeks overdue comes back tomorrow, not still overdue', () => {
    // v2 added one interval to the OLD due date: 1 Aug -> 2 Aug, three weeks
    // in the past, so it took about 21 ticks to catch up.
    expect(nextDueDate('2026-08-01', 'daily', { today: '2026-08-22' })).toBe('2026-08-23');
  });

  it('a weekly task keeps its weekday while catching up', () => {
    // Monday 5 Oct, completed on Wednesday 21 Oct: the next Monday after today.
    expect(nextDueDate('2026-10-05', 'weekly', { today: '2026-10-21' })).toBe('2026-10-26');
  });

  it('completing an overdue daily task schedules tomorrow, never today', () => {
    // Due yesterday, done today: today has passed for this occurrence too.
    expect(nextDueDate('2026-10-18', 'daily', { today: '2026-10-19' })).toBe('2026-10-20');
  });

  it('a task completed early still moves one step from its own date', () => {
    expect(nextDueDate('2026-12-25', 'daily', { today: '2026-10-19' })).toBe('2026-12-26');
    expect(nextDueDate('2026-10-19', 'weekly', { today: '2026-10-19' })).toBe('2026-10-26');
  });
});

describe('bug 2: month-end anchor is kept', () => {
  it('the 31st clamps to the 28th in February and returns to the 31st in March', () => {
    // v2 stepped from the CLAMPED date: 28 Feb + 1 month = 28 March, and the
    // task stayed on the 28th forever after.
    expect(addInterval('2026-02-28', 'monthly')).toBe('2026-03-28');

    const rule = { frequency: 'monthly' as const, anchorDay: 31 };
    expect(nextDueDate('2026-01-31', rule, { today: '2026-01-31' })).toBe('2026-02-28');
    expect(nextDueDate('2026-02-28', rule, { today: '2026-02-28' })).toBe('2026-03-31');
    expect(nextDueDate('2026-03-31', rule, { today: '2026-03-31' })).toBe('2026-04-30');
    expect(nextDueDate('2026-04-30', rule, { today: '2026-04-30' })).toBe('2026-05-31');
  });

  it('a 29 February yearly task is the 28th in common years and the 29th in leap years', () => {
    const rule = { frequency: 'yearly' as const, anchorDay: 29 };
    expect(nextDueDate('2024-02-29', rule, { today: '2024-02-29' })).toBe('2025-02-28');
    expect(nextDueDate('2027-02-28', rule, { today: '2027-02-28' })).toBe('2028-02-29');
  });
});

describe('addInterval month-end clamping', () => {
  it('clamps rather than overflowing past the end of a short month', () => {
    // The naive setMonth(+1) gives 2 or 3 March here, which skips February
    // altogether: a monthly task due on the 31st would never appear that month.
    expect(addInterval('2026-01-31', 'monthly')).toBe('2026-02-28');
    expect(addInterval('2026-03-31', 'monthly')).toBe('2026-04-30');
    expect(addInterval('2026-08-31', 'monthly')).toBe('2026-09-30');
  });

  it('uses the 29th in a leap year', () => {
    expect(addInterval('2024-01-31', 'monthly')).toBe('2024-02-29');
    // And a 29 February anniversary lands on the 28th in a common year.
    expect(addInterval('2024-02-29', 'yearly')).toBe('2025-02-28');
  });

  it('rolls the year over', () => {
    expect(addInterval('2026-12-15', 'monthly')).toBe('2027-01-15');
    expect(addInterval('2026-11-30', 'quarterly')).toBe('2027-02-28');
    expect(addInterval('2026-12-31', 'daily')).toBe('2027-01-01');
    expect(addInterval('2026-12-28', 'weekly')).toBe('2027-01-04');
  });

  it('leaves days that exist in every month untouched', () => {
    for (let day = 1; day <= 28; day += 1) {
      const iso = `2026-01-${String(day).padStart(2, '0')}`;
      expect(addInterval(iso, 'monthly')).toBe(`2026-02-${String(day).padStart(2, '0')}`);
    }
  });
});
