/**
 * The finance month.
 *
 * With a salary-day start every "this month" figure moves: totals, deltas,
 * budgets and their pace, the trend, the home tile. A period that is a day off
 * at a month end looks exactly like a right one, so the boundaries are tested
 * one by one, across year ends and short Februaries.
 *
 * These run in America/New_York (jest.timezone.js), so a day count that went
 * through local midnights would be caught out by the DST changes on 8 March
 * and 1 November 2026.
 */
import {
  comparisonFor,
  daysInclusive,
  normalizeStartDay,
  periodBounds,
  periodOf,
  periodProgress,
  periodSubtitle,
  periodTitle,
  recentPeriods,
  shiftPeriod,
  shortDate,
} from '../period';

/** Every calendar day of a year, built from (y, m, d) and never from a Date. */
function everyDay(year: number): string[] {
  const days: string[] = [];
  for (let month = 1; month <= 12; month++) {
    const last = new Date(year, month, 0).getDate();
    for (let day = 1; day <= last; day++) {
      days.push(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
    }
  }
  return days;
}

describe('normalizeStartDay', () => {
  it('keeps 1-31 and falls back to 1 for anything else', () => {
    expect(normalizeStartDay(25)).toBe(25);
    expect(normalizeStartDay(31)).toBe(31);
    expect(normalizeStartDay(0)).toBe(1);
    expect(normalizeStartDay(32)).toBe(1);
    expect(normalizeStartDay(2.5)).toBe(1);
    expect(normalizeStartDay(null)).toBe(1);
    expect(normalizeStartDay('7')).toBe(1);
  });
});

describe('periodBounds', () => {
  it('is the calendar month when the month starts on the 1st', () => {
    expect(periodBounds({ year: 2026, month: 2 }, 1)).toEqual({
      start: '2026-02-01',
      end: '2026-02-28',
    });
    expect(periodBounds({ year: 2028, month: 2 }, 1).end).toBe('2028-02-29');
  });

  it('names a late start after the month it ends in', () => {
    // Paid on 25 September: that money is October's.
    expect(periodBounds({ year: 2026, month: 10 }, 25)).toEqual({
      start: '2026-09-25',
      end: '2026-10-24',
    });
  });

  it('names an early start after the month it starts in', () => {
    expect(periodBounds({ year: 2026, month: 10 }, 5)).toEqual({
      start: '2026-10-05',
      end: '2026-11-04',
    });
  });

  it('treats the 15th as early and the 16th as late', () => {
    expect(periodBounds({ year: 2026, month: 10 }, 15).start).toBe('2026-10-15');
    expect(periodBounds({ year: 2026, month: 10 }, 16).start).toBe('2026-09-16');
  });

  it('rolls over the year in both directions', () => {
    expect(periodBounds({ year: 2027, month: 1 }, 25)).toEqual({
      start: '2026-12-25',
      end: '2027-01-24',
    });
    expect(periodBounds({ year: 2026, month: 12 }, 5)).toEqual({
      start: '2026-12-05',
      end: '2027-01-04',
    });
  });

  it('clamps a start day past the end of a short month to its last day', () => {
    // The 31st means "the last day of every month".
    expect(periodBounds({ year: 2026, month: 3 }, 31)).toEqual({
      start: '2026-02-28',
      end: '2026-03-30',
    });
    expect(periodBounds({ year: 2026, month: 2 }, 31)).toEqual({
      start: '2026-01-31',
      end: '2026-02-27',
    });
    // Leap year: February has a 29th to start on.
    expect(periodBounds({ year: 2028, month: 3 }, 30).start).toBe('2028-02-29');
    expect(periodBounds({ year: 2028, month: 3 }, 30).end).toBe('2028-03-29');
  });

  it('leaves no gap and no overlap between neighbouring periods', () => {
    [1, 2, 5, 15, 16, 25, 28, 29, 30, 31].forEach((startDay) => {
      let previous = periodBounds({ year: 2027, month: 1 }, startDay);
      for (let i = 1; i < 30; i++) {
        const next = periodBounds(shiftPeriod({ year: 2027, month: 1 }, i), startDay);
        const dayAfter = new Date(
          Number(previous.end.slice(0, 4)),
          Number(previous.end.slice(5, 7)) - 1,
          Number(previous.end.slice(8, 10)) + 1,
        );
        const expected = `${dayAfter.getFullYear()}-${String(dayAfter.getMonth() + 1).padStart(2, '0')}-${String(dayAfter.getDate()).padStart(2, '0')}`;
        expect(next.start).toBe(expected);
        previous = next;
      }
    });
  });
});

describe('periodOf', () => {
  it('finds the period a day belongs to', () => {
    expect(periodOf('2026-10-19', 25)).toEqual({ year: 2026, month: 10 });
    expect(periodOf('2026-10-25', 25)).toEqual({ year: 2026, month: 11 });
    expect(periodOf('2026-10-24', 25)).toEqual({ year: 2026, month: 10 });
    expect(periodOf('2026-10-04', 5)).toEqual({ year: 2026, month: 9 });
    expect(periodOf('2026-10-05', 5)).toEqual({ year: 2026, month: 10 });
  });

  it('crosses the year end', () => {
    expect(periodOf('2026-12-27', 25)).toEqual({ year: 2027, month: 1 });
    expect(periodOf('2027-01-03', 5)).toEqual({ year: 2026, month: 12 });
  });

  it('puts every day of a year inside the period it names, for every kind of start day', () => {
    [1, 3, 15, 16, 25, 29, 30, 31].forEach((startDay) => {
      [...everyDay(2027), ...everyDay(2028)].forEach((iso) => {
        const bounds = periodBounds(periodOf(iso, startDay), startDay);
        expect(iso >= bounds.start && iso <= bounds.end).toBe(true);
      });
    });
  });
});

describe('daysInclusive', () => {
  it('counts both ends', () => {
    expect(daysInclusive('2026-10-01', '2026-10-31')).toBe(31);
    expect(daysInclusive('2026-10-19', '2026-10-19')).toBe(1);
  });

  it('is not thrown by a daylight-saving change', () => {
    // 8 March and 1 November are 23- and 25-hour days in New York.
    expect(daysInclusive('2026-03-01', '2026-03-31')).toBe(31);
    expect(daysInclusive('2026-10-25', '2026-11-24')).toBe(31);
  });
});

describe('periodProgress', () => {
  const october = { start: '2026-10-01', end: '2026-10-31' };

  it('counts today as elapsed and as still to come', () => {
    // Day 17 of 31: the spec's "₹156/day for 15 days".
    expect(periodProgress(october, '2026-10-17')).toEqual({ days: 31, elapsed: 17, daysLeft: 15 });
  });

  it('is all to come before the period and all gone after it', () => {
    expect(periodProgress(october, '2026-09-30')).toEqual({ days: 31, elapsed: 0, daysLeft: 31 });
    expect(periodProgress(october, '2026-11-01')).toEqual({ days: 31, elapsed: 31, daysLeft: 0 });
  });

  it('has one day left on the last day', () => {
    expect(periodProgress(october, '2026-10-31')).toEqual({ days: 31, elapsed: 31, daysLeft: 1 });
  });
});

describe('labels', () => {
  it('titles a period by its month, day first in ranges', () => {
    expect(periodTitle({ year: 2026, month: 10 })).toBe('October 2026');
    expect(shortDate('2026-09-25')).toBe('25 Sep');
    expect(periodSubtitle({ year: 2026, month: 10 }, 25)).toBe('25 Sep – 24 Oct');
  });

  it('needs no range when the month starts on the 1st', () => {
    expect(periodSubtitle({ year: 2026, month: 10 }, 1)).toBeNull();
  });
});

describe('shiftPeriod and recentPeriods', () => {
  it('steps across the year end', () => {
    expect(shiftPeriod({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftPeriod({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
  });

  it('lists the last N periods, oldest first, ending at the one given', () => {
    expect(recentPeriods({ year: 2026, month: 2 }, 3)).toEqual([
      { year: 2025, month: 12 },
      { year: 2026, month: 1 },
      { year: 2026, month: 2 },
    ]);
  });
});

describe('comparisonFor', () => {
  const october = { year: 2026, month: 10 };

  it('while a month runs, takes as many days of the one before, and says which', () => {
    expect(comparisonFor(october, 1, '2026-10-05')).toEqual({
      range: { start: '2026-09-01', end: '2026-09-05' },
      short: '1–5 Sep',
      long: '1 to 5 September',
    });
    expect(comparisonFor(october, 1, '2026-10-01')).toEqual({
      range: { start: '2026-09-01', end: '2026-09-01' },
      short: '1 Sep',
      long: '1 September',
    });
  });

  it('takes the whole of the one before once a month is over', () => {
    const whole = {
      range: { start: '2026-09-01', end: '2026-09-30' },
      short: 'Sep',
      long: 'September',
    };
    expect(comparisonFor(october, 1, '2026-11-02')).toEqual(whole);
    // On the last day, the month is as good as done.
    expect(comparisonFor(october, 1, '2026-10-31')).toEqual(whole);
    // And from the 30th, September has no more days to add.
    expect(comparisonFor(october, 1, '2026-10-30')).toEqual(whole);
  });

  it('runs out at the end of a short February', () => {
    expect(comparisonFor({ year: 2026, month: 3 }, 1, '2026-03-29').short).toBe('Feb');
    expect(comparisonFor({ year: 2026, month: 3 }, 1, '2026-03-27').short).toBe('1–27 Feb');
  });

  it('crosses a month end with a salary-day start', () => {
    // 25 Sep - 24 Oct is October; on 20 Oct, 26 of its days have gone, so
    // September's period (25 Aug - 24 Sep) is cut to 25 Aug - 19 Sep.
    expect(comparisonFor(october, 25, '2026-10-20')).toEqual({
      range: { start: '2026-08-25', end: '2026-09-19' },
      short: '25 Aug – 19 Sep',
      long: '25 August to 19 September',
    });
  });

  it('counts days across the spring daylight-saving change', () => {
    // 8 March 2026 has 23 hours in New York; ten days are still ten.
    expect(comparisonFor({ year: 2026, month: 3 }, 1, '2026-03-10').range).toEqual({
      start: '2026-02-01',
      end: '2026-02-10',
    });
  });
});
