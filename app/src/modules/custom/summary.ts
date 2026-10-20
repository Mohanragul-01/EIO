/**
 * summary.ts - the tile stat and the list sort, as pure functions.
 *
 * Both operate on jsonb values, which arrive as `unknown` and can legitimately
 * be null, missing, or left over from a field that has since changed type. So
 * every function here is written to produce something sensible from junk rather
 * than to assume a shape - a home tile showing "NaN" is worse than one showing
 * a count.
 */
import { formatMoney } from '../../core/money';
import { todayISO } from '../../core/date';
import { entryDateOf, inPeriod } from './entryDate';
import { formatDuration, formatFieldValue, isEmptyValue, numericValue, readableAs } from './format';
import { isNumericType, type CustomField, type CustomModule, type CustomRecord, type SummaryPeriod } from './types';

export type Summary = { text: string; isFallback: boolean };

/** What the tile needs to know about the module. */
type SummaryConfig = Pick<CustomModule, 'summary_field_key' | 'summary_agg'> & {
  /** Optional so a v2-shaped row (or a test) still summarises all time. */
  summary_period?: SummaryPeriod;
};

/** The words after a figure: " this week", " this month", or nothing. */
const PERIOD_SUFFIX: Record<SummaryPeriod, string> = {
  all: '',
  week: ' this week',
  month: ' this month',
};

/**
 * The line a custom module's home tile shows.
 *
 * Falls back to a record count whenever the configured summary cannot be
 * produced: no configuration, a field that has since been deleted, or a field
 * holding nothing numeric. `isFallback` is returned rather than inferred, so
 * the caller can tell "you asked for a count" from "your total was
 * uncomputable" if it ever wants to.
 *
 * A PERIOD scopes everything, the count included: "3 this week" beside an
 * all-time total would read as a contradiction. An empty period says so
 * ("None this week") rather than quietly showing all time instead.
 *
 * `records` are the module's rows and `field` its summary field, both passed
 * in rather than fetched, which is what keeps this testable. `context` says
 * what today is and which field dates an entry; without it, today is the
 * device's and entries are dated by when they were logged.
 */
export function summarise(
  module: SummaryConfig,
  field: CustomField | null,
  allRecords: CustomRecord[],
  context?: { today?: string; dateField?: CustomField | null },
): Summary {
  const period = module.summary_period ?? 'all';
  const suffix = PERIOD_SUFFIX[period];

  const today = context?.today ?? todayISO();
  const dateField = context?.dateField ?? null;
  const records =
    period === 'all'
      ? allRecords
      : allRecords.filter((record) => inPeriod(entryDateOf(record, dateField), period, today));

  const count = records.length;
  const countText =
    count === 0
      ? period === 'all'
        ? 'No entries'
        : `None${suffix}`
      : period === 'all'
        ? `${count} ${count === 1 ? 'entry' : 'entries'}`
        : `${count}${suffix}`;

  const agg = module.summary_agg;
  if (!agg || agg === 'count') return { text: countText, isFallback: !agg };

  // Configured against a field that no longer exists. The module keeps working.
  if (!module.summary_field_key || !field || field.key !== module.summary_field_key) {
    return { text: countText, isFallback: true };
  }

  if (count === 0) return { text: countText, isFallback: false };

  if (agg === 'latest') {
    // The newest entry that ANSWERED the field, by when it was logged. Not the
    // first in the array: the list hands records over in its own sort order.
    // A value that no longer reads as the field's type is skipped too, or the
    // tile would show something the row itself hides.
    const withValue = [...records]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .find((record) => {
        const value = record.data[field.key];
        return !isEmptyValue(value) && readableAs(field.type, value);
      });
    if (!withValue) return { text: countText, isFallback: true };
    return { text: formatLatest(field, withValue.data[field.key]), isFallback: false };
  }

  // Only values the field can show, by the same rule as the rows and the
  // chart. A 9 kept from a 1-10 score is hidden in every rating row, and
  // averaging it in anyway gave the tile "7/5".
  const numbers = records
    .map((record) => record.data[field.key])
    .filter((value) => !isEmptyValue(value) && readableAs(field.type, value))
    .map(numericValue)
    .filter((value): value is number => value !== null);

  if (numbers.length === 0 || !isNumericType(field.type)) {
    return { text: countText, isFallback: true };
  }

  const total = numbers.reduce((sum, value) => sum + value, 0);
  const result = agg === 'average' ? total / numbers.length : total;
  // Outside all time, an average says it is one: "7.5 this week" reads as a
  // total. All time keeps the v2 wording, which tiles already show.
  const marker = agg === 'average' && period !== 'all' ? ' avg' : '';

  return { text: `${formatNumeric(field, result)}${marker}${suffix}`, isFallback: false };
}

