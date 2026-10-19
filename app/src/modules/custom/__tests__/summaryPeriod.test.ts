/**
 * The tile statistic over a period, and over the v3 number-like types.
 *
 * "₹42,000 all time" stops meaning anything after a few months; "₹4,200 this
 * month" is the number you act on. The period scopes everything the tile
 * says, the count included, so a tile never puts a weekly figure next to an
 * all-time one.
 */
import { sortRecords, summarise } from '../summary';
import { makeField, makeModule, makeRecord } from '../testing';

const TODAY = '2026-10-21'; // a Wednesday; the week runs 19-25 Oct
const when = makeField({ key: 'when', type: 'date' });
const spent = makeField({ key: 'spent', label: 'Spent', type: 'money' });

const records = [
  makeRecord({ when: '2026-10-20', spent: 120000 }),
  makeRecord({ when: '2026-10-19', spent: 300000 }),
  makeRecord({ when: '2026-10-02', spent: 50000 }),
  makeRecord({ when: '2026-09-30', spent: 999900 }),
];

describe('summarise over a period', () => {
  it('totals only this week', () => {
    const module = makeModule({ summary_field_key: 'spent', summary_agg: 'sum', summary_period: 'week' });
    const result = summarise(module, spent, records, { today: TODAY, dateField: when });
    expect(result.text).toBe('₹4,200 this week');
    expect(result.isFallback).toBe(false);
  });

  it('totals only this month', () => {
    const module = makeModule({ summary_field_key: 'spent', summary_agg: 'sum', summary_period: 'month' });
    expect(summarise(module, spent, records, { today: TODAY, dateField: when }).text).toBe(
      '₹4,700 this month',
    );
  });

  it('counts within the period too', () => {
    const module = makeModule({ summary_agg: 'count', summary_period: 'week' });
    expect(summarise(module, null, records, { today: TODAY, dateField: when }).text).toBe('2 this week');
  });

  it('says so when the period is empty, rather than falling back to all time', () => {
    const module = makeModule({ summary_field_key: 'spent', summary_agg: 'sum', summary_period: 'week' });
    const result = summarise(module, spent, [records[3]], { today: TODAY, dateField: when });
    expect(result.text).toBe('None this week');
  });

  it('marks an average as one', () => {
    const hours = makeField({ key: 'hours', label: 'Hours', type: 'number' });
    const module = makeModule({ summary_field_key: 'hours', summary_agg: 'average', summary_period: 'week' });
    const result = summarise(
      module,
      hours,
      [makeRecord({ when: '2026-10-20', hours: 7 }), makeRecord({ when: '2026-10-21', hours: 8 })],
      { today: TODAY, dateField: when },
    );
    expect(result.text).toBe('7.5 avg this week');
  });

  it('uses the day an entry was logged when there is no date field', () => {
    const module = makeModule({ summary_agg: 'count', summary_period: 'week' });
    const logged = [makeRecord({}, [2026, 10, 20]), makeRecord({}, [2026, 10, 1])];
    expect(summarise(module, null, logged, { today: TODAY, dateField: null }).text).toBe('1 this week');
  });

  it('leaves an all-time tile exactly as v2 showed it', () => {
    const module = makeModule({ summary_field_key: 'spent', summary_agg: 'sum', summary_period: 'all' });
    expect(summarise(module, spent, records, { today: TODAY, dateField: when }).text).toBe('₹14,699');
  });
});

describe('summarise the v3 number-like types', () => {
  it('totals a duration as hours and minutes', () => {
    const slept = makeField({ key: 'slept', type: 'duration' });
    const module = makeModule({ summary_field_key: 'slept', summary_agg: 'sum' });
    expect(summarise(module, slept, [makeRecord({ slept: 450 }), makeRecord({ slept: 420 })]).text).toBe(
      '14 h 30 m',
    );
  });

  it('averages a rating out of five, to one decimal', () => {
    const stars = makeField({ key: 'stars', type: 'rating' });
    const module = makeModule({ summary_field_key: 'stars', summary_agg: 'average' });
    const rated = [makeRecord({ stars: 4 }), makeRecord({ stars: 5 }), makeRecord({ stars: 4 })];
    expect(summarise(module, stars, rated).text).toBe('4.3/5');
  });

  it('finds the latest answer by when it was logged, whatever order it was given in', () => {
    // The list hands records over in its own sort order, not newest first.
    const hours = makeField({ key: 'hours', type: 'number' });
    const module = makeModule({ summary_field_key: 'hours', summary_agg: 'latest' });
    const mixed = [
      makeRecord({ hours: 5 }, [2026, 1, 1]),
      makeRecord({ hours: 9 }, [2026, 1, 3]),
      makeRecord({ hours: null }, [2026, 1, 4]),
    ];
    expect(summarise(module, hours, mixed).text).toBe('9');
  });

  it('skips a latest value that no longer reads as the field type', () => {
    const hours = makeField({ key: 'hours', type: 'number' });
    const module = makeModule({ summary_field_key: 'hours', summary_agg: 'latest' });
    const mixed = [makeRecord({ hours: 6 }, [2026, 1, 1]), makeRecord({ hours: 'lots' }, [2026, 1, 2])];
    expect(summarise(module, hours, mixed).text).toBe('6');
  });
});

describe('sortRecords for the v3 types', () => {
  it('sorts durations and ratings as numbers', () => {
    const slept = makeField({ key: 'slept', type: 'duration' });
    const sorted = sortRecords(
      [makeRecord({ slept: 90 }), makeRecord({ slept: 600 }), makeRecord({ slept: 120 })],
      { sort_field_key: 'slept', sort_direction: 'asc' },
      slept,
    );
    expect(sorted.map((r) => r.data.slept)).toEqual([90, 120, 600]);
  });
});
