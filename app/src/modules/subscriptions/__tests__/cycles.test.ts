/**
 * Billing cycle maths. Both functions here feed numbers the user makes
 * decisions on, so an off-by-a-bit is worse than an obvious break.
 */
import { advanceDueDate, toMonthlyMinor } from '../types';

describe('toMonthlyMinor', () => {
  it('leaves a monthly amount alone', () => {
    expect(toMonthlyMinor(19900, 'monthly')).toBe(19900);
  });

  it('spreads longer cycles across the months they cover', () => {
    expect(toMonthlyMinor(478800, 'yearly')).toBe(39900);
    expect(toMonthlyMinor(90000, 'quarterly')).toBe(30000);
  });

  it('uses 52/12 weeks per month, not 4', () => {
    // Four weeks per month undercounts a weekly bill by about 8%, which is
    // roughly a whole payment missing from the annual picture.
    const weekly = toMonthlyMinor(20000, 'weekly');
    expect(weekly).toBe(Math.round(20000 * (52 / 12)));
    expect(weekly).toBeGreaterThan(20000 * 4);
  });

  it('returns whole paise so totals stay exact', () => {
    expect(Number.isInteger(toMonthlyMinor(10000, 'quarterly'))).toBe(true);
    expect(Number.isInteger(toMonthlyMinor(33333, 'weekly'))).toBe(true);
  });
});

describe('advanceDueDate', () => {
  it('moves forward by exactly one cycle', () => {
    expect(advanceDueDate('2026-08-07', 'weekly')).toBe('2026-08-14');
    expect(advanceDueDate('2026-08-07', 'monthly')).toBe('2026-09-07');
    expect(advanceDueDate('2026-08-07', 'quarterly')).toBe('2026-11-07');
    expect(advanceDueDate('2026-08-07', 'yearly')).toBe('2027-08-07');
  });

  it('rolls over year boundaries', () => {
    expect(advanceDueDate('2026-12-15', 'monthly')).toBe('2027-01-15');
    expect(advanceDueDate('2026-12-31', 'weekly')).toBe('2027-01-07');
  });

  it('anchors on the old due date, not today', () => {
    // Paying late must not permanently shift the billing date later.
    const longPast = advanceDueDate('2025-03-10', 'monthly');
    expect(longPast).toBe('2025-04-10');
  });
});
