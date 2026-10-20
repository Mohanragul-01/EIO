/**
 * The three v3 field types - Rating, Tags (multi-select) and Duration - and
 * the one rule every type now shares: a stored value either reads as the
 * field's type or it "won't show", and nothing in between throws or prints
 * junk.
 *
 * That rule is what the type-change guard counts, so readableAs and
 * formatFieldValue must agree exactly: whatever readableAs rejects,
 * formatFieldValue shows as nothing.
 */
import {
  emptyValueFor,
  formatDuration,
  formatFieldValue,
  isEmptyValue,
  joinMinutes,
  readableAs,
  splitMinutes,
  validateRecord,
} from '../format';
import { makeField } from '../testing';
import {
  aggsForFieldType,
  fieldTypeLabel,
  FIELD_TYPES,
  isGroupableType,
  isNumericType,
  isSortableFieldType,
  needsOptions,
  type FieldType,
} from '../types';

describe('formatDuration', () => {
  it('reads minutes as hours and minutes', () => {
    expect(formatDuration(450)).toBe('7 h 30 m');
    expect(formatDuration(45)).toBe('45 m');
    expect(formatDuration(120)).toBe('2 h');
    expect(formatDuration(0)).toBe('0 m');
  });

  it('rounds an average to the nearest minute rather than printing a fraction', () => {
    expect(formatDuration(452.6)).toBe('7 h 33 m');
  });

  it('groups a large number of hours the Indian way', () => {
    expect(formatDuration(150000 * 60)).toBe('1,50,000 h');
  });
});

describe('splitMinutes and joinMinutes', () => {
  it('round-trips', () => {
    expect(splitMinutes(450)).toEqual({ hours: 7, minutes: 30 });
    expect(joinMinutes('7', '30')).toBe(450);
  });

  it('treats one empty half as zero, and both empty as no answer', () => {
    expect(joinMinutes('', '45')).toBe(45);
    expect(joinMinutes('2', '')).toBe(120);
    expect(joinMinutes('', '')).toBeNull();
  });

  it('carries minutes past 59 into hours rather than refusing them', () => {
    expect(joinMinutes('1', '90')).toBe(150);
  });

  it('refuses what is not a number', () => {
    expect(joinMinutes('a', '5')).toBeNull();
  });
});

describe('rating', () => {
  const rating = makeField({ type: 'rating' });

  it('shows whole stars out of five', () => {
    expect(formatFieldValue(rating, 4)).toBe('4/5');
    expect(formatFieldValue(rating, '3')).toBe('3/5');
  });

  it('keeps a value outside 1-5 but does not show it', () => {
    // A number field of 1-10 switched to Rating: 8 is kept, not clamped to 5,
    // because clamping would display something you never entered.
    expect(readableAs('rating', 8)).toBe(false);
    expect(formatFieldValue(rating, 8)).toBeNull();
    expect(readableAs('rating', 0)).toBe(false);
  });

  it('is numeric, so it can be averaged and grouped', () => {
    expect(isNumericType('rating')).toBe(true);
    expect(aggsForFieldType('rating')).toContain('average');
    expect(isGroupableType('rating')).toBe(true);
  });
});

describe('tags (multi-select)', () => {
  const tags = makeField({ type: 'multiselect', options: ['Fiction', 'Sci-fi', 'Memoir'] });

  it('starts as an empty list and needs options', () => {
    expect(emptyValueFor('multiselect')).toEqual([]);
    expect(needsOptions('multiselect')).toBe(true);
  });

  it('joins the chosen options', () => {
    expect(formatFieldValue(tags, ['Fiction', 'Sci-fi'])).toBe('Fiction, Sci-fi');
  });

  it('reads a single choice left from a Choice field as one tag', () => {
    expect(formatFieldValue(tags, 'Memoir')).toBe('Memoir');
  });

  it('shows nothing for an empty list', () => {
    expect(formatFieldValue(tags, [])).toBeNull();
    expect(isEmptyValue([])).toBe(true);
  });

  it('counts an empty list as unanswered when required', () => {
    const required = makeField({ key: 'tags', label: 'Genre', type: 'multiselect', required: true });
    expect(validateRecord([required], { tags: [] })).toEqual({ tags: 'Genre is required' });
    expect(validateRecord([required], { tags: ['Fiction'] })).toEqual({});
  });

  it('cannot be sorted or grouped', () => {
    expect(isSortableFieldType('multiselect')).toBe(false);
    expect(isGroupableType('multiselect')).toBe(false);
  });
});

describe('duration', () => {
  const duration = makeField({ type: 'duration' });

  it('stores minutes and shows hours and minutes', () => {
    expect(formatFieldValue(duration, 450)).toBe('7 h 30 m');
  });

  it('sums like a number', () => {
    expect(isNumericType('duration')).toBe(true);
    expect(aggsForFieldType('duration')).toEqual(['sum', 'average', 'count', 'latest']);
  });

  it('will not show a negative length of time', () => {
    expect(readableAs('duration', -5)).toBe(false);
  });
});

describe('values left behind by a type change', () => {
  it('a number field no longer prints text it cannot read', () => {
    // Before v3 a number field echoed any leftover string. Now it agrees with
    // the guard: "abc" won't show as a Number, and is still stored.
    expect(formatFieldValue(makeField({ type: 'number' }), 'abc')).toBeNull();
    expect(formatFieldValue(makeField({ type: 'number' }), '12')).toBe('12');
  });

  it('a date field refuses a string that is not a calendar day', () => {
    expect(formatFieldValue(makeField({ type: 'date' }), 'next week')).toBeNull();
    expect(readableAs('date', '2026-02-30')).toBe(false);
    expect(readableAs('date', '2026-02-28')).toBe(true);
  });

  it('text shows numbers, yes/no and lists rather than hiding them', () => {
    const text = makeField({ type: 'text' });
    expect(formatFieldValue(text, 12)).toBe('12');
    expect(formatFieldValue(text, true)).toBe('Yes');
    expect(formatFieldValue(text, false)).toBe('No');
    expect(formatFieldValue(text, ['a', 'b'])).toBe('a, b');
  });

  it('a yes/no field only reads real booleans', () => {
    expect(readableAs('boolean', 'yes')).toBe(false);
    expect(readableAs('boolean', false)).toBe(true);
  });

  it('agrees with readableAs for every type and every kind of junk', () => {
    const junk: unknown[] = [12, -3, 2.5, 'abc', '7', '2026-01-05', true, false, ['x'], [], { a: 1 }];
    FIELD_TYPES.forEach(({ type }) => {
      const field = makeField({ type: type as FieldType, options: ['x'] });
      junk.forEach((value) => {
        const shown = formatFieldValue(field, value);
        if (!readableAs(type, value) || isEmptyValue(value)) {
          expect(shown).toBeNull();
        }
        // A false boolean is readable but deliberately blank in a list.
        if (readableAs(type, value) && !isEmptyValue(value) && !(type === 'boolean' && value === false)) {
          expect(shown).not.toBeNull();
        }
      });
    });
  });
});

describe('the type list', () => {
  it('stays small enough to scan', () => {
    // The research's warning: Memento's 30 types draw a "steep" complaint.
    expect(FIELD_TYPES.length).toBeLessThan(12);
  });

  it('names a type the way the builder does', () => {
    expect(fieldTypeLabel('multiselect')).toBe('Tags');
    expect(fieldTypeLabel('number')).toBe('Number');
  });

  it('whitespace is not an answer to a required text field', () => {
    const title = makeField({ key: 'title', label: 'Title', required: true });
    expect(validateRecord([title], { title: '   ' })).toEqual({ title: 'Title is required' });
  });
});
