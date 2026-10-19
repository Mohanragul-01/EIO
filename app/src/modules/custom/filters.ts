/**
 * filters.ts - the chip row over a module's list, and grouping with totals.
 *
 * Personal lists split in two - to read and done, by room, by genre - and
 * without a way to see one side, a 200-entry module is one long scroll. The
 * chips are built from the module's own fields, so they appear without setup;
 * groups answer "how much per category" without a chart.
 *
 * KEPT FEW ON PURPOSE. Every option of every field as a chip would bury the
 * list. The row offers the first Choice field's options, the first Tags
 * field's, up to two yes/no fields, and This week / This month when the module
 * has a date. Anything else is what group-by is for.
 */
import { entryDateOf, inPeriod } from './entryDate';
import { isEmptyValue, numericValue, readableAs } from './format';
import { summarise } from './summary';
import type { CustomField, CustomModule, CustomRecord } from './types';

/** Narrow to one value of one field. */
export type ValueFilter =
  /** A Choice equal to, or a Tags list containing, this option. */
  | { kind: 'option'; fieldKey: string; value: string }
  /** A yes/no that is (true) or is not (false) ticked. A blank is "not". */
  | { kind: 'flag'; fieldKey: string; value: boolean };

export type PeriodFilter = 'week' | 'month';

export type FilterChip =
  | { id: string; label: string; kind: 'value'; value: ValueFilter }
  | { id: string; label: string; kind: 'period'; period: PeriodFilter };

/** One value chip and one period chip can be on together; All clears both. */
export type ActiveFilters = { value: ValueFilter | null; period: PeriodFilter | null };

export const NO_FILTERS: ActiveFilters = { value: null, period: null };

/** "Not lent out": the opposite of a yes/no field, in words. */
function notLabel(field: CustomField): string {
  return `Not ${field.label.trim().toLowerCase()}`;
}

/** The chips a module's list offers, in the order they appear. */
export function filterChipsFor(fields: CustomField[], dateField: CustomField | null): FilterChip[] {
  const ordered = [...fields].sort((a, b) => a.position - b.position);
  const chips: FilterChip[] = [];

  const optionChips = (field: CustomField | undefined) =>
    (field?.options ?? []).forEach((option) =>
      chips.push({
        id: `option:${field?.key}:${option}`,
        label: option,
        kind: 'value',
        value: { kind: 'option', fieldKey: field?.key ?? '', value: option },
      }),
    );

  optionChips(ordered.find((f) => f.type === 'select'));
  optionChips(ordered.find((f) => f.type === 'multiselect'));

  ordered
    .filter((f) => f.type === 'boolean')
    .slice(0, 2)
    .forEach((field) => {
      chips.push({
        id: `flag:${field.key}:yes`,
        label: field.label.trim(),
        kind: 'value',
        value: { kind: 'flag', fieldKey: field.key, value: true },
      });
      chips.push({
        id: `flag:${field.key}:no`,
        label: notLabel(field),
        kind: 'value',
        value: { kind: 'flag', fieldKey: field.key, value: false },
      });
    });

  if (dateField) {
    chips.push({ id: 'period:week', label: 'This week', kind: 'period', period: 'week' });
    chips.push({ id: 'period:month', label: 'This month', kind: 'period', period: 'month' });
  }

  return chips;
}

/** Whether a record's value matches a value filter. */
function matches(record: CustomRecord, filter: ValueFilter): boolean {
  const value = record.data[filter.fieldKey];
  if (filter.kind === 'flag') return (value === true) === filter.value;
  if (Array.isArray(value)) return value.map(String).includes(filter.value);
  return !isEmptyValue(value) && String(value) === filter.value;
}

export function filterRecords(
  records: CustomRecord[],
  active: ActiveFilters,
  dateField: CustomField | null,
  today: string,
): CustomRecord[] {
  return records.filter((record) => {
    if (active.value && !matches(record, active.value)) return false;
    if (active.period && !inPeriod(entryDateOf(record, dateField), active.period, today)) return false;
    return true;
  });
}

export type RecordGroup = { key: string; label: string; records: CustomRecord[] };

/**
 * Split records into groups by one field, in a meaningful order, each record
 * in exactly one group. Entries keep the order they came in within a group.
 * Empty groups are left out; the unanswered come last as "No <field>".
 *
 *   Choice   the options' own order, then any leftover value no longer in the
 *            options (kept, not hidden), then the unanswered
 *   Yes/No   the field, then its opposite - which includes a blank
 *   Rating   five stars down to one, then the unanswered
 */
export function groupRecords(records: CustomRecord[], field: CustomField): RecordGroup[] {
  const groups = new Map<string, RecordGroup>();
  const add = (key: string, label: string, record: CustomRecord) => {
    const group = groups.get(key);
    if (group) group.records.push(record);
    else groups.set(key, { key, label, records: [record] });
  };
  const blankLabel = `No ${field.label.trim().toLowerCase()}`;

  records.forEach((record) => {
    const value = record.data[field.key];

    if (field.type === 'boolean') {
      if (value === true) add('yes', field.label.trim(), record);
      else add('no', notLabel(field), record);
      return;
    }

    if (isEmptyValue(value) || !readableAs(field.type, value)) {
      add('blank', blankLabel, record);
      return;
    }

    if (field.type === 'rating') {
      const stars = numericValue(value) ?? 0;
      add(`stars:${stars}`, `${stars} ${stars === 1 ? 'star' : 'stars'}`, record);
      return;
    }

    add(`value:${String(value)}`, String(value), record);
  });

  const rank = (group: RecordGroup): number => {
    if (group.key === 'blank') return Number.MAX_SAFE_INTEGER;
    if (field.type === 'boolean') return group.key === 'yes' ? 0 : 1;
    if (field.type === 'rating') return 5 - Number(group.key.slice('stars:'.length));
    const index = field.options.indexOf(group.label);
    // A leftover value sorts after every real option, in the order first seen.
    return index >= 0 ? index : field.options.length;
  };

  // Array.prototype.sort is stable, so leftovers keep first-seen order.
  return [...groups.values()].sort((a, b) => rank(a) - rank(b));
}

/**
 * The right-hand side of a group header: the count, then the module's own
 * statistic over the group. "3 · 412 pages", "3 · avg 4.2/5", or just "3".
 *
 * A plain number takes the field's label as its unit, since "412" alone does
 * not say what was counted; money, durations and ratings carry their own.
 * The tile's period is ignored: the group is already the list on screen, and
 * filtering it again would make its total disagree with its rows.
 */
export function groupStatLine(
  module: Pick<CustomModule, 'summary_field_key' | 'summary_agg'>,
  summaryField: CustomField | null,
  records: CustomRecord[],
): string {
  const count = String(records.length);
  const agg = module.summary_agg;
  if (!agg || agg === 'count' || !summaryField) return count;

  const summary = summarise(
    { summary_field_key: module.summary_field_key, summary_agg: agg, summary_period: 'all' },
    summaryField,
    records,
  );
  if (summary.isFallback) return count;

  const unit = summaryField.type === 'number' && agg !== 'latest'
    ? ` ${summaryField.label.trim().toLowerCase()}`
    : '';
  const prefix = agg === 'average' ? 'avg ' : '';
  return `${count} · ${prefix}${summary.text}${unit}`;
}
