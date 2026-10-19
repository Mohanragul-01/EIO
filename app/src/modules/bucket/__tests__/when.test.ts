/**
 * When something was done, as precisely as you actually know it.
 *
 * Every one of the 818 items came in undone, so most of what gets ticked was
 * really done years ago. "Sometime in 2019" is the honest answer for a lot of
 * them, and it must not come back out as "1 Jan 2019".
 *
 * Dates are built from (y, m, d) strings only, so these hold in any timezone -
 * the suite runs in New York to prove it across daylight saving.
 */
import {
  addDaysTo,
  describeWhen,
  formatWhen,
  isFutureWhen,
  whenFromDone,
  whenToDone,
  type WhenChoice,
} from '../when';

describe('formatWhen', () => {
  it('says only what is known', () => {
    expect(formatWhen('2019-03-14', 'day')).toBe('14 Mar 2019');
    expect(formatWhen('2019-03-01', 'month')).toBe('Mar 2019');
    expect(formatWhen('2019-01-01', 'year')).toBe('2019');
  });

  it('has a short form for chips', () => {
    expect(formatWhen('2019-03-14', 'day', { short: true })).toBe("14 Mar '19");
    expect(formatWhen('2026-03-01', 'month', { short: true })).toBe("Mar '26");
    expect(formatWhen('2019-01-01', 'year', { short: true })).toBe('2019');
  });
});

describe('addDaysTo', () => {
  it('crosses month and year ends', () => {
    expect(addDaysTo('2026-03-31', 1)).toBe('2026-04-01');
    expect(addDaysTo('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysTo('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDaysTo('2028-03-01', -1)).toBe('2028-02-29');
  });

  it('is not moved by a daylight-saving change', () => {
    // New York springs forward on 8 March 2026 and falls back on 1 November.
    // Adding 24 hours of milliseconds would land on the wrong side of both.
    expect(addDaysTo('2026-03-08', 1)).toBe('2026-03-09');
    expect(addDaysTo('2026-03-09', -1)).toBe('2026-03-08');
    expect(addDaysTo('2026-11-01', 1)).toBe('2026-11-02');
    expect(addDaysTo('2026-11-02', -1)).toBe('2026-11-01');
  });

  it('adds thirty days for Not now', () => {
    expect(addDaysTo('2026-10-19', 30)).toBe('2026-11-18');
  });
});

describe('whenToDone', () => {
  const today = '2026-10-19';

  it('stores today and yesterday to the day', () => {
    expect(whenToDone({ kind: 'today' }, today)).toEqual({
      done_on: '2026-10-19',
      done_precision: 'day',
    });
    expect(whenToDone({ kind: 'yesterday' }, '2026-11-01')).toEqual({
      done_on: '2026-10-31',
      done_precision: 'day',
    });
  });

  it('stores a month as its first day, marked as a month', () => {
    expect(whenToDone({ kind: 'earlier', year: 2019, month: 3, day: null }, today)).toEqual({
      done_on: '2019-03-01',
      done_precision: 'month',
    });
  });

  it('stores a year as 1 January, marked as a year', () => {
    expect(whenToDone({ kind: 'earlier', year: 2019, month: null, day: null }, today)).toEqual({
      done_on: '2019-01-01',
      done_precision: 'year',
    });
  });

  it('stores an exact day exactly', () => {
    expect(whenToDone({ kind: 'earlier', year: 2019, month: 3, day: 14 }, today)).toEqual({
      done_on: '2019-03-14',
      done_precision: 'day',
    });
  });

  it('ignores a day without a month, rather than inventing January', () => {
    expect(
      whenToDone({ kind: 'earlier', year: 2019, month: null, day: 14 }, today).done_precision,
    ).toBe('year');
  });

  it('clamps a day that the month does not have', () => {
    // Picking the 31st, then switching the month to February.
    expect(whenToDone({ kind: 'earlier', year: 2026, month: 2, day: 31 }, today).done_on).toBe(
      '2026-02-28',
    );
  });
});

describe('whenFromDone', () => {
  const today = '2026-10-19';

  it('reads today and yesterday back as those choices', () => {
    expect(whenFromDone('2026-10-19', 'day', today)).toEqual({ kind: 'today' });
    expect(whenFromDone('2026-10-18', 'day', today)).toEqual({ kind: 'yesterday' });
  });

  it('round-trips every earlier precision', () => {
    const choices: WhenChoice[] = [
      { kind: 'earlier', year: 2019, month: null, day: null },
      { kind: 'earlier', year: 2019, month: 3, day: null },
      { kind: 'earlier', year: 2019, month: 3, day: 14 },
    ];
    choices.forEach((choice) => {
      const { done_on, done_precision } = whenToDone(choice, today);
      expect(whenFromDone(done_on, done_precision, today)).toEqual(choice);
    });
  });

  it('reads a v2 tick with no precision as a day', () => {
    expect(whenFromDone('2025-06-02', null, today)).toEqual({
      kind: 'earlier',
      year: 2025,
      month: 6,
      day: 2,
    });
  });

  it('offers today for something not yet dated', () => {
    expect(whenFromDone(null, null, today)).toEqual({ kind: 'today' });
  });
});

describe('isFutureWhen', () => {
  const today = '2026-10-19';
  const earlier = (year: number, month: number | null, day: number | null): WhenChoice => ({
    kind: 'earlier',
    year,
    month,
    day,
  });

  it('allows anything up to today', () => {
    expect(isFutureWhen({ kind: 'today' }, today)).toBe(false);
    expect(isFutureWhen({ kind: 'yesterday' }, today)).toBe(false);
    expect(isFutureWhen(earlier(2026, null, null), today)).toBe(false);
    expect(isFutureWhen(earlier(2026, 10, null), today)).toBe(false);
    expect(isFutureWhen(earlier(2026, 10, 19), today)).toBe(false);
  });

  it('refuses what has not happened yet', () => {
    expect(isFutureWhen(earlier(2027, null, null), today)).toBe(true);
    expect(isFutureWhen(earlier(2026, 11, null), today)).toBe(true);
    expect(isFutureWhen(earlier(2026, 10, 20), today)).toBe(true);
  });
});

describe('describeWhen', () => {
  const today = '2026-10-19';

  it('names each choice the way the bar and the sheet say it', () => {
    expect(describeWhen({ kind: 'today' }, today)).toBe('Today');
    expect(describeWhen({ kind: 'yesterday' }, today)).toBe('Yesterday');
    expect(describeWhen({ kind: 'earlier', year: 2019, month: null, day: null }, today)).toBe(
      'Sometime in 2019',
    );
    expect(describeWhen({ kind: 'earlier', year: 2019, month: 3, day: null }, today)).toBe(
      'Mar 2019',
    );
    expect(describeWhen({ kind: 'earlier', year: 2019, month: 3, day: 14 }, today)).toBe(
      '14 Mar 2019',
    );
  });
});
