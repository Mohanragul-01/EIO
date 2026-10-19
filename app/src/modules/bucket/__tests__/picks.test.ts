/**
 * Pick for me: three things you could do, chosen for you, the same all day.
 *
 * With 469 free things on the list, the hard part is choosing, not finding.
 * The picks must not flicker on every visit (or nobody trusts them), must
 * follow the filters you set, and must survive you acting on one of them:
 * ticking the first pick should replace that pick, not reshuffle all three.
 */
import {
  hashSeed,
  isSnoozed,
  pickPool,
  pickSeed,
  picksFor,
  snoozeUntil,
  type PickFilters,
} from '../picks';
import type { BucketItem } from '../types';

let seq = 0;
const item = (over: Partial<BucketItem> = {}): BucketItem => ({
  id: `item-${++seq}`,
  user_id: 'u1',
  category: 'Water Adventures',
  title: 'Surfing',
  cost: 'low',
  is_done: false,
  done_on: null,
  done_precision: null,
  note: '',
  memory: '',
  place: '',
  again: null,
  snoozed_until: null,
  focus: null,
  target_on: null,
  target_precision: null,
  est_cost_minor: null,
  saved_minor: 0,
  position: 0,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...over,
});

const ids = (rows: BucketItem[]) => rows.map((row) => row.id);
const today = '2026-10-19';
const pool = Array.from({ length: 60 }, (_, i) => item({ title: `Thing ${i}` }));

describe('hashSeed', () => {
  it('is FNV-1a, so the same text gives the same number everywhere', () => {
    expect(hashSeed('')).toBe(2166136261);
    expect(hashSeed('a')).toBe(0xe40c292c);
  });
});

describe('pickSeed', () => {
  it('is the day itself until you shuffle', () => {
    expect(pickSeed(today, 0)).toBe('2026-10-19');
    expect(pickSeed(today, 2)).toBe('2026-10-19#2');
  });
});

describe('picksFor', () => {
  it('gives three', () => {
    expect(picksFor(pool, pickSeed(today, 0))).toHaveLength(3);
  });

  it('gives the same three all day', () => {
    expect(ids(picksFor(pool, pickSeed(today, 0)))).toEqual(
      ids(picksFor(pool, pickSeed(today, 0))),
    );
  });

  it('does not depend on the order the list arrived in', () => {
    // A reload can return rows in another order; the picks must not notice.
    const reversed = [...pool].reverse();
    expect(ids(picksFor(reversed, pickSeed(today, 0)))).toEqual(
      ids(picksFor(pool, pickSeed(today, 0))),
    );
  });

  it('replaces only the pick you acted on', () => {
    const before = picksFor(pool, pickSeed(today, 0));
    const ticked = before[0];
    const after = picksFor(
      pool.filter((row) => row.id !== ticked.id),
      pickSeed(today, 0),
    );

    expect(ids(after)).not.toContain(ticked.id);
    expect(ids(after)).toEqual(expect.arrayContaining(ids(before.slice(1))));
  });

  it('changes with the day, and with a shuffle', () => {
    const monday = ids(picksFor(pool, pickSeed(today, 0)));
    expect(ids(picksFor(pool, pickSeed('2026-10-20', 0)))).not.toEqual(monday);
    expect(ids(picksFor(pool, pickSeed(today, 1)))).not.toEqual(monday);
  });

  it('gives what there is when there are fewer than three', () => {
    const two = pool.slice(0, 2);
    expect(picksFor(two, pickSeed(today, 0))).toHaveLength(2);
    expect(picksFor([], pickSeed(today, 0))).toEqual([]);
  });
});

describe('pickPool', () => {
  const any: PickFilters = { cost: 'any', category: 'any', query: '', want: 'any' };

  it('leaves out what is done, snoozed, or already on Now', () => {
    const open = item({ title: 'Open' });
    const rows = [
      open,
      item({ is_done: true, done_on: '2026-01-01' }),
      item({ snoozed_until: '2026-11-18' }),
      item({ focus: 'now' }),
    ];
    expect(ids(pickPool(rows, any, today))).toEqual([open.id]);
  });

  it('lets a snoozed item back on the day its snooze ends', () => {
    const rows = [item({ snoozed_until: today })];
    expect(pickPool(rows, any, today)).toHaveLength(1);
  });

  it('keeps Next items, which are wanted but not yet chosen', () => {
    expect(pickPool([item({ focus: 'next' })], any, today)).toHaveLength(1);
  });

  it('honours cost, category, search and want', () => {
    const match = item({ cost: 'low', category: 'Music & Sound', title: 'Learn a drum fill', focus: 'next' });
    const rows = [
      match,
      item({ cost: 'high', category: 'Music & Sound', title: 'Learn a drum fill', focus: 'next' }),
      item({ cost: 'low', category: 'Water Adventures', title: 'Learn a drum fill', focus: 'next' }),
      item({ cost: 'low', category: 'Music & Sound', title: 'Sing in a choir', focus: 'next' }),
      item({ cost: 'low', category: 'Music & Sound', title: 'Learn a drum fill', focus: null }),
    ];
    const filters: PickFilters = {
      cost: 'low',
      category: 'Music & Sound',
      query: 'drum',
      want: 'next',
    };
    expect(ids(pickPool(rows, filters, today))).toEqual([match.id]);
  });
});

describe('snoozing', () => {
  it('hides for thirty days', () => {
    expect(snoozeUntil(today)).toBe('2026-11-18');
  });

  it('is snoozed until that day, and not on it', () => {
    expect(isSnoozed(item({ snoozed_until: '2026-11-18' }), '2026-11-17')).toBe(true);
    expect(isSnoozed(item({ snoozed_until: '2026-11-18' }), '2026-11-18')).toBe(false);
    expect(isSnoozed(item({ snoozed_until: null }), today)).toBe(false);
  });
});
