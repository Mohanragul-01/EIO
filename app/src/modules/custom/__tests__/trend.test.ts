/**
 * The trend chart's series maths: buckets, sums and averages, smoothing.
 *
 * "Am I sleeping more this month?" is the reason to keep a log at all, and a
 * chart answers it only if the maths underneath is honest: a day with no
 * reading is a zero in a total but not in an average, and a week starts on
 * the same day everywhere in the app. Runs in America/New_York, so the week
 * buckets cross a daylight-saving change.
 */
import {
  buildSeries,
  chartFieldOf,
  describeChart,
  movingAverage,
  pointLabel,
  rangeStartISO,
  sparkPath,
  sparklineFor,
} from '../trend';
import { makeField, makeModule, makeRecord } from '../testing';

const when = makeField({ key: 'when', type: 'date', position: 0 });
const pages = makeField({ key: 'pages', label: 'Pages', type: 'number', position: 1 });

const values = (points: { value: number }[]) => points.map((p) => p.value);
const dates = (points: { date: string }[]) => points.map((p) => p.date);

describe('buildSeries by day', () => {
  const records = [
    makeRecord({ when: '2026-10-01', pages: 20 }),
    makeRecord({ when: '2026-10-01', pages: 10 }),
    makeRecord({ when: '2026-10-04', pages: 40 }),
  ];

  it('totals each day and fills the days between with zero', () => {
    const series = buildSeries(records, { valueField: pages, dateField: when, bucket: 'day', agg: 'sum' });
    expect(dates(series)).toEqual(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']);
    expect(values(series)).toEqual([30, 0, 0, 40]);
  });

  it('averages each day and leaves empty days out, since an average of nothing is not zero', () => {
    const series = buildSeries(records, { valueField: pages, dateField: when, bucket: 'day', agg: 'average' });
    expect(dates(series)).toEqual(['2026-10-01', '2026-10-04']);
    expect(values(series)).toEqual([15, 40]);
  });
});

describe('buildSeries by week and month', () => {
  it('buckets weeks from Monday, across the US daylight-saving change', () => {
    const records = [
      makeRecord({ when: '2026-10-28', pages: 5 }), // Wed
      makeRecord({ when: '2026-11-01', pages: 5 }), // Sun, the day clocks change
      makeRecord({ when: '2026-11-02', pages: 7 }), // Mon
    ];
    const series = buildSeries(records, { valueField: pages, dateField: when, bucket: 'week', agg: 'sum' });
    expect(dates(series)).toEqual(['2026-10-26', '2026-11-02']);
    expect(values(series)).toEqual([10, 7]);
  });

  it('fills an empty week between two with zero', () => {
    const records = [makeRecord({ when: '2026-10-05', pages: 1 }), makeRecord({ when: '2026-10-19', pages: 2 })];
    const series = buildSeries(records, { valueField: pages, dateField: when, bucket: 'week', agg: 'sum' });
    expect(dates(series)).toEqual(['2026-10-05', '2026-10-12', '2026-10-19']);
    expect(values(series)).toEqual([1, 0, 2]);
  });

  it('buckets months, across a year end', () => {
    const records = [makeRecord({ when: '2026-12-31', pages: 3 }), makeRecord({ when: '2027-02-01', pages: 4 })];
    const series = buildSeries(records, { valueField: pages, dateField: when, bucket: 'month', agg: 'sum' });
    expect(dates(series)).toEqual(['2026-12-01', '2027-01-01', '2027-02-01']);
    expect(values(series)).toEqual([3, 0, 4]);
  });
});

describe('buildSeries as logged', () => {
  it('keeps every entry as its own point, in date order then logged order', () => {
    const records = [
      makeRecord({ when: '2026-10-02', pages: 2 }, [2026, 10, 2, 9]),
      makeRecord({ when: '2026-10-01', pages: 1 }, [2026, 10, 3]),
      makeRecord({ when: '2026-10-02', pages: 3 }, [2026, 10, 2, 20]),
    ];
    const series = buildSeries(records, { valueField: pages, dateField: when, bucket: 'entry', agg: 'sum' });
    expect(values(series)).toEqual([1, 2, 3]);
    // Every point has its own key, so a chart can tell two same-day entries apart.
    expect(new Set(series.map((p) => p.key)).size).toBe(3);
  });
});

describe('buildSeries reads values carefully', () => {
  it('dates an entry by when it was logged when the date field is blank or absent', () => {
    const records = [makeRecord({ pages: 4 }, [2026, 10, 7, 23])];
    expect(dates(buildSeries(records, { valueField: pages, dateField: null, bucket: 'day', agg: 'sum' }))).toEqual([
      '2026-10-07',
    ]);
  });

  it('skips blanks and values that do not read as the field type', () => {
    const stars = makeField({ key: 'stars', type: 'rating' });
    const records = [
      makeRecord({ when: '2026-10-01', stars: 4 }),
      makeRecord({ when: '2026-10-01', stars: 9 }), // kept in storage, not a rating
      makeRecord({ when: '2026-10-01', stars: null }),
      makeRecord({ when: '2026-10-01', stars: '5' }), // a leftover string still reads
    ];
    const series = buildSeries(records, { valueField: stars, dateField: when, bucket: 'day', agg: 'average' });
    expect(values(series)).toEqual([4.5]);
  });

  it('starts at the range start', () => {
    const records = [makeRecord({ when: '2026-09-01', pages: 1 }), makeRecord({ when: '2026-10-10', pages: 2 })];
    const series = buildSeries(records, {
      valueField: pages,
      dateField: when,
      bucket: 'day',
      agg: 'sum',
      from: '2026-10-01',
    });
    expect(dates(series)).toEqual(['2026-10-10']);
  });

  it('is empty when there is nothing to draw', () => {
    expect(buildSeries([], { valueField: pages, dateField: when, bucket: 'day', agg: 'sum' })).toEqual([]);
  });
});

describe('movingAverage', () => {
  it('averages the trailing window, and whatever exists at the start', () => {
    expect(movingAverage([2, 4, 6, 8], 3)).toEqual([2, 3, 4, 6]);
  });

  it('is the series itself for a window of one', () => {
    expect(movingAverage([5, 1], 1)).toEqual([5, 1]);
  });

  it('is attached to each point when asked for', () => {
    const records = [
      makeRecord({ when: '2026-10-01', pages: 2 }),
      makeRecord({ when: '2026-10-02', pages: 4 }),
    ];
    const series = buildSeries(records, { valueField: pages, dateField: when, bucket: 'day', agg: 'sum', window: 2 });
    expect(series.map((p) => p.smooth)).toEqual([2, 3]);
    const plain = buildSeries(records, { valueField: pages, dateField: when, bucket: 'day', agg: 'sum' });
    expect(plain.every((p) => p.smooth === null)).toBe(true);
  });
});

describe('chartFieldOf', () => {
  const note = makeField({ key: 'note', type: 'text', position: 0 });
  const slept = makeField({ key: 'slept', type: 'duration', position: 2 });
  const fields = [note, pages, slept];

  it('charts the configured field', () => {
    expect(chartFieldOf(makeModule({ chart_field_key: 'slept' }), fields)?.key).toBe('slept');
  });

  it('charts the first number-like field when none is chosen, or the choice is gone', () => {
    expect(chartFieldOf(makeModule(), fields)?.key).toBe('pages');
    expect(chartFieldOf(makeModule({ chart_field_key: 'gone' }), fields)?.key).toBe('pages');
  });

  it('has no chart without a number-like field, or when hidden', () => {
    expect(chartFieldOf(makeModule(), [note])).toBeNull();
    expect(chartFieldOf(makeModule({ chart_hidden: true }), fields)).toBeNull();
  });
});

describe('sparklineFor', () => {
  it('is the last twelve points of the module chart', () => {
    const records = Array.from({ length: 20 }, (_, i) =>
      makeRecord({ when: `2026-10-${String(i + 1).padStart(2, '0')}`, pages: i + 1 }),
    );
    const spark = sparklineFor(makeModule(), [when, pages], records);
    expect(spark).toEqual([9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
  });

  it('is nothing for a single point or no number-like field', () => {
    expect(sparklineFor(makeModule(), [when, pages], [makeRecord({ when: '2026-10-01', pages: 3 })])).toBeNull();
    expect(sparklineFor(makeModule(), [when], [makeRecord({ when: '2026-10-01' })])).toBeNull();
  });

  it('follows the smoothed line when the chart is smoothed', () => {
    const records = [
      makeRecord({ when: '2026-10-01', pages: 2 }),
      makeRecord({ when: '2026-10-02', pages: 4 }),
    ];
    expect(sparklineFor(makeModule({ chart_window: 2 }), [when, pages], records)).toEqual([2, 3]);
  });
});

describe('rangeStartISO', () => {
  it('counts back by calendar days', () => {
    expect(rangeStartISO('1m', '2026-10-19')).toBe('2026-09-19');
    expect(rangeStartISO('3m', '2026-10-19')).toBe('2026-07-20');
    expect(rangeStartISO('1y', '2026-10-19')).toBe('2025-10-19');
    expect(rangeStartISO('all', '2026-10-19')).toBeNull();
  });
});

describe('sparkPath', () => {
  it('spans the box, highest point at the top, with room for the stroke', () => {
    expect(sparkPath([0, 10], 100, 20)).toBe('M2.0 18.0 L98.0 2.0');
  });

  it('draws a flat line through the middle rather than along the floor', () => {
    expect(sparkPath([5, 5, 5], 100, 20)).toBe('M2.0 10.0 L50.0 10.0 L98.0 10.0');
  });
});

describe('chart wording', () => {
  it('says what a point is', () => {
    expect(describeChart(makeModule({ chart_bucket: 'day', chart_agg: 'sum' }))).toBe('Daily total');
    expect(describeChart(makeModule({ chart_bucket: 'week', chart_agg: 'average' }))).toBe('Weekly average');
    expect(describeChart(makeModule({ chart_bucket: 'entry' }))).toBe('Each entry');
    expect(describeChart(makeModule({ chart_bucket: 'month', chart_window: 3 }))).toBe(
      'Monthly total · 3-point average',
    );
  });

  it('names a week by its first day', () => {
    expect(pointLabel('2026-10-19', 'week').startsWith('Week of ')).toBe(true);
    expect(pointLabel('2026-10-19', 'day')).not.toContain('Week');
  });
});
