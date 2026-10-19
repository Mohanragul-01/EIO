/**
 * Plate maths: which plates go on each side for a target weight, with the
 * plates you actually own, and warm-up sets rounded to what you can load.
 */
import { DEFAULT_INVENTORY, platesFor, warmupSets, type Inventory } from '../plates';

describe('platesFor', () => {
  it('loads a round number exactly, heaviest plates first', () => {
    expect(platesFor(100, DEFAULT_INVENTORY)).toEqual({
      perSide: [25, 15],
      achievedKg: 100,
      exact: true,
    });
  });

  it('uses the small plates', () => {
    expect(platesFor(102.5, DEFAULT_INVENTORY)).toEqual({
      perSide: [25, 15, 1.25],
      achievedKg: 102.5,
      exact: true,
    });
  });

  it('gives the closest weight not above the target when it cannot be exact', () => {
    expect(platesFor(101, DEFAULT_INVENTORY)).toEqual({
      perSide: [25, 15],
      achievedKg: 100,
      exact: false,
    });
  });

  it('finds combinations that taking the heaviest plate first would miss', () => {
    const inventory: Inventory = {
      barKg: 20,
      plates: [
        { kg: 20, pairs: 1 },
        { kg: 15, pairs: 2 },
      ],
    };
    // 30 a side: 20 first leaves 10, which cannot be made; 15 + 15 can.
    expect(platesFor(80, inventory)).toEqual({ perSide: [15, 15], achievedKg: 80, exact: true });
  });

  it('respects how many pairs you own', () => {
    const inventory: Inventory = {
      barKg: 20,
      plates: [
        { kg: 25, pairs: 1 },
        { kg: 20, pairs: 1 },
        { kg: 15, pairs: 1 },
        { kg: 10, pairs: 1 },
      ],
    };
    expect(platesFor(160, inventory).perSide).toEqual([25, 20, 15, 10]);
    expect(platesFor(220, inventory)).toMatchObject({ achievedKg: 160, exact: false });
  });

  it('a target at or under the bar is just the bar', () => {
    expect(platesFor(20, DEFAULT_INVENTORY)).toEqual({ perSide: [], achievedKg: 20, exact: true });
    expect(platesFor(15, DEFAULT_INVENTORY)).toEqual({ perSide: [], achievedKg: 20, exact: false });
  });

  it('prefers fewer plates when two loads weigh the same', () => {
    const inventory: Inventory = {
      barKg: 20,
      plates: [
        { kg: 10, pairs: 2 },
        { kg: 5, pairs: 4 },
      ],
    };
    expect(platesFor(40, inventory).perSide).toEqual([10]);
  });
});

describe('warmupSets', () => {
  it('builds 40, 60 and 80 percent, rounded to plates you can load', () => {
    expect(warmupSets(100, DEFAULT_INVENTORY)).toEqual([
      { kg: 40, reps: 8 },
      { kg: 60, reps: 5 },
      { kg: 80, reps: 3 },
    ]);
  });

  it('never repeats a weight, never drops below the bar, never reaches the work weight', () => {
    const sets = warmupSets(30, DEFAULT_INVENTORY);
    expect(sets).toEqual([
      { kg: 20, reps: 8 },
      { kg: 22.5, reps: 3 },
    ]);
  });

  it('nothing to warm up under a bar-weight lift', () => {
    expect(warmupSets(20, DEFAULT_INVENTORY)).toEqual([]);
  });
});
