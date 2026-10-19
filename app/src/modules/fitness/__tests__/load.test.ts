/**
 * Load, volume and how a set is written down.
 *
 * The rule that matters most here: on a bodyweight exercise, weight_kg is what
 * you ADD and assistance is its own number, so the database never holds a
 * negative weight. These functions are where the two are combined, so every
 * volume and record sum downstream stays honest.
 */
import {
  effectiveLoad,
  formatLoadChip,
  formatSetShort,
  isWorking,
  netLoad,
  setLabels,
  toSetFact,
  workingVolume,
  type SetFact,
} from '../load';
import type { Exercise } from '../types';

const external: Pick<Exercise, 'id' | 'load_mode' | 'bodyweight_factor' | 'tracking_type'> = {
  id: 'bench',
  load_mode: 'external',
  bodyweight_factor: 1,
  tracking_type: 'reps',
};
const pullUp = { ...external, id: 'pullup', load_mode: 'bodyweight' as const };
const pushUp = { ...pullUp, id: 'pushup', bodyweight_factor: 0.65 };
const lSit = { ...pullUp, id: 'lsit', tracking_type: 'time' as const };
const exercisesById = { bench: external, pullup: pullUp, pushup: pushUp, lsit: lSit };

let seq = 0;
function fact(partial: Partial<SetFact> & Pick<SetFact, 'exercise_id'>): SetFact {
  seq += 1;
  return {
    id: `s${seq}`,
    session_id: 'today',
    set_type: 'normal',
    reps: null,
    duration_seconds: null,
    weight_kg: 0,
    assist_kg: null,
    clean: true,
    created_at: `2026-10-19T10:00:${String(seq % 60).padStart(2, '0')}Z`,
    ...partial,
  };
}

describe('toSetFact', () => {
  it('reads a v2 row, which has no set type or assistance, as a normal set', () => {
    const v2Row = {
      id: 'a',
      session_id: 's',
      exercise_id: 'bench',
      reps: 5,
      duration_seconds: null,
      weight_kg: 80,
      created_at: '2026-01-01T00:00:00Z',
    };
    const f = toSetFact(v2Row);
    expect(f.set_type).toBe('normal');
    expect(f.assist_kg).toBeNull();
    expect(f.clean).toBe(true);
  });

  it('turns numeric strings from the database into numbers', () => {
    // numeric columns can arrive as strings depending on the client.
    const f = toSetFact({
      id: 'a',
      session_id: 's',
      exercise_id: 'bench',
      reps: 5,
      duration_seconds: null,
      weight_kg: '82.5' as unknown as number,
      assist_kg: '10' as unknown as number,
      created_at: '2026-01-01T00:00:00Z',
    });
    expect(f.weight_kg).toBe(82.5);
    expect(f.assist_kg).toBe(10);
  });
});

describe('netLoad and effectiveLoad', () => {
  it('net load is added weight minus assistance', () => {
    expect(netLoad({ weight_kg: 10, assist_kg: null })).toBe(10);
    expect(netLoad({ weight_kg: 0, assist_kg: 20 })).toBe(-20);
  });

  it('an external lift is just its weight', () => {
    expect(effectiveLoad({ weight_kg: 60, assist_kg: null }, external, 80)).toBe(60);
  });

  it('a bodyweight lift is bodyweight times the factor, plus added, minus assistance', () => {
    expect(effectiveLoad({ weight_kg: 10, assist_kg: null }, pullUp, 70)).toBe(80);
    expect(effectiveLoad({ weight_kg: 0, assist_kg: 20 }, pullUp, 70)).toBe(50);
    expect(effectiveLoad({ weight_kg: 0, assist_kg: null }, pushUp, 80)).toBe(52);
  });

  it('is unknown for a bodyweight lift without a weigh-in', () => {
    expect(effectiveLoad({ weight_kg: 10, assist_kg: null }, pullUp, null)).toBeNull();
  });

  it('never goes below zero', () => {
    expect(effectiveLoad({ weight_kg: 0, assist_kg: 90 }, pullUp, 70)).toBe(0);
  });
});

