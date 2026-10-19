/**
 * Containers: one product bought again and again.
 *
 * A row is one tub. v3 lets the same name hold many tubs - finished ones for
 * history, at most one open, spares waiting - and the last tub's real
 * lifespan becomes the first estimate for the next. The cases below pin how
 * "the last tub" is found and how its lifespan is carried over, because a
 * wrong link produces an estimate that looks just as confident as a right one.
 */
import {
  activeSibling,
  estimateLabel,
  finishedGroups,
  formatEstimate,
  lifecycleOf,
  lifespanDays,
  nameKey,
  previousContainer,
  previousContainers,
  priorEstimate,
  restockDraft,
  spareFor,
} from '../containers';
import type { Product } from '../types';

let seq = 0;
const product = (over: Partial<Product> = {}): Product => ({
  id: `p${++seq}`,
  user_id: 'u1',
  name: 'Whey',
  category: 'supplement',
  unit: 'g',
  total_quantity: 1000,
  per_use: 30,
  price_minor: 300000,
  opened_on: '2026-01-01',
  finished_on: null,
  note: 'chocolate',
  previous_id: null,
  expires_on: '2027-01-31',
  pao_months: 6,
  reorder_lead_days: 10,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...over,
});

describe('lifecycleOf', () => {
  it('reads the state from the dates, so it moves only by action', () => {
    expect(lifecycleOf(product({ opened_on: null }))).toBe('unopened');
    expect(lifecycleOf(product())).toBe('in_use');
    expect(lifecycleOf(product({ finished_on: '2026-02-01' }))).toBe('finished');
  });
});

describe('lifespanDays', () => {
  it('counts both the opening and the finishing day', () => {
    expect(lifespanDays(product({ opened_on: '2026-01-01', finished_on: '2026-02-11' }))).toBe(42);
  });

  it('is one day for something opened and finished the same day', () => {
    expect(lifespanDays(product({ opened_on: '2026-01-01', finished_on: '2026-01-01' }))).toBe(1);
  });

  it('crosses a daylight-saving change without losing a day', () => {
    // New York springs forward on 8 March 2026; 1 to 31 March is 31 days.
    expect(lifespanDays(product({ opened_on: '2026-03-01', finished_on: '2026-03-31' }))).toBe(31);
  });

  it('has none until it is finished, or for a spare', () => {
    expect(lifespanDays(product())).toBeNull();
    expect(lifespanDays(product({ opened_on: null, finished_on: '2026-01-05' }))).toBeNull();
  });
});

describe('nameKey', () => {
  it('ignores case and stray spaces, so "whey  Protein" and "Whey Protein" are one product', () => {
    expect(nameKey('  whey  Protein ')).toBe(nameKey('Whey Protein'));
  });
});

describe('previousContainer', () => {
  it('follows previous_id when it is set', () => {
    const old = product({ id: 'old', opened_on: '2025-10-01', finished_on: '2025-11-11' });
    const decoy = product({ id: 'decoy', opened_on: '2025-11-12', finished_on: '2025-12-31' });
    const current = product({ id: 'now', previous_id: 'old' });
    expect(previousContainer(current, [old, decoy, current])?.id).toBe('old');
  });

  it('falls back to the latest finished container of the same name', () => {
    // v2 data has no links: the tub before this one is the last one finished.
    const first = product({ id: 'a', opened_on: '2025-09-01', finished_on: '2025-10-15' });
    const second = product({ id: 'b', name: 'whey ', opened_on: '2025-10-16', finished_on: '2025-12-31' });
    const current = product({ id: 'c', opened_on: '2026-01-01' });
    expect(previousContainer(current, [first, second, current])?.id).toBe('b');
  });

  it('never picks itself, an unfinished container, or another product', () => {
    const spare = product({ id: 's', opened_on: null });
    const other = product({ id: 'o', name: 'Creatine', finished_on: '2025-12-01', opened_on: '2025-11-01' });
    const current = product({ id: 'c' });
    expect(previousContainer(current, [spare, other, current])).toBeNull();
  });

  it('ignores a container that finished after this one was opened', () => {
    // Two tubs open at once (before v3 enforced one) are not a sequence.
    const overlapping = product({ id: 'x', opened_on: '2025-12-01', finished_on: '2026-01-20' });
    const current = product({ id: 'c', opened_on: '2026-01-01' });
    expect(previousContainer(current, [overlapping, current])).toBeNull();
  });

  it('counts one finished the day this one opened, the usual way to switch', () => {
    const old = product({ id: 'old', opened_on: '2025-11-21', finished_on: '2026-01-01' });
    const current = product({ id: 'c', opened_on: '2026-01-01' });
    expect(previousContainer(current, [old, current])?.id).toBe('old');
  });
});

