/**
 * Custom module tile summaries and list sorting.
 *
 * Both read jsonb, which arrives as `unknown` and can legitimately be null,
 * missing, or left over from a field that has since changed type. The tests
 * here are mostly about junk input, because a home tile showing "NaN" is worse
 * than one showing a count, and a sort that silently compares numbers as text
 * looks right until you scroll.
 */
import { sortRecords, summarise } from '../summary';
import type { CustomField, CustomRecord } from '../types';

const field = (over: Partial<CustomField> = {}): CustomField => ({
  id: 'f1',
  module_id: 'm1',
  user_id: 'u1',
  key: 'amount',
  label: 'Amount',
  type: 'number',
  required: false,
  options: [],
  position: 0,
  created_at: '2026-01-01T00:00:00Z',
  ...over,
});

const record = (data: Record<string, unknown>, created_at = '2026-01-01T00:00:00Z'): CustomRecord => ({
  id: Math.random().toString(36).slice(2),
  module_id: 'm1',
  user_id: 'u1',
  data,
  created_at,
  updated_at: created_at,
});

describe('summarise', () => {
  const numberField = field({ key: 'hours', label: 'Hours', type: 'number' });

  it('falls back to a count when nothing is configured', () => {
    const result = summarise(
      { summary_field_key: null, summary_agg: null },
      null,
      [record({}), record({})],
    );
    expect(result.text).toBe('2 entries');
    expect(result.isFallback).toBe(true);
  });

  it('says "entry" for one, "entries" for more', () => {
    expect(summarise({ summary_field_key: null, summary_agg: null }, null, [record({})]).text)
      .toBe('1 entry');
    expect(summarise({ summary_field_key: null, summary_agg: null }, null, []).text)
      .toBe('No entries');
  });

  it('counts explicitly when asked, and is not a fallback', () => {
    // "I want a count" and "I have not chosen" are different states.
    const result = summarise({ summary_field_key: null, summary_agg: 'count' }, null, [record({})]);
    expect(result.text).toBe('1 entry');
    expect(result.isFallback).toBe(false);
  });

  it('sums and averages a numeric field', () => {
    const records = [record({ hours: 8 }), record({ hours: 7 }), record({ hours: 6 })];

    expect(
      summarise({ summary_field_key: 'hours', summary_agg: 'sum' }, numberField, records).text,
    ).toBe('21');
    expect(
      summarise({ summary_field_key: 'hours', summary_agg: 'average' }, numberField, records).text,
    ).toBe('7');
  });

  it('rounds an average to two decimals rather than showing the full float', () => {
    const records = [record({ hours: 8 }), record({ hours: 7 }), record({ hours: 8 })];
    expect(
      summarise({ summary_field_key: 'hours', summary_agg: 'average' }, numberField, records).text,
    ).toBe('7.67');
  });

  it('formats a money field as money, from paise', () => {
    const money = field({ key: 'cost', label: 'Cost', type: 'money' });
    const result = summarise(
      { summary_field_key: 'cost', summary_agg: 'sum' },
      money,
      [record({ cost: 129950 }), record({ cost: 20050 })],
    );
    // 1299.50 + 200.50 = 1500
    expect(result.text).toContain('1,500');
  });

  it('takes the most recent non-empty value for "latest"', () => {
    // Records arrive newest first, and the newest may have left the field
    // blank. The answer is the most recent one that actually has a value.
    const records = [record({ hours: null }), record({ hours: 9 }), record({ hours: 5 })];
    expect(
      summarise({ summary_field_key: 'hours', summary_agg: 'latest' }, numberField, records).text,
    ).toBe('9');
  });

  it('falls back when the configured field has been deleted', () => {
    // The module must keep working rather than showing an error or a blank.
    const result = summarise(
      { summary_field_key: 'gone', summary_agg: 'sum' },
      null,
      [record({ hours: 8 })],
    );
    expect(result.text).toBe('1 entry');
    expect(result.isFallback).toBe(true);
  });

  it('falls back rather than showing NaN when nothing is numeric', () => {
    // THE FAILURE THAT MATTERS. A field switched from number to text, or simply
    // never filled in, must not produce "NaN" on the home screen.
    const records = [record({ hours: 'not a number' }), record({ hours: null })];
    const result = summarise(
      { summary_field_key: 'hours', summary_agg: 'sum' },
      numberField,
      records,
    );
    expect(result.text).toBe('2 entries');
    expect(result.text).not.toContain('NaN');
  });

  it('reads numeric strings left behind by a type change', () => {
    // Dropping them would understate the total without saying so.
    const records = [record({ hours: '8' }), record({ hours: 7 })];
    expect(
      summarise({ summary_field_key: 'hours', summary_agg: 'sum' }, numberField, records).text,
    ).toBe('15');
  });

  it('says "No entries" for an empty module even when configured', () => {
    const result = summarise({ summary_field_key: 'hours', summary_agg: 'sum' }, numberField, []);
    expect(result.text).toBe('No entries');
  });
});