describe('workingVolume', () => {
  it('excludes warm-ups and holds', () => {
    const sets = [
      fact({ exercise_id: 'bench', set_type: 'warmup', reps: 10, weight_kg: 40 }),
      fact({ exercise_id: 'bench', reps: 5, weight_kg: 80 }),
      fact({ exercise_id: 'lsit', duration_seconds: 30 }),
    ];
    expect(workingVolume(sets, exercisesById, 70)).toBe(400);
  });

  it('counts failure and drop sets, which are real work', () => {
    const sets = [
      fact({ exercise_id: 'bench', set_type: 'failure', reps: 3, weight_kg: 100 }),
      fact({ exercise_id: 'bench', set_type: 'drop', reps: 8, weight_kg: 60 }),
    ];
    expect(workingVolume(sets, exercisesById, null)).toBe(780);
  });

  it('includes bodyweight when a weigh-in is known', () => {
    const sets = [fact({ exercise_id: 'pullup', reps: 10 })];
    expect(workingVolume(sets, exercisesById, 70)).toBe(700);
  });

  it('falls back to added weight only, without a weigh-in', () => {
    const sets = [
      fact({ exercise_id: 'pullup', reps: 5, weight_kg: 10 }),
      fact({ exercise_id: 'pullup', reps: 8, assist_kg: 20 }),
    ];
    expect(workingVolume(sets, exercisesById, null)).toBe(50);
  });

  it('treats a set for an exercise it does not know as external', () => {
    expect(workingVolume([fact({ exercise_id: 'gone', reps: 5, weight_kg: 10 })], {}, 70)).toBe(50);
  });
});

describe('isWorking', () => {
  it('everything but a warm-up', () => {
    expect(isWorking({ set_type: 'warmup' })).toBe(false);
    expect(isWorking({ set_type: 'failure' })).toBe(true);
  });
});

describe('setLabels', () => {
  it('letters for special sets, and numbers that count only normal sets', () => {
    const types = ['warmup', 'normal', 'normal', 'failure', 'drop', 'normal'] as const;
    expect(setLabels(types.map((set_type) => ({ set_type })))).toEqual([
      'W',
      '1',
      '2',
      'F',
      'D',
      '3',
    ]);
  });
});

describe('formatLoadChip', () => {
  it('shows added weight, assistance and bands for bodyweight exercises', () => {
    expect(formatLoadChip({ weight_kg: 10, assist_kg: null, band_id: null }, pullUp)).toBe('+10');
    expect(formatLoadChip({ weight_kg: 0, assist_kg: 20, band_id: null }, pullUp)).toBe('−20');
    expect(formatLoadChip({ weight_kg: 0, assist_kg: 15, band_id: 'b' }, pullUp, 'Red')).toBe(
      'Red band',
    );
    expect(formatLoadChip({ weight_kg: 2.5, assist_kg: null, band_id: null }, pullUp)).toBe('+2.5');
  });

  it('shows nothing when unloaded, and nothing for an external lift', () => {
    expect(formatLoadChip({ weight_kg: 0, assist_kg: null, band_id: null }, pullUp)).toBeNull();
    expect(formatLoadChip({ weight_kg: 60, assist_kg: null, band_id: null }, external)).toBeNull();
  });
});

describe('formatSetShort', () => {
  const base = { assist_kg: null, band_id: null, side: null } as const;

  it('weight × reps for an external lift', () => {
    expect(formatSetShort({ ...base, weight_kg: 60, reps: 8, duration_seconds: null }, external)).toBe(
      '60 × 8',
    );
    expect(
      formatSetShort({ ...base, weight_kg: 62.5, reps: 5, duration_seconds: null }, external),
    ).toBe('62.5 × 5');
  });

  it('× reps for unloaded bodyweight, with the load after a dot when there is one', () => {
    expect(formatSetShort({ ...base, weight_kg: 0, reps: 12, duration_seconds: null }, pullUp)).toBe(
      '× 12',
    );
    expect(formatSetShort({ ...base, weight_kg: 10, reps: 8, duration_seconds: null }, pullUp)).toBe(
      '8 · +10',
    );
  });

  it('seconds for holds, with assistance or a band after a dot', () => {
    expect(formatSetShort({ ...base, weight_kg: 0, reps: null, duration_seconds: 45 }, lSit)).toBe(
      '45s',
    );
    expect(formatSetShort({ ...base, weight_kg: 0, reps: null, duration_seconds: 75 }, lSit)).toBe(
      '1:15',
    );
    expect(
      formatSetShort({ ...base, assist_kg: 20, weight_kg: 0, reps: null, duration_seconds: 22 }, lSit),
    ).toBe('22s · −20');
    expect(
      formatSetShort(
        { ...base, assist_kg: 15, band_id: 'b', weight_kg: 0, reps: null, duration_seconds: 22 },
        lSit,
        'Red',
      ),
    ).toBe('22s · Red band');
  });

  it('marks the side of a one-sided set', () => {
    expect(
      formatSetShort({ ...base, side: 'left', weight_kg: 0, reps: 5, duration_seconds: null }, pullUp),
    ).toBe('× 5 · L');
  });
});
