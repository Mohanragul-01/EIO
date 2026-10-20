/**
 * Flexible billing cycles: every N days, weeks, months or years, or once.
 *
 * Indian prepaid packs run 28, 56 or 84 days. Modelled as "monthly" they
 * drift by days within a few renewals, and the reminder lands after the pack
 * has already run out. These tests run in America/New_York, so the day steps
 * cross a daylight-saving change.
 */
import {
  addCycle,
  anchorFor,
  cycleLabel,
  cycleOf,
  cycleSuffix,
  legacyCycleFor,
  occurrences,
  perMonthMinor,
  perWeekMinor,
  perYearMinor,
} from '../cycles';

describe('cycleOf', () => {
  it('reads the unit and count when they are set', () => {
    expect(cycleOf({ cycle_unit: 'day', cycle_count: 28, billing_cycle: 'monthly' })).toEqual({
      unit: 'day',
      count: 28,
    });
  });

  it('falls back to the v2 column for rows a v2 app wrote', () => {
    // A v2 phone adding a subscription after the migration writes only
    // billing_cycle. Reading it, rather than a default, keeps weekly weekly.
    const legacy = (billing_cycle: 'weekly' | 'monthly' | 'quarterly' | 'yearly') =>
      cycleOf({ cycle_unit: null, cycle_count: null, billing_cycle });
    expect(legacy('weekly')).toEqual({ unit: 'week', count: 1 });
    expect(legacy('monthly')).toEqual({ unit: 'month', count: 1 });
    expect(legacy('quarterly')).toEqual({ unit: 'month', count: 3 });
    expect(legacy('yearly')).toEqual({ unit: 'year', count: 1 });
  });

  it('treats a missing or nonsense count as 1', () => {
    expect(cycleOf({ cycle_unit: 'week', cycle_count: null, billing_cycle: 'weekly' })).toEqual({
      unit: 'week',
      count: 1,
    });
    expect(cycleOf({ cycle_unit: 'month', cycle_count: 0, billing_cycle: 'monthly' })).toEqual({
      unit: 'month',
      count: 1,
    });
  });
});

describe('the billing day (month-end anchor)', () => {
  // Billed on the 31st: February has to move it to the 28th, and every later
  // month must come back to the 31st, not stay on the 28th for good.
  const monthly31 = { unit: 'month' as const, count: 1, anchorDay: 31 };

  it('is read from the row with the cycle', () => {
    expect(
      cycleOf({ cycle_unit: 'month', cycle_count: 1, billing_cycle: 'monthly', anchor_day: 31 }),
    ).toEqual(monthly31);
  });

  it('brings a clamped date back to the billing day', () => {
    expect(addCycle('2026-02-28', monthly31)).toBe('2026-03-31');
    expect(addCycle('2026-03-31', monthly31)).toBe('2026-04-30');
    expect(addCycle('2027-02-28', { unit: 'year', count: 1, anchorDay: 29 })).toBe('2028-02-29');
  });

  it('means nothing to day and week cycles', () => {
    expect(addCycle('2026-02-28', { unit: 'week', count: 1, anchorDay: 31 })).toBe('2026-03-07');
    expect(addCycle('2026-02-28', { unit: 'day', count: 10, anchorDay: 31 })).toBe('2026-03-10');
  });

  it('holds across a projection that starts on a clamped date', () => {
    expect(occurrences('2026-02-28', monthly31, '2026-02-01', '2026-05-31')).toEqual([
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
      '2026-05-31',
    ]);
  });

  it('comes back to the 31st from a 30-day month too', () => {
    expect(addCycle('2026-04-30', monthly31)).toBe('2026-05-31');
    expect(
      occurrences(
        '2026-11-30',
        { unit: 'month', count: 3, anchorDay: 31 },
        '2026-11-01',
        '2027-06-30',
      ),
    ).toEqual(['2026-11-30', '2027-02-28', '2027-05-31']);
  });

  // Pausing until the 20th, or resuming today, leaves the due date off the
  // billing day. That date is when it charges: the first charge is never
  // moved, and the billing day steers the later ones only when the due date
  // is the billing day itself or its month-end stand-in (28 Feb for the 31st).
  const monthly5 = { unit: 'month' as const, count: 1, anchorDay: 5 };

  it('never moves the due date itself onto the billing day', () => {
    expect(occurrences('2026-11-20', monthly5, '2026-11-01', '2026-12-31')).toEqual([
      '2026-11-20',
      '2026-12-20',
    ]);
    expect(occurrences('2026-10-19', monthly5, '2026-10-19', '2026-11-01')).toEqual(['2026-10-19']);
  });

  it('steps from a due date the billing day does not explain', () => {
    expect(addCycle('2026-10-19', monthly5)).toBe('2026-11-19');
    // The 15th is no month's stand-in for the 31st.
    expect(addCycle('2026-11-15', monthly31)).toBe('2026-12-15');
    expect(addCycle('2026-06-10', { unit: 'year', count: 1, anchorDay: 29 })).toBe('2027-06-10');
  });

  it('is the day picked in the form, kept while the date is left alone', () => {
    expect(anchorFor('2026-01-31')).toBe(31);
    // Saving an edit without touching a clamped date keeps the 31st...
    expect(anchorFor('2026-02-28', { next_due_date: '2026-02-28', anchor_day: 31 })).toBe(31);
    // ...and picking a new date makes that the billing day.
    expect(anchorFor('2026-02-27', { next_due_date: '2026-02-28', anchor_day: 31 })).toBe(27);
    expect(anchorFor('2026-02-28', { next_due_date: '2026-02-28', anchor_day: null })).toBe(28);
  });
});

