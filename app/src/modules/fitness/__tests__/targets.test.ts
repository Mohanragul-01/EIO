/**
 * Next-session targets: double progression. Work up through a rep range at
 * one weight; when every working set reaches the top, add weight and start
 * again at the bottom. The suggestion always says why.
 */
import type { SetFact } from '../load';
import { nextTarget } from '../targets';

const lift = { load_mode: 'external' as const, tracking_type: 'reps' as const };
const pullUp = { load_mode: 'bodyweight' as const, tracking_type: 'reps' as const };
const plank = { load_mode: 'bodyweight' as const, tracking_type: 'time' as const };
const range = { repsMin: 8, repsMax: 12, secondsMin: null, secondsMax: null, incrementKg: null };

let seq = 0;
function s(partial: Partial<SetFact>): SetFact {
  seq += 1;
  return {
    id: `s${seq}`,
    exercise_id: 'x',
    session_id: 'last',
    set_type: 'normal',
    reps: null,
    duration_seconds: null,
    weight_kg: 0,
    assist_kg: null,
    clean: true,
    created_at: '',
    ...partial,
  };
}

const base = { lastDate: '2026-10-15', today: '2026-10-19' };

describe('nextTarget', () => {
  it('adds weight and drops to the bottom of the range when every set hit the top', () => {
    const last = [12, 12, 12].map((reps) => s({ reps, weight_kg: 60 }));
    expect(nextTarget({ ...base, exercise: lift, slot: range, lastWorkingSets: last })).toEqual({
      weight: 62.5,
      assist: null,
      reps: 8,
      seconds: null,
      reason: '+2.5 kg · every set hit 12',
    });
  });

  it("uses the slot's own increment", () => {
    const last = [12, 12].map((reps) => s({ reps, weight_kg: 20 }));
    expect(
      nextTarget({
        ...base,
        exercise: lift,
        slot: { ...range, incrementKg: 1 },
        lastWorkingSets: last,
      }).weight,
    ).toBe(21);
  });

  it('otherwise keeps the weight and aims one rep higher, within the range', () => {
    const last = [12, 10, 9].map((reps) => s({ reps, weight_kg: 60 }));
    expect(nextTarget({ ...base, exercise: lift, slot: range, lastWorkingSets: last })).toEqual({
      weight: 60,
      assist: null,
      reps: 12,
      seconds: null,
      reason: null,
    });
    const lower = [9, 8].map((reps) => s({ reps, weight_kg: 60 }));
    expect(nextTarget({ ...base, exercise: lift, slot: range, lastWorkingSets: lower }).reps).toBe(
      10,
    );
  });

  it('warm-ups do not count toward "every set hit the top"', () => {
    const last = [
      s({ reps: 5, weight_kg: 30, set_type: 'warmup' }),
      ...[12, 12].map((reps) => s({ reps, weight_kg: 60 })),
    ];
    expect(nextTarget({ ...base, exercise: lift, slot: range, lastWorkingSets: last }).weight).toBe(
      62.5,
    );
  });

  it('without a range there is nothing to progress to', () => {
    const last = [s({ reps: 5, weight_kg: 100 })];
    expect(
      nextTarget({ ...base, exercise: lift, slot: null, lastWorkingSets: last }).reason,
    ).toBeNull();
  });

  it('bodyweight: one more rep, at the same added load', () => {
    const last = [8, 7].map((reps) => s({ reps, weight_kg: 5 }));
    expect(nextTarget({ ...base, exercise: pullUp, slot: null, lastWorkingSets: last })).toEqual({
      weight: 5,
      assist: null,
      reps: 9,
      seconds: null,
      reason: '+1 rep',
    });
  });

  it('bodyweight: the target carries the assistance of the load it was set at', () => {
    const assisted = [8, 7].map((reps) => s({ reps, assist_kg: 20 }));
    expect(
      nextTarget({ ...base, exercise: pullUp, slot: null, lastWorkingSets: assisted }),
    ).toMatchObject({ weight: 0, assist: 20, reps: 9 });
    // The first unassisted set is the harder load, so the target is there.
    const mixed = [s({ reps: 8, assist_kg: 20 }), s({ reps: 5 })];
    expect(
      nextTarget({ ...base, exercise: pullUp, slot: null, lastWorkingSets: mixed }),
    ).toMatchObject({ weight: 0, assist: null, reps: 6 });
  });

  it('holds: five more seconds', () => {
    const last = [s({ duration_seconds: 30 }), s({ duration_seconds: 25 })];
    expect(nextTarget({ ...base, exercise: plank, slot: null, lastWorkingSets: last })).toEqual({
      weight: 0,
      assist: null,
      reps: null,
      seconds: 35,
      reason: '+5 s',
    });
  });

  it('after more than two weeks away, repeats last time rather than pushing on', () => {
    const last = [12, 12].map((reps) => s({ reps, weight_kg: 60 }));
    expect(
      nextTarget({
        exercise: lift,
        slot: range,
        lastWorkingSets: last,
        lastDate: '2026-09-20',
        today: '2026-10-19',
      }),
    ).toEqual({
      weight: 60,
      assist: null,
      reps: 12,
      seconds: null,
      reason: 'Back after 29 days · same weight',
    });
  });

  it('nothing to go on gives nothing', () => {
    expect(nextTarget({ ...base, exercise: lift, slot: range, lastWorkingSets: [] })).toEqual({
      weight: null,
      assist: null,
      reps: null,
      seconds: null,
      reason: null,
    });
  });
});