describe('sortRecords', () => {
  const numberField = field({ key: 'hours', type: 'number' });

  it('sorts numbers numerically, not as text', () => {
    // THE BUG THIS PREVENTS. Ordering in SQL with data->>'hours' compares text,
    // which puts 100 before 9. It looks right until you scroll.
    const records = [record({ hours: 9 }), record({ hours: 100 }), record({ hours: 20 })];
    const sorted = sortRecords(records, { sort_field_key: 'hours', sort_direction: 'asc' }, numberField);
    expect(sorted.map((r) => r.data.hours)).toEqual([9, 20, 100]);
  });

  it('reverses for descending', () => {
    const records = [record({ hours: 9 }), record({ hours: 100 })];
    const sorted = sortRecords(records, { sort_field_key: 'hours', sort_direction: 'desc' }, numberField);
    expect(sorted.map((r) => r.data.hours)).toEqual([100, 9]);
  });

  it('puts records with no value last in BOTH directions', () => {
    // A blank is not "smallest", it is unanswered. Burying it under real data
    // is right whichever way you are sorting.
    const records = [record({ hours: null }), record({ hours: 5 }), record({})];

    const asc = sortRecords(records, { sort_field_key: 'hours', sort_direction: 'asc' }, numberField);
    expect(asc[0].data.hours).toBe(5);

    const desc = sortRecords(records, { sort_field_key: 'hours', sort_direction: 'desc' }, numberField);
    expect(desc[0].data.hours).toBe(5);
  });

  it('sorts dates correctly as strings', () => {
    const dateField = field({ key: 'when', type: 'date' });
    const records = [
      record({ when: '2026-01-09' }),
      record({ when: '2026-01-20' }),
      record({ when: '2025-12-31' }),
    ];
    const sorted = sortRecords(records, { sort_field_key: 'when', sort_direction: 'asc' }, dateField);
    expect(sorted.map((r) => r.data.when)).toEqual(['2025-12-31', '2026-01-09', '2026-01-20']);
  });

  it('falls back to creation order when no field is configured', () => {
    const records = [
      record({}, '2026-01-01T00:00:00Z'),
      record({}, '2026-03-01T00:00:00Z'),
      record({}, '2026-02-01T00:00:00Z'),
    ];
    const sorted = sortRecords(records, { sort_field_key: null, sort_direction: 'desc' }, null);
    expect(sorted.map((r) => r.created_at)).toEqual([
      '2026-03-01T00:00:00Z',
      '2026-02-01T00:00:00Z',
      '2026-01-01T00:00:00Z',
    ]);
  });

  it('falls back when the sort field has been deleted', () => {
    const records = [record({}, '2026-01-01T00:00:00Z'), record({}, '2026-02-01T00:00:00Z')];
    const sorted = sortRecords(records, { sort_field_key: 'gone', sort_direction: 'asc' }, null);
    expect(sorted[0].created_at).toBe('2026-01-01T00:00:00Z');
  });

  it('does not mutate the array it was given', () => {
    // The hook holds these in state; sorting in place would mutate state
    // directly and React would not see the change.
    const records = [record({ hours: 2 }), record({ hours: 1 })];
    const before = records.map((r) => r.id);
    sortRecords(records, { sort_field_key: 'hours', sort_direction: 'asc' }, numberField);
    expect(records.map((r) => r.id)).toEqual(before);
  });
});
