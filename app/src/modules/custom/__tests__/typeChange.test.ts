/**
 * The type-change guard: what changing a field's type does to entries that
 * already have a value.
 *
 * Changing a type never touches stored data, so the honest answer is a count
 * of how many values will stop SHOWING - and the promise that nothing is
 * deleted. The count must agree exactly with what the list will display
 * afterwards, which is why it is built on readableAs.
 */
import { typeChangeImpact, typeChangeMessage } from '../typeChange';
import { makeField, makeRecord } from '../testing';

const asText = makeField({ key: 'hours', type: 'text' });
const asNumber = makeField({ key: 'hours', type: 'number' });

const records = [
  makeRecord({ hours: '7.5' }, [2026, 10, 1]),
  makeRecord({ hours: 'about 8' }, [2026, 10, 2]),
  makeRecord({ hours: '' }, [2026, 10, 3]),
  makeRecord({ hours: '6' }, [2026, 10, 4]),
  makeRecord({}, [2026, 10, 5]),
  makeRecord({ hours: 'n/a' }, [2026, 10, 6]),
];

describe('typeChangeImpact', () => {
  it('counts entries with a value, and those that will not show as the new type', () => {
    const impact = typeChangeImpact(records, asText, asNumber);
    expect(impact.withValue).toBe(4);
    expect(impact.unreadable).toBe(2);
  });

  it('previews up to three values as they show now and after, the lost ones first', () => {
    const { samples } = typeChangeImpact(records, asText, asNumber);
    expect(samples).toEqual([
      { before: 'n/a', after: null },
      { before: 'about 8', after: null },
      { before: '6', after: '6' },
    ]);
  });

  it('shows a "no" as an answer on both sides', () => {
    const asBool = makeField({ key: 'hours', type: 'boolean' });
    const { samples } = typeChangeImpact([makeRecord({ hours: false })], asBool, asText);
    expect(samples).toEqual([{ before: 'No', after: 'No' }]);
  });

  it('finds nothing to warn about in a field nobody has answered', () => {
    expect(typeChangeImpact([makeRecord({})], asText, asNumber)).toEqual({
      withValue: 0,
      unreadable: 0,
      samples: [],
    });
  });

  it('knows choice to tags keeps everything', () => {
    const choice = makeField({ key: 'g', type: 'select', options: ['a'] });
    const tags = makeField({ key: 'g', type: 'multiselect', options: ['a'] });
    expect(typeChangeImpact([makeRecord({ g: 'a' })], choice, tags).unreadable).toBe(0);
  });
});

describe('typeChangeMessage', () => {
  it('reads as the spec says', () => {
    expect(typeChangeMessage({ withValue: 14, unreadable: 3, samples: [] }, 'Number')).toBe(
      "14 entries have a value here; 3 won't show as Number. Nothing is deleted.",
    );
  });

  it('says so when everything still shows', () => {
    expect(typeChangeMessage({ withValue: 14, unreadable: 0, samples: [] }, 'Text')).toBe(
      '14 entries have a value here; all of them show as Text. Nothing is deleted.',
    );
  });

  it('says so when nothing will', () => {
    expect(typeChangeMessage({ withValue: 5, unreadable: 5, samples: [] }, 'Date')).toBe(
      "5 entries have a value here; none of them will show as Date. Nothing is deleted.",
    );
  });

  it('speaks of one entry in the singular', () => {
    expect(typeChangeMessage({ withValue: 1, unreadable: 1, samples: [] }, 'Rating')).toBe(
      "1 entry has a value here; it won't show as Rating. Nothing is deleted.",
    );
    expect(typeChangeMessage({ withValue: 1, unreadable: 0, samples: [] }, 'Rating')).toBe(
      '1 entry has a value here; it shows as Rating. Nothing is deleted.',
    );
  });
});