describe('legacyCycleFor', () => {
  it('writes the nearest of the four v2 cycles', () => {
    expect(legacyCycleFor({ unit: 'week', count: 1 })).toBe('weekly');
    expect(legacyCycleFor({ unit: 'month', count: 1 })).toBe('monthly');
    expect(legacyCycleFor({ unit: 'day', count: 28 })).toBe('monthly');
    expect(legacyCycleFor({ unit: 'day', count: 56 })).toBe('monthly');
    expect(legacyCycleFor({ unit: 'day', count: 84 })).toBe('quarterly');
    expect(legacyCycleFor({ unit: 'month', count: 3 })).toBe('quarterly');
    expect(legacyCycleFor({ unit: 'month', count: 6 })).toBe('quarterly');
    expect(legacyCycleFor({ unit: 'year', count: 1 })).toBe('yearly');
  });

  it('calls a one-time charge yearly, the smallest monthly share v2 can show', () => {
    expect(legacyCycleFor({ unit: 'once', count: 1 })).toBe('yearly');
  });
});

describe('addCycle', () => {
  it('steps whole days across a daylight-saving change', () => {
    // 1 November 2026 is the autumn change in New York.
    expect(addCycle('2026-10-25', { unit: 'day', count: 28 })).toBe('2026-11-22');
    expect(addCycle('2026-10-31', { unit: 'day', count: 1 })).toBe('2026-11-01');
  });

  it('steps weeks across the spring change', () => {
    expect(addCycle('2026-03-02', { unit: 'week', count: 2 })).toBe('2026-03-16');
  });

  it('adds months from the date in one step, clamping only the result', () => {
    expect(addCycle('2026-01-31', { unit: 'month', count: 1 })).toBe('2026-02-28');
    // Two months in one step, not one month twice: the 31st survives.
    expect(addCycle('2026-01-31', { unit: 'month', count: 2 })).toBe('2026-03-31');
    expect(addCycle('2024-01-31', { unit: 'month', count: 1 })).toBe('2024-02-29');
    expect(addCycle('2026-11-15', { unit: 'month', count: 3 })).toBe('2027-02-15');
  });

  it('adds years, landing a leap day on the 28th in an ordinary year', () => {
    expect(addCycle('2024-02-29', { unit: 'year', count: 1 })).toBe('2025-02-28');
    expect(addCycle('2024-02-29', { unit: 'year', count: 4 })).toBe('2028-02-29');
  });

  it('has no next date for a one-time charge', () => {
    expect(addCycle('2026-10-20', { unit: 'once', count: 1 })).toBeNull();
  });
});