describe('priorEstimate', () => {
  const old = product({ id: 'old', opened_on: '2025-11-21', finished_on: '2026-01-01' }); // 42 days

  it("gives a new container the last one's lifespan", () => {
    const current = product({ opened_on: '2026-01-02', previous_id: 'old' });
    const estimate = priorEstimate(current, old, '2026-01-02');
    expect(estimate).toEqual({
      totalDays: 42,
      daysLeft: 42,
      emptyOn: '2026-02-13',
      lastLasted: 42,
      lastTotal: 1000,
      scaled: false,
    });
  });

  it('counts down the days already gone', () => {
    const current = product({ opened_on: '2026-01-02' });
    expect(priorEstimate(current, old, '2026-01-05')?.daysLeft).toBe(39);
  });

  it('never goes below zero', () => {
    const current = product({ opened_on: '2026-01-02' });
    expect(priorEstimate(current, old, '2026-06-01')?.daysLeft).toBe(0);
  });

  it('scales by size when the units match', () => {
    // A 2 kg tub after a 1 kg one lasts about twice as long.
    const current = product({ opened_on: '2026-01-02', total_quantity: 2000 });
    const estimate = priorEstimate(current, old, '2026-01-02');
    expect(estimate?.totalDays).toBe(84);
    expect(estimate?.scaled).toBe(true);
  });

  it('does not scale across different units', () => {
    const current = product({ opened_on: '2026-01-02', unit: 'scoops', total_quantity: 33 });
    expect(priorEstimate(current, old, '2026-01-02')?.totalDays).toBe(42);
  });

  it('has nothing to say without a finished previous container', () => {
    const current = product({ opened_on: '2026-01-02' });
    expect(priorEstimate(current, null, '2026-01-02')).toBeNull();
    expect(priorEstimate(current, product({ id: 'open' }), '2026-01-02')).toBeNull();
  });

  it('is not given for a spare or a finished container', () => {
    expect(priorEstimate(product({ opened_on: null }), old, '2026-01-02')).toBeNull();
    expect(priorEstimate(product({ finished_on: '2026-01-03' }), old, '2026-01-03')).toBeNull();
  });
});

describe('formatEstimate and estimateLabel', () => {
  it('reads as approximate', () => {
    expect(formatEstimate(42)).toBe('~42 days');
    expect(formatEstimate(1)).toBe('~1 day');
    expect(formatEstimate(0)).toBe('about empty');
    expect(formatEstimate(44)).toBe('~44 days');
    expect(formatEstimate(67)).toBe('about 2 months');
  });

  it('says where the number came from', () => {
    expect(
      estimateLabel(
        { totalDays: 42, daysLeft: 42, emptyOn: '2026-02-13', lastLasted: 42, lastTotal: 1000, scaled: false },
        'g',
      ),
    ).toBe('~42 days (last one lasted 42)');
    expect(
      estimateLabel(
        { totalDays: 84, daysLeft: 80, emptyOn: '2026-03-01', lastLasted: 42, lastTotal: 1000, scaled: true },
        'g',
      ),
    ).toBe('about 3 months (last one: 42 days for 1000 g)');
  });
});

describe('finishedGroups', () => {
  it('stacks repeat purchases under one name, newest first', () => {
    const a = product({ id: 'a', opened_on: '2025-07-01', finished_on: '2025-08-10' });
    const b = product({ id: 'b', name: 'whey', opened_on: '2025-08-11', finished_on: '2025-09-20' });
    const c = product({ id: 'c', name: 'Sunscreen', opened_on: '2025-06-01', finished_on: '2025-10-01' });
    const open = product({ id: 'open' });

    const groups = finishedGroups([a, c, b, open]);
    expect(groups.map((g) => [g.name, g.containers.map((p) => p.id)])).toEqual([
      ['Sunscreen', ['c']],
      ['whey', ['b', 'a']],
    ]);
  });
});

describe('previousContainers', () => {
  it('lists the finished tubs of the same product, newest first, without this one', () => {
    const a = product({ id: 'a', opened_on: '2025-07-01', finished_on: '2025-08-10' });
    const b = product({ id: 'b', opened_on: '2025-08-11', finished_on: '2025-09-20' });
    const current = product({ id: 'c', opened_on: '2025-09-21' });
    expect(previousContainers(current, [a, current, b]).map((p) => p.id)).toEqual(['b', 'a']);
  });
});

describe('spareFor and activeSibling', () => {
  const current = product({ id: 'c' });
  const spareOld = product({ id: 's1', opened_on: null, created_at: '2026-01-05T00:00:00Z' });
  const spareNew = product({ id: 's2', opened_on: null, created_at: '2026-01-09T00:00:00Z' });
  const otherSpare = product({ id: 'x', name: 'Creatine', opened_on: null });

  it('finds the spare that would be opened next: the oldest one', () => {
    expect(spareFor(current, [spareNew, current, otherSpare, spareOld])?.id).toBe('s1');
  });

  it('has no spare for a finished or unopened container', () => {
    expect(spareFor(spareOld, [spareNew, spareOld])).toBeNull();
    expect(spareFor(product({ finished_on: '2026-01-01' }), [spareOld])).toBeNull();
  });

  it('finds the open container a spare would replace', () => {
    expect(activeSibling(spareOld, [current, spareOld, spareNew])?.id).toBe('c');
    expect(activeSibling(spareOld, [spareOld, spareNew])).toBeNull();
  });
});

describe('restockDraft', () => {
  const from = product({ id: 'old', finished_on: '2026-02-11' });

  it('copies what stays the same and opens the new one today', () => {
    expect(restockDraft(from, '2026-02-12', false)).toEqual({
      name: 'Whey',
      category: 'supplement',
      unit: 'g',
      total_quantity: 1000,
      per_use: 30,
      // Pre-filled from the last purchase, editable: prices change.
      price_minor: 300000,
      opened_on: '2026-02-12',
      // A new tub has its own printed date and nothing to note yet.
      note: '',
      expires_on: null,
      pao_months: 6,
      reorder_lead_days: 10,
      previous_id: 'old',
    });
  });

  it('leaves a spare unopened', () => {
    expect(restockDraft(from, '2026-02-12', true).opened_on).toBeNull();
  });
});
