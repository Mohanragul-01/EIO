/**
 * trend.ts - the numbers behind a module's trend chart and home sparkline.
 *
 * A tile can say "7 h 30 m average"; only a line can say "and it has been
 * falling for three weeks", which is the reason to keep a log at all. This
 * file turns entries into that line and nothing else: both clients draw it
 * their own way (react-native-svg on the phone, recharts on the website) from
 * the same points.
 *
 * TWO HONESTY RULES, both tested:
 *   - A total fills the empty days, weeks or months between the first and last
 *     with 0, because no pages read on Tuesday is a real zero. An average
 *     leaves them out, because the average of nothing is not zero - a dip to
 *     zero there would be invented.
 *   - The smoothed line is a TRAILING moving average that averages whatever
 *     exists at the start, so it begins with the data instead of N points in.
 */
import { addDaysTo, dateFieldOf, entryDateOf, monthStartISO, weekStartISO } from './entryDate';
import { isEmptyValue, numericValue, readableAs } from './format';
import {
  isNumericType,
  type ChartAgg,
  type ChartBucket,
  type CustomField,
  type CustomModule,
  type CustomRecord,
} from './types';

export type SeriesPoint = {
  /** Unique within the series, so two entries on one day stay two points. */
  key: string;
  /** The day the point stands for: the entry's day, or its bucket's first day. */
  date: string;
  value: number;
  /** The moving average at this point, or null when smoothing is off. */
  smooth: number | null;
};

export type SeriesOptions = {
  valueField: CustomField;
  dateField: CustomField | null;
  bucket: ChartBucket;
  agg: ChartAgg;
  /** Points in the trailing moving average; null or absent is off. */
  window?: number | null;
  /** Leave out anything dated before this day. */
  from?: string | null;
};

/** The first day of the bucket a day falls in. */
function bucketStart(iso: string, bucket: ChartBucket): string {
  if (bucket === 'week') return weekStartISO(iso);
  if (bucket === 'month') return monthStartISO(iso);
  return iso;
}

/** The first day of the bucket after this one. */
function nextBucket(start: string, bucket: ChartBucket): string {
  if (bucket === 'week') return addDaysTo(start, 7);
  if (bucket === 'month') {
    const [year, month] = start.split('-').map(Number);
    const nextYear = month === 12 ? year + 1 : year;
    const nextMonth = month === 12 ? 1 : month + 1;
    return `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
  }
  return addDaysTo(start, 1);
}

/** Trailing average over `window` points, over fewer where fewer exist yet. */
export function movingAverage(values: number[], window: number): number[] {
  const size = Math.max(1, Math.round(window));
  return values.map((_, index) => {
    const slice = values.slice(Math.max(0, index - size + 1), index + 1);
    return slice.reduce((sum, value) => sum + value, 0) / slice.length;
  });
}

/** Build the chart's points. Empty when there is nothing to draw. */
export function buildSeries(records: CustomRecord[], options: SeriesOptions): SeriesPoint[] {
  const { valueField, dateField, bucket, agg, window, from } = options;

  // Every entry with a value that reads as the field's type. A rating of 9,
  // kept from a 1-10 number field, is not drawn as nine stars.
  const entries = records
    .map((record) => {
      const raw = record.data[valueField.key];
      if (isEmptyValue(raw) || !readableAs(valueField.type, raw)) return null;
      const value = numericValue(raw);
      if (value === null) return null;
      return { record, date: entryDateOf(record, dateField), value };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .filter((entry) => !from || entry.date >= from);

  if (entries.length === 0) return [];

  let points: Omit<SeriesPoint, 'smooth'>[];

  if (bucket === 'entry') {
    points = entries
      .sort(
        (a, b) =>
          a.date.localeCompare(b.date) || a.record.created_at.localeCompare(b.record.created_at),
      )
      .map((entry) => ({ key: entry.record.id, date: entry.date, value: entry.value }));
  } else {
    const groups = new Map<string, number[]>();
    entries.forEach((entry) => {
      const start = bucketStart(entry.date, bucket);
      const group = groups.get(start);
      if (group) group.push(entry.value);
      else groups.set(start, [entry.value]);
    });

    const starts = [...groups.keys()].sort();
    const reduce = (list: number[]) => {
      const total = list.reduce((sum, value) => sum + value, 0);
      return agg === 'average' ? total / list.length : total;
    };

    if (agg === 'sum') {
      // Walk every bucket from the first to the last, so a quiet week shows
      // as the zero it was rather than the line skipping over it.
      points = [];
      const last = starts[starts.length - 1];
      for (let start = starts[0]; start <= last; start = nextBucket(start, bucket)) {
        const group = groups.get(start);
        points.push({ key: start, date: start, value: group ? reduce(group) : 0 });
      }
    } else {
      points = starts.map((start) => ({
        key: start,
        date: start,
        value: reduce(groups.get(start) ?? []),
      }));
    }
  }

  const smooth = window ? movingAverage(points.map((p) => p.value), window) : null;
  return points.map((point, index) => ({ ...point, smooth: smooth ? smooth[index] : null }));
}

/**
 * The field a module charts: the chosen one if it is still number-like, else
 * the first number-like field. Null - no chart, not an empty one - when the
 * module has none or the chart is switched off.
 */
export function chartFieldOf(
  module: Pick<CustomModule, 'chart_field_key' | 'chart_hidden'>,
  fields: CustomField[],
): CustomField | null {
  if (module.chart_hidden) return null;
  const numeric = [...fields]
    .sort((a, b) => a.position - b.position)
    .filter((field) => isNumericType(field.type));
  return numeric.find((field) => field.key === module.chart_field_key) ?? numeric[0] ?? null;
}

/**
 * The home tile's sparkline: the last twelve points of the module's own
 * chart, smoothed if the chart is. Null under two points, since one point is
 * a dot, not a trend.
 */
export function sparklineFor(
  module: Pick<CustomModule, 'chart_field_key' | 'chart_hidden' | 'chart_bucket' | 'chart_agg' | 'chart_window'>,
  fields: CustomField[],
  records: CustomRecord[],
): number[] | null {
  const valueField = chartFieldOf(module, fields);
  if (!valueField) return null;

  const series = buildSeries(records, {
    valueField,
    dateField: dateFieldOf(fields),
    bucket: module.chart_bucket ?? 'day',
    agg: module.chart_agg ?? 'sum',
    window: module.chart_window,
  }).slice(-12);

  if (series.length < 2) return null;
  return series.map((point) => point.smooth ?? point.value);
}

/** The chart's range choices, and the day each one starts on. */
export type ChartRange = '1m' | '3m' | '1y' | 'all';

export const CHART_RANGES: ChartRange[] = ['1m', '3m', '1y', 'all'];

export const CHART_RANGE_LABEL: Record<ChartRange, string> = {
  '1m': '1M',
  '3m': '3M',
  '1y': '1Y',
  all: 'All',
};

const RANGE_DAYS: Record<Exclude<ChartRange, 'all'>, number> = { '1m': 30, '3m': 91, '1y': 365 };

export function rangeStartISO(range: ChartRange, today: string): string | null {
  return range === 'all' ? null : addDaysTo(today, -RANGE_DAYS[range]);
}
