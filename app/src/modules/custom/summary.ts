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
import { formatEventDate } from '../../core/date';
import type { CustomField, CustomModule, CustomRecord, SummaryAgg } from './types';

/**
 * Read a numeric value from a jsonb field, or null if it is not one.
 *
 * Strings that look like numbers are accepted, because a field switched from
 * text to number leaves the old values as strings and silently dropping them
 * would understate the total without saying so.
 */
function numericValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export type Summary = { text: string; isFallback: boolean };

/**
 * The line a custom module's home tile shows.
 *
 * Falls back to a record count whenever the configured summary cannot be
 * produced: no configuration, a field that has since been deleted, or a field
 * holding nothing numeric. `isFallback` is returned rather than inferred, so
 * the caller can tell "you asked for a count" from "your total was
 * uncomputable" if it ever wants to.
 *
 * `records` are the module's rows and `field` its summary field, both passed
 * in rather than fetched, which is what keeps this testable.
 */
export function summarise(
  module: Pick<CustomModule, 'summary_field_key' | 'summary_agg'>,
  field: CustomField | null,
  records: CustomRecord[],
): Summary {
  const count = records.length;
  const countText = count === 0 ? 'No entries' : `${count} ${count === 1 ? 'entry' : 'entries'}`;

  const agg = module.summary_agg;
  if (!agg || agg === 'count') return { text: countText, isFallback: !agg };

  // Configured against a field that no longer exists. The module keeps working.
  if (!module.summary_field_key || !field || field.key !== module.summary_field_key) {
    return { text: countText, isFallback: true };
  }

  if (count === 0) return { text: 'No entries', isFallback: false };

  if (agg === 'latest') {
    // Records arrive newest first from the query, so the first one that has a
    // value for this field is the most recent answer - not necessarily the
    // newest record, which may have left the field blank.
    const withValue = records.find((record) => {
      const value = record.data[field.key];
      return value !== null && value !== undefined && value !== '';
    });
    if (!withValue) return { text: countText, isFallback: true };
    return { text: formatValue(field, withValue.data[field.key]), isFallback: false };
  }

  const numbers = records
    .map((record) => numericValue(record.data[field.key]))
    .filter((value): value is number => value !== null);

  if (numbers.length === 0) return { text: countText, isFallback: true };

  const total = numbers.reduce((sum, value) => sum + value, 0);
  const result = agg === 'average' ? total / numbers.length : total;

  return { text: formatNumeric(field, result), isFallback: false };
}

/** Format an aggregate, respecting whether the field is money. */
function formatNumeric(field: CustomField, value: number): string {
  if (field.type === 'money') {
    // Money fields hold integer paise, like everywhere else in the app. An
    // average can land between paise, so it is rounded before formatting.
    return formatMoney(Math.round(value), { compact: true });
  }
  // Two decimals at most, and none when it is whole: "8" reads better than
  // "8.00", and an average of 7.6667 as "7.67".
  const rounded = Math.round(value * 100) / 100;
  return rounded.toLocaleString('en-IN');
}

/** Format a single stored value for the 'latest' summary. */
function formatValue(field: CustomField, value: unknown): string {
  switch (field.type) {
    case 'money':
      return typeof value === 'number' ? formatMoney(value, { compact: true }) : String(value);
    case 'date':
      return typeof value === 'string' ? formatEventDate(value) : String(value);
    case 'boolean':
      return value === true ? 'Yes' : 'No';
    default: {
      const text = String(value).replace(/\s+/g, ' ').trim();
      // Tiles are one line. A long note truncated with an ellipsis reads better
      // than one that wraps and pushes the tile out of alignment.
      return text.length > 24 ? `${text.slice(0, 23)}...` : text;
    }
  }
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
 * is right in both directions.
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

  const isNumeric = field.type === 'number' || field.type === 'money';

  return [...records].sort((a, b) => {
    const left = a.data[field.key];
    const right = b.data[field.key];

    const leftEmpty = left === null || left === undefined || left === '';
    const rightEmpty = right === null || right === undefined || right === '';
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
