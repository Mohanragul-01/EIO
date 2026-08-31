/**
 * The module builder generates UI from data, so its pure helpers decide
 * whether a user-created module works at all. Field keys in particular are the
 * thing that must never drift: if a key changes, every value stored under the
 * old one becomes unreachable.
 */
import { emptyValueFor, formatFieldValue, validateRecord } from '../format';
import { needsOptions, subtitleFieldOf, titleFieldOf, toFieldKey } from '../types';
import type { CustomField } from '../types';

function field(partial: Partial<CustomField>): CustomField {
  return {
    id: partial.key ?? 'id',
    module_id: 'm',
    user_id: 'u',
    key: partial.key ?? 'k',
    label: partial.label ?? 'Label',
    type: partial.type ?? 'text',
    required: partial.required ?? false,
    options: partial.options ?? [],
    position: partial.position ?? 0,
    created_at: '2026-01-01T00:00:00Z',
  };
}

describe('toFieldKey', () => {
  it('slugifies a label', () => {
    expect(toFieldKey('Hours slept', [])).toBe('hours_slept');
    expect(toFieldKey('Amount (INR)', [])).toBe('amount_inr');
    expect(toFieldKey('  Title  ', [])).toBe('title');
  });

  it('never collides with an existing key', () => {
    expect(toFieldKey('Notes', ['notes'])).toBe('notes_2');
    expect(toFieldKey('Notes', ['notes', 'notes_2'])).toBe('notes_3');
  });

  it('falls back rather than producing an empty key', () => {
    expect(toFieldKey('!!!', [])).toBe('field');
  });
});

describe('emptyValueFor', () => {
  it('distinguishes not-filled-in from filled-in-as-empty', () => {
    expect(emptyValueFor('text')).toBe('');
    expect(emptyValueFor('boolean')).toBe(false);
    // null, not 0 or '': an untouched optional number must not save as zero.
    expect(emptyValueFor('number')).toBeNull();
    expect(emptyValueFor('money')).toBeNull();
    expect(emptyValueFor('date')).toBeNull();
    expect(emptyValueFor('select')).toBeNull();
  });
});

describe('formatFieldValue', () => {
  it('returns null when there is nothing worth showing', () => {
    expect(formatFieldValue(field({ type: 'text' }), '')).toBeNull();
    expect(formatFieldValue(field({ type: 'number' }), null)).toBeNull();
    // A list peppered with "No" is noise; only a true boolean carries meaning.
    expect(formatFieldValue(field({ type: 'boolean' }), false)).toBeNull();
    expect(formatFieldValue(field({ type: 'boolean' }), true)).toBe('Yes');
  });

  it('formats money from stored paise', () => {
    const out = formatFieldValue(field({ type: 'money' }), 129950);
    expect(out).toContain('1,299');
  });
});

describe('validateRecord', () => {
  const fields = [
    field({ key: 'title', label: 'Title', type: 'text', required: true }),
    field({ key: 'note', label: 'Note', type: 'text', required: false }),
  ];

  it('flags only missing required fields', () => {
    expect(validateRecord(fields, { title: 'ok', note: '' })).toEqual({});
    expect(validateRecord(fields, { title: '', note: '' })).toEqual({
      title: 'Title is required',
    });
  });

  it('treats an unchecked required toggle as unanswered', () => {
    const toggle = [field({ key: 'done', label: 'Done', type: 'boolean', required: true })];
    expect(validateRecord(toggle, { done: false })).toEqual({ done: 'Done is required' });
    expect(validateRecord(toggle, { done: true })).toEqual({});
  });
});

describe('row layout rules', () => {
  it('uses the first text field as the title', () => {
    const fields = [
      field({ key: 'when', type: 'date' }),
      field({ key: 'name', type: 'text' }),
      field({ key: 'other', type: 'text' }),
    ];
    expect(titleFieldOf(fields)?.key).toBe('name');
    expect(subtitleFieldOf(fields, 'name')?.key).toBe('when');
  });

  it('falls back to the first field when nothing is text', () => {
    const fields = [field({ key: 'count', type: 'number' })];
    expect(titleFieldOf(fields)?.key).toBe('count');
    expect(titleFieldOf([])).toBeNull();
  });

  it('only choice fields need options', () => {
    expect(needsOptions('select')).toBe(true);
    expect(needsOptions('text')).toBe(false);
  });
});
