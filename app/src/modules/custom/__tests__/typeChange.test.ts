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
      reread: 0,
      rereadAs: null,
      samples: [],
    });
  });

  it('knows choice to tags keeps everything', () => {
    const choice = makeField({ key: 'g', type: 'select', options: ['a'] });
    const tags = makeField({ key: 'g', type: 'multiselect', options: ['a'] });
    expect(typeChangeImpact([makeRecord({ g: 'a' })], choice, tags).unreadable).toBe(0);
  });
});

/*
 * Changes that SHOW a value but change what it means. Duration stores
 * minutes and Money stores paise, so a Sleep field of 7.5 hours switched to
 * Duration shows "8 m", and 1500 switched to Money shows "₹15". Nothing is
 * lost, but "all of them show as Duration" said the opposite of what happened.
 */
describe('typeChangeImpact, when the unit changes', () => {
  const sleep = [
    makeRecord({ hours: 7.5 }, [2026, 10, 2]),
    makeRecord({ hours: 8 }, [2026, 10, 1]),
  ];

  it('counts hours switched to Duration as read again, as minutes', () => {
    const impact = typeChangeImpact(sleep, asNumber, makeField({ key: 'hours', type: 'duration' }));
    expect(impact.unreadable).toBe(0);
    expect(impact.reread).toBe(2);
    expect(impact.rereadAs).toEqual({
      words: 'will be read as minutes',
      before: '7.5',
      after: '8 m',
    });
  });

  it('counts a number switched to Money as read again, as paise', () => {
    const spent = makeField({ key: 'spent', type: 'number' });
    const impact = typeChangeImpact(
      [makeRecord({ spent: 1500 })],
      spent,
      makeField({ key: 'spent', type: 'money' }),
    );
    expect(impact.reread).toBe(1);
    expect(impact.rereadAs).toEqual({
      words: 'will be read as paise',
      before: '1,500',
      after: '₹15',
    });
  });

  it('counts text that holds a number apart from text that will not show', () => {
    const spent = makeField({ key: 'spent', type: 'text' });
    const impact = typeChangeImpact(
      [makeRecord({ spent: 'lunch' }, [2026, 10, 2]), makeRecord({ spent: '1500' }, [2026, 10, 1])],
      spent,
      makeField({ key: 'spent', type: 'money' }),
    );
    expect(impact.withValue).toBe(2);
    expect(impact.unreadable).toBe(1);
    expect(impact.reread).toBe(1);
    expect(impact.samples).toEqual([
      { before: 'lunch', after: null },
      { before: '1500', after: '₹15' },
    ]);
  });

  it('says a duration switched to Number shows its stored minutes', () => {
    const slept = makeField({ key: 'slept', type: 'duration' });
    const impact = typeChangeImpact(
      [makeRecord({ slept: 450 })],
      slept,
      makeField({ key: 'slept', type: 'number' }),
    );
    expect(impact.rereadAs).toEqual({
      words: 'will show the stored minutes',
      before: '7 h 30 m',
      after: '450',
    });
  });

  it('leaves a change that keeps the unit alone', () => {
    const impact = typeChangeImpact(
      [makeRecord({ hours: 4 })],
      asNumber,
      makeField({ key: 'hours', type: 'rating' }),
    );
    expect(impact).toMatchObject({ unreadable: 0, reread: 0, rereadAs: null });
  });
});

describe('typeChangeMessage', () => {
  /** An impact with nothing read again, which is most changes. */
  const impact = (withValue: number, unreadable: number) => ({
    withValue,
    unreadable,
    reread: 0,
    rereadAs: null,
    samples: [],
  });

  it('reads as the spec says', () => {
    expect(typeChangeMessage(impact(14, 3), 'Number')).toBe(
      "14 entries have a value here; 3 won't show as Number. Nothing is deleted.",
    );
  });

  it('says so when everything still shows', () => {
    expect(typeChangeMessage(impact(14, 0), 'Text')).toBe(
      '14 entries have a value here; all of them show as Text. Nothing is deleted.',
    );
  });

  it('says so when nothing will', () => {
    expect(typeChangeMessage(impact(5, 5), 'Date')).toBe(
      '5 entries have a value here; none of them will show as Date. Nothing is deleted.',
    );
  });

  it('speaks of one entry in the singular', () => {
    expect(typeChangeMessage(impact(1, 1), 'Rating')).toBe(
      "1 entry has a value here; it won't show as Rating. Nothing is deleted.",
    );
    expect(typeChangeMessage(impact(1, 0), 'Rating')).toBe(
      '1 entry has a value here; it shows as Rating. Nothing is deleted.',
    );
  });

  it('says plainly that hours will be read as minutes, with one of your own values', () => {
    const sleep = [makeRecord({ hours: 7.5 }), makeRecord({ hours: 8 })];
    const toDuration = typeChangeImpact(
      sleep,
      asNumber,
      makeField({ key: 'hours', type: 'duration' }),
    );
    expect(typeChangeMessage(toDuration, 'Duration')).toBe(
      '2 entries have a value here; all of them will be read as minutes: 7.5 becomes 8 m. Nothing is deleted.',
    );
  });

  it('names both what will not show and what will be read again', () => {
    const spent = makeField({ key: 'spent', type: 'text' });
    const toMoney = typeChangeImpact(
      [
        makeRecord({ spent: 'lunch' }, [2026, 10, 3]),
        makeRecord({ spent: '1500' }, [2026, 10, 2]),
        makeRecord({ spent: '200' }, [2026, 10, 1]),
      ],
      spent,
      makeField({ key: 'spent', type: 'money' }),
    );
    expect(typeChangeMessage(toMoney, 'Money')).toBe(
      "3 entries have a value here; 1 won't show as Money, and 2 will be read as paise: 1500 becomes ₹15. Nothing is deleted.",
    );
  });

  it('speaks of one value read again in the singular', () => {
    const spent = makeField({ key: 'spent', type: 'number' });
    const toMoney = typeChangeImpact(
      [makeRecord({ spent: 1500 })],
      spent,
      makeField({ key: 'spent', type: 'money' }),
    );
    expect(typeChangeMessage(toMoney, 'Money')).toBe(
      '1 entry has a value here; it will be read as paise: 1,500 becomes ₹15. Nothing is deleted.',
    );
  });
});
