/**
 * Recurrence maths for repeating tasks.
 *
 * This is the highest-risk logic in the Todo module: a wrong next date is not a
 * crash, it is a task that quietly appears on the wrong day forever. These
 * tests pin the two properties that matter, anchoring and month-end clamping.
 */
import { addInterval } from '../../../core/date';
import { nextDueDate } from '../types';

describe('nextDueDate anchoring', () => {
  it('advances by one interval from the task own due date', () => {
    expect(nextDueDate('2026-08-30', 'daily')).toBe('2026-08-31');
    expect(nextDueDate('2026-08-30', 'weekly')).toBe('2026-09-06');
    expect(nextDueDate('2026-08-30', 'monthly')).toBe('2026-09-30');
    expect(nextDueDate('2026-08-30', 'yearly')).toBe('2027-08-30');
  });

  it('anchors to the due date, not to today', () => {
    // THE RULE. A daily task due three weeks ago, completed today, must move to
    // the day after its own due date. Anchoring to the completion moment would
    // let a habit slide across the calendar every time it was finished late.
    const longOverdue = '2026-08-01';
    expect(nextDueDate(longOverdue, 'daily')).toBe('2026-08-02');

    // And the same for a task completed early: it does not jump backwards.
    const future = '2026-12-25';
    expect(nextDueDate(future, 'daily')).toBe('2026-12-26');
  });

  it('produces a date strictly after the one it came from', () => {
    // A next date equal to or before the current one would make the task
    // immediately due again, so the same tap could repeat forever.
    for (const unit of ['daily', 'weekly', 'monthly', 'yearly'] as const) {
      for (const from of ['2026-01-31', '2026-02-28', '2024-02-29', '2026-12-31']) {
        expect(nextDueDate(from, unit) > from).toBe(true);
      }
    }
  });

  it('falls back to today when the task has no due date', () => {
    // A due date is optional while a frequency is required, so this case is
    // reachable. There is nothing to anchor to, so today is the only sane base.
    const result = nextDueDate(null, 'daily');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result > new Date().toISOString().slice(0, 10)).toBe(true);
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