/** Format an aggregate, respecting what kind of number the field holds. */
export function formatNumeric(field: Pick<CustomField, 'type'>, value: number): string {
  switch (field.type) {
    case 'money':
      // Money fields hold integer paise, like everywhere else in the app. An
      // average can land between paise, so it is rounded before formatting.
      return formatMoney(Math.round(value), { compact: true });
    case 'duration':
      return formatDuration(value);
    case 'rating':
      // One decimal: "4.3/5" separates a good average from a great one, and a
      // second decimal would claim a precision five stars cannot have.
      return `${Math.round(value * 10) / 10}/5`;
    default: {
      // Two decimals at most, and none when it is whole: "8" reads better than
      // "8.00", and an average of 7.6667 as "7.67".
      const rounded = Math.round(value * 100) / 100;
      return rounded.toLocaleString('en-IN');
    }
  }
}

/** A single stored value for the 'latest' summary, cut to fit one tile line. */
function formatLatest(field: CustomField, value: unknown): string {
  // A tile is the one place a "No" is worth saying: it answers the question.
  if (field.type === 'boolean') return value === true ? 'Yes' : 'No';
  const text = formatFieldValue(field, value) ?? '';
  // Tiles are one line. A long note truncated with an ellipsis reads better
  // than one that wraps and pushes the tile out of alignment.
  return text.length > 24 ? `${text.slice(0, 23)}...` : text;
}

/**
 * Sort records for the list screen.
 *
 * Sorting happens here rather than in SQL because the value lives inside a
 * jsonb column: ordering by it in Postgres would mean `data->>'key'`, which
 * sorts everything as TEXT. That puts 100 before 9 for a number field, and it
 * is not obviously wrong until you look closely.
 *
 * Records with no value always sort last, whichever direction is chosen. A
 * blank is not "smallest", it is "unanswered", and burying it under real data
 * is right in both directions. A value the field's type cannot show (a 9 in a
 * rating field) sorts with the blanks, since its row shows nothing either.
 */
export function sortRecords(
  records: CustomRecord[],
  module: Pick<CustomModule, 'sort_field_key' | 'sort_direction'>,
  field: CustomField | null,
): CustomRecord[] {
  const direction = module.sort_direction === 'asc' ? 1 : -1;

  // No field configured, or it has been deleted: fall back to creation order,
  // which is what the query already returns.
  if (!module.sort_field_key || !field || field.key !== module.sort_field_key) {
    return [...records].sort(
      (a, b) => direction * a.created_at.localeCompare(b.created_at),
    );
  }

  // Ratings and durations are numbers underneath, and sort as numbers.
  const isNumeric = isNumericType(field.type);

  return [...records].sort((a, b) => {
    const left = a.data[field.key];
    const right = b.data[field.key];

    const leftEmpty = isEmptyValue(left) || !readableAs(field.type, left);
    const rightEmpty = isEmptyValue(right) || !readableAs(field.type, right);
    if (leftEmpty && rightEmpty) return 0;
    if (leftEmpty) return 1; // unanswered sorts last regardless of direction
    if (rightEmpty) return -1;

    if (isNumeric) {
      const a1 = numericValue(left) ?? 0;
      const b1 = numericValue(right) ?? 0;
      return direction * (a1 - b1);
    }

    if (field.type === 'boolean') {
      return direction * (Number(left) - Number(right));
    }

    // Dates are 'YYYY-MM-DD', which sorts correctly as a string, so they need
    // no special case here.
    return direction * String(left).localeCompare(String(right));
  });
}
