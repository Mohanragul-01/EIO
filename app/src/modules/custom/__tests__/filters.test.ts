/**
 * Filter chips, groups and per-group totals.
 *
 * A 200-book list is one long scroll without them. The chips come from the
 * module's own fields, so they must stay few enough to scan; the groups carry
 * their own count and statistic ("Reading · 3 · 412 pages"), so they must
 * never count an entry twice.
 */
import { filterChipsFor, filterRecords, groupRecords, groupStatLine } from '../filters';
import { makeField, makeModule, makeRecord } from '../testing';

const status = makeField({ key: 'status', label: 'Status', type: 'select', options: ['To read', 'Reading', 'Done'], position: 0 });
const genre = makeField({ key: 'genre', label: 'Genre', type: 'multiselect', options: ['Fiction', 'Memoir'], position: 1 });
const owned = makeField({ key: 'owned', label: 'Owned', type: 'boolean', position: 2 });
const lent = makeField({ key: 'lent', label: 'Lent out', type: 'boolean', position: 3 });
const loved = makeField({ key: 'loved', label: 'Loved', type: 'boolean', position: 4 });
const finished = makeField({ key: 'finished', label: 'Finished', type: 'date', position: 5 });
const pages = makeField({ key: 'pages', label: 'Pages', type: 'number', position: 6 });
const fields = [status, genre, owned, lent, loved, finished, pages];

describe('filterChipsFor', () => {
  it('offers the choices, the tags, two yes/no fields and the periods, in that order', () => {
    const labels = filterChipsFor(fields, finished).map((chip) => chip.label);
    expect(labels).toEqual([
      'To read', 'Reading', 'Done',
      'Fiction', 'Memoir',
      'Owned', 'Not owned', 'Lent out', 'Not lent out',
      'This week', 'This month',
    ]);
  });

  it('offers no period chips without a date field', () => {
    const labels = filterChipsFor([status], null).map((chip) => chip.label);
    expect(labels).toEqual(['To read', 'Reading', 'Done']);
  });

  it('gives every chip its own id', () => {
    const chips = filterChipsFor(fields, finished);
    expect(new Set(chips.map((c) => c.id)).size).toBe(chips.length);
  });
});

describe('filterRecords', () => {
  const TODAY = '2026-10-21';
  const records = [
    makeRecord({ status: 'Reading', genre: ['Fiction'], owned: true, finished: '2026-10-20' }, undefined, 'a'),
    makeRecord({ status: 'Done', genre: ['Memoir', 'Fiction'], owned: false, finished: '2026-10-02' }, undefined, 'b'),
    makeRecord({ status: 'Reading', finished: '2026-09-01' }, undefined, 'c'),
  ];
  const ids = (list: { id: string }[]) => list.map((r) => r.id);

  it('passes everything with nothing on', () => {
    expect(ids(filterRecords(records, { value: null, period: null }, finished, TODAY))).toEqual(['a', 'b', 'c']);
  });

  it('matches a choice exactly', () => {
    const value = { kind: 'option' as const, fieldKey: 'status', value: 'Reading' };
    expect(ids(filterRecords(records, { value, period: null }, finished, TODAY))).toEqual(['a', 'c']);
  });

  it('matches a tag anywhere in the list', () => {
    const value = { kind: 'option' as const, fieldKey: 'genre', value: 'Fiction' };
    expect(ids(filterRecords(records, { value, period: null }, finished, TODAY))).toEqual(['a', 'b']);
  });

  it('counts a blank yes/no as "not"', () => {
    const value = { kind: 'flag' as const, fieldKey: 'owned', value: false };
    expect(ids(filterRecords(records, { value, period: null }, finished, TODAY))).toEqual(['b', 'c']);
  });

  it('combines a value and a period', () => {
    const value = { kind: 'option' as const, fieldKey: 'status', value: 'Reading' };
    expect(ids(filterRecords(records, { value, period: 'month' }, finished, TODAY))).toEqual(['a']);
  });
});

