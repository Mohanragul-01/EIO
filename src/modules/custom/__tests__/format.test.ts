/**
 * Rendering and validating jsonb field values.
 *
 * Everything here takes `unknown`, because `data` is jsonb and the field
 * definition is the only thing that says how to read it. A field's type can be
 * CHANGED after records exist, so "the value does not match its type" is a
 * normal state, not a corrupt one, and every function has to survive it.
 */
import { emptyValueFor, formatFieldValue, validateRecord } from '../format';
import type { CustomField } from '../types';

const field = (over: Partial<CustomField> = {}): CustomField => ({
  id: 'f1',
  module_id: 'm1',
  user_id: 'u1',
  key: 'value',
  label: 'Value',
  type: 'text',
  required: false,
  options: [],
  position: 0,
  created_at: '2026-01-01T00:00:00Z',
  ...over,
});

describe('emptyValueFor', () => {
  it('starts a boolean at false, not null', () => {
    // A toggle has to render as something, and "off" is the honest default.
    expect(emptyValueFor('boolean')).toBe(false);
  });

  it('starts text empty and everything else null', () => {
    // null is "not filled in", which is different from "filled in as empty".
    expect(emptyValueFor('text')).toBe('');
    expect(emptyValueFor('number')).toBeNull();
    expect(emptyValueFor('money')).toBeNull();
    expect(emptyValueFor('date')).toBeNull();
    expect(emptyValueFor('select')).toBeNull();
  });
});

describe('formatFieldValue', () => {
  it('returns null for nothing to show, so the caller can omit the line', () => {
    const f = field();
    expect(formatFieldValue(f, null)).toBeNull();
    expect(formatFieldValue(f, undefined)).toBeNull();
    expect(formatFieldValue(f, '')).toBeNull();
  });

  it('formats money from integer paise', () => {
    expect(formatFieldValue(field({ type: 'money' }), 150000)).toContain('1,500');
  });

  it('formats a money value left behind as a string', () => {
    // THE INCONSISTENCY THIS FIXES. Field types can be changed after records
    // exist, so a text field holding "150000" can become a money field. The
    // tile summary already counted those, so returning null here meant the
    // tile showed a total while every row behind it displayed nothing.
    expect(formatFieldValue(field({ type: 'money' }), '150000')).toContain('1,500');
  });

  it('still rejects money that is not a number at all', () => {
    expect(formatFieldValue(field({ type: 'money' }), 'about a thousand')).toBeNull();
  });

  it('groups large numbers', () => {
    expect(formatFieldValue(field({ type: 'number' }), 1234567)).toBe('12,34,567');
  });

  it('shows a boolean only when true', () => {
    // A list peppered with "No" is noise; "Yes" carries information.
    const f = field({ type: 'boolean' });
    expect(formatFieldValue(f, true)).toBe('Yes');
    expect(formatFieldValue(f, false)).toBeNull();
  });

  it('refuses to render a non-string as a date', () => {
    // Unlike money there is no sensible reading of a number as a calendar day,
    // and formatEventDate on junk would print a confidently wrong date.
    expect(formatFieldValue(field({ type: 'date' }), 20260101)).toBeNull();
  });

  it('collapses whitespace in text and drops what is left of nothing', () => {
    const f = field();
    expect(formatFieldValue(f, '  two   words\n')).toBe('two words');
    expect(formatFieldValue(f, '   ')).toBeNull();
  });
});

describe('validateRecord', () => {
  it('passes when nothing is required', () => {
    expect(validateRecord([field()], {})).toEqual({});
  });

  it('flags a missing required field by its label', () => {
    const errors = validateRecord([field({ required: true, label: 'Title' })], {});
    expect(errors.value).toBe('Title is required');
  });

  it('treats an unticked required toggle as unanswered', () => {
    // Otherwise `false` reads as "filled in" and a required consent box could
    // be submitted unticked.
    const f = field({ type: 'boolean', required: true, label: 'Agreed' });
    expect(validateRecord([f], { value: false }).value).toBe('Agreed is required');
    expect(validateRecord([f], { value: true })).toEqual({});
  });

  it('accepts zero and does not confuse it with empty', () => {
    // 0 is a real answer for a number field.
    const f = field({ type: 'number', required: true });
    expect(validateRecord([f], { value: 0 })).toEqual({});
  });

  it('reports every missing field at once, not just the first', () => {
    const errors = validateRecord(
      [
        field({ id: 'a', key: 'a', label: 'A', required: true }),
        field({ id: 'b', key: 'b', label: 'B', required: true }),
      ],
      {},
    );
    expect(Object.keys(errors).sort()).toEqual(['a', 'b']);
  });
});
