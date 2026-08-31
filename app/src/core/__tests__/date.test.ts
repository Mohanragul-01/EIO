/**
 * Dates are the other place a quiet bug does real damage: the timezone
 * off-by-one, and the due/event wording mix-up that shipped once already.
 */
import {
  addDaysISO,
  daysUntil,
  formatDueDate,
  formatEventDate,
  fromISODate,
  isOverdue,
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