describe('groupRecords', () => {
  it('orders choice groups by their options, with the unanswered last', () => {
    const records = [
      makeRecord({ status: 'Done' }, undefined, 'a'),
      makeRecord({}, undefined, 'b'),
      makeRecord({ status: 'To read' }, undefined, 'c'),
      makeRecord({ status: 'Done' }, undefined, 'd'),
    ];
    const groups = groupRecords(records, status);
    expect(groups.map((g) => g.label)).toEqual(['To read', 'Done', 'No status']);
    expect(groups[1].records.map((r) => r.id)).toEqual(['a', 'd']);
  });

  it('hides empty groups', () => {
    const groups = groupRecords([makeRecord({ status: 'Reading' })], status);
    expect(groups.map((g) => g.label)).toEqual(['Reading']);
  });

  it('puts a choice no longer in the options after the real ones', () => {
    const groups = groupRecords([makeRecord({ status: 'Abandoned' }), makeRecord({ status: 'Done' })], status);
    expect(groups.map((g) => g.label)).toEqual(['Done', 'Abandoned']);
  });

  it('splits yes/no into the field and its opposite', () => {
    const groups = groupRecords([makeRecord({ owned: true }), makeRecord({}), makeRecord({ owned: false })], owned);
    expect(groups.map((g) => [g.label, g.records.length])).toEqual([['Owned', 1], ['Not owned', 2]]);
  });

  it('groups ratings from five stars down', () => {
    const stars = makeField({ key: 'stars', label: 'Rating', type: 'rating' });
    const groups = groupRecords(
      [makeRecord({ stars: 3 }), makeRecord({ stars: 5 }), makeRecord({ stars: 1 }), makeRecord({ stars: 9 })],
      stars,
    );
    expect(groups.map((g) => g.label)).toEqual(['5 stars', '3 stars', '1 star', 'No rating']);
  });

  it('puts every entry in exactly one group', () => {
    const records = Array.from({ length: 9 }, (_, i) =>
      makeRecord({ status: ['To read', 'Done', null][i % 3] }),
    );
    const groups = groupRecords(records, status);
    expect(groups.reduce((n, g) => n + g.records.length, 0)).toBe(9);
  });
});

describe('groupStatLine', () => {
  const group = [makeRecord({ pages: 300 }), makeRecord({ pages: 112 }), makeRecord({ pages: null })];

  it('is the count and the module statistic, with the unit a plain number needs', () => {
    const module = makeModule({ summary_field_key: 'pages', summary_agg: 'sum' });
    expect(groupStatLine(module, pages, group)).toBe('3 · 412 pages');
  });

  it('marks an average as one', () => {
    const module = makeModule({ summary_field_key: 'pages', summary_agg: 'average' });
    expect(groupStatLine(module, pages, group)).toBe('3 · avg 206 pages');
  });

  it('needs no unit for money, durations or ratings', () => {
    const spent = makeField({ key: 'spent', type: 'money' });
    const module = makeModule({ summary_field_key: 'spent', summary_agg: 'sum' });
    expect(groupStatLine(module, spent, [makeRecord({ spent: 150000 })])).toBe('1 · ₹1,500');
  });

  it('is just the count when the module counts, or the total cannot be made', () => {
    expect(groupStatLine(makeModule({ summary_agg: 'count' }), null, group)).toBe('3');
    expect(groupStatLine(makeModule({ summary_field_key: 'pages', summary_agg: 'sum' }), pages, [makeRecord({})])).toBe('1');
  });

  it('averages only the ratings that show, like the rows under it', () => {
    const score = makeField({ key: 'score', type: 'rating' });
    const module = makeModule({ summary_field_key: 'score', summary_agg: 'average' });
    const scored = [makeRecord({ score: 9 }), makeRecord({ score: 8 }), makeRecord({ score: 4 })];
    expect(groupStatLine(module, score, scored)).toBe('3 · avg 4/5');
  });

  it('ignores the tile period: the group is already the list in front of you', () => {
    const module = makeModule({ summary_field_key: 'pages', summary_agg: 'sum', summary_period: 'week' });
    expect(groupStatLine(module, pages, group)).toBe('3 · 412 pages');
  });
});
