/**
 * plates.ts - what to put on the bar.
 *
 * Works from the plates you actually own (an inventory kept on the phone),
 * so the answer is always something you can load. Taking the heaviest plate
 * first is the obvious method and it is wrong: with one pair of 20s and two
 * pairs of 15s, 30 a side is 15 + 15, which "20 first" never finds. So this
 * searches every combination you own, and picks the heaviest load not above
 * the target, using the fewest plates on a tie.
 */

export type Inventory = {
  barKg: number;
  /** Plates by weight, counted in PAIRS: one for each side. */
  plates: { kg: number; pairs: number }[];
};

export const DEFAULT_INVENTORY: Inventory = {
  barKg: 20,
  plates: [25, 20, 15, 10, 5, 2.5, 1.25].map((kg) => ({ kg, pairs: 4 })),
};

export type Loading = { perSide: number[]; achievedKg: number; exact: boolean };

/** Plate maths in hundredths of a kilo would be overkill; twentieths cover every real plate. */
const UNIT = 20;
const toUnits = (kg: number) => Math.round(kg * UNIT);

/**
 * Fewer plates wins; on a tie, the heavier plates (25 + 15 over 20 + 20),
 * which is how people load a bar and what they expect to read.
 */
function better(candidate: number[], current: number[] | null): boolean {
  if (!current) return true;
  if (candidate.length !== current.length) return candidate.length < current.length;
  for (let i = 0; i < candidate.length; i++) {
    if (candidate[i] !== current[i]) return candidate[i] > current[i];
  }
  return false;
}

export function platesFor(targetKg: number, inventory: Inventory): Loading {
  const bar = inventory.barKg;
  if (targetKg <= bar) return { perSide: [], achievedKg: bar, exact: targetKg === bar };

  const goal = toUnits((targetKg - bar) / 2);
  const items = inventory.plates
    .filter((p) => p.kg > 0 && p.pairs > 0)
    .flatMap((p) => Array.from({ length: p.pairs }, () => p.kg));

  // combo[s]: the fewest plates found summing to exactly s units, or null.
  const combo: (number[] | null)[] = Array.from({ length: goal + 1 }, () => null);
  combo[0] = [];
  for (const kg of items) {
    const w = toUnits(kg);
    for (let s = goal; s >= w; s--) {
      const from = combo[s - w];
      if (!from) continue;
      const candidate = [...from, kg].sort((a, b) => b - a);
      if (better(candidate, combo[s])) combo[s] = candidate;
    }
  }

  let best = goal;
  while (best > 0 && !combo[best]) best--;
  const perSide = combo[best] ?? [];
  const achievedKg = Math.round((bar + (2 * best) / UNIT) * 100) / 100;
  return { perSide, achievedKg, exact: best === goal };
}

/**
 * Warm-ups for a working weight: 40, 60 and 80 percent for 8, 5 and 3 reps,
 * each rounded down to a load you can make, never below the empty bar, never
 * a repeat, and never as heavy as the work itself.
 */
export function warmupSets(workKg: number, inventory: Inventory): { kg: number; reps: number }[] {
  if (workKg <= inventory.barKg) return [];
  const steps = [
    { pct: 0.4, reps: 8 },
    { pct: 0.6, reps: 5 },
    { pct: 0.8, reps: 3 },
  ];
  const out: { kg: number; reps: number }[] = [];
  for (const step of steps) {
    const kg = Math.max(inventory.barKg, platesFor(workKg * step.pct, inventory).achievedKg);
    if (kg >= workKg || out.some((w) => w.kg === kg)) continue;
    out.push({ kg, reps: step.reps });
  }
  return out;
}