describe('occurrences', () => {
  it('keeps a month-end anchor across the whole projection', () => {
    // Stepped one by one, 31 Jan -> 28 Feb -> 28 Mar would lose the 31st for
    // good. Each date is measured from the first instead.
    expect(
      occurrences('2026-01-31', { unit: 'month', count: 1 }, '2026-01-01', '2026-05-31'),
    ).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31']);
  });

  it('starts inside the window when the first date is before it', () => {
    expect(
      occurrences('2026-10-01', { unit: 'week', count: 1 }, '2026-10-10', '2026-10-31'),
    ).toEqual(['2026-10-15', '2026-10-22', '2026-10-29']);
  });

  it('includes both ends of the window', () => {
    expect(
      occurrences('2026-10-10', { unit: 'day', count: 10 }, '2026-10-10', '2026-10-30'),
    ).toEqual(['2026-10-10', '2026-10-20', '2026-10-30']);
  });

  it('gives a one-time charge once, and only inside the window', () => {
    const once = { unit: 'once', count: 1 } as const;
    expect(occurrences('2026-10-20', once, '2026-10-01', '2026-12-31')).toEqual(['2026-10-20']);
    expect(occurrences('2026-10-20', once, '2026-11-01', '2026-12-31')).toEqual([]);
  });

  it('returns nothing for a window that ends before the first date', () => {
    expect(
      occurrences('2026-12-01', { unit: 'month', count: 1 }, '2026-10-01', '2026-11-30'),
    ).toEqual([]);
  });
});

describe('normalised cost', () => {
  it('matches v2 for the four old cycles', () => {
    expect(perMonthMinor(19900, { unit: 'month', count: 1 })).toBe(19900);
    expect(perMonthMinor(478800, { unit: 'year', count: 1 })).toBe(39900);
    expect(perMonthMinor(90000, { unit: 'month', count: 3 })).toBe(30000);
    // 52/12 weeks a month, not 4: four undercounts a weekly bill by ~8%.
    expect(perMonthMinor(20000, { unit: 'week', count: 1 })).toBe(Math.round((20000 * 52) / 12));
  });

  it('spreads a 28-day pack over the 13 it takes to fill a year', () => {
    // ₹299 every 28 days is ₹3,898 a year, not ₹3,588: thirteen packs.
    expect(perYearMinor(29900, { unit: 'day', count: 28 })).toBe(Math.round((29900 * 365) / 28));
    expect(perMonthMinor(29900, { unit: 'day', count: 28 })).toBe(
      Math.round((29900 * 365) / 28 / 12),
    );
  });

  it('gives a weekly figure', () => {
    expect(perWeekMinor(52000, { unit: 'year', count: 1 })).toBe(1000);
  });

  it('leaves a one-time charge out of recurring cost', () => {
    expect(perMonthMinor(99900, { unit: 'once', count: 1 })).toBe(0);
    expect(perYearMinor(99900, { unit: 'once', count: 1 })).toBe(0);
  });

  it('returns whole paise', () => {
    expect(Number.isInteger(perMonthMinor(33333, { unit: 'day', count: 28 }))).toBe(true);
    expect(Number.isInteger(perWeekMinor(10001, { unit: 'month', count: 1 }))).toBe(true);
  });
});

describe('labels', () => {
  it('names common cycles plainly and the rest by count', () => {
    expect(cycleLabel({ unit: 'month', count: 1 })).toBe('Monthly');
    expect(cycleLabel({ unit: 'month', count: 3 })).toBe('Quarterly');
    expect(cycleLabel({ unit: 'month', count: 6 })).toBe('Every 6 months');
    expect(cycleLabel({ unit: 'day', count: 28 })).toBe('Every 28 days');
    expect(cycleLabel({ unit: 'day', count: 1 })).toBe('Daily');
    expect(cycleLabel({ unit: 'week', count: 1 })).toBe('Weekly');
    expect(cycleLabel({ unit: 'week', count: 2 })).toBe('Every 2 weeks');
    expect(cycleLabel({ unit: 'year', count: 1 })).toBe('Yearly');
    expect(cycleLabel({ unit: 'year', count: 2 })).toBe('Every 2 years');
    expect(cycleLabel({ unit: 'once', count: 1 })).toBe('One-time');
  });

  it('has a short suffix for a price line', () => {
    expect(cycleSuffix({ unit: 'month', count: 1 })).toBe('/ mo');
    expect(cycleSuffix({ unit: 'month', count: 3 })).toBe('/ qtr');
    expect(cycleSuffix({ unit: 'day', count: 28 })).toBe('/ 28 days');
    expect(cycleSuffix({ unit: 'week', count: 1 })).toBe('/ wk');
    expect(cycleSuffix({ unit: 'year', count: 1 })).toBe('/ yr');
    expect(cycleSuffix({ unit: 'once', count: 1 })).toBe('once');
  });
});
