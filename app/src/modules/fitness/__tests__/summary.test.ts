/**
 * The finish summary: what you did, how it compares with the last time you
 * ran the same routine, and what changed from the routine itself.
 */
import type { SetFact } from '../load';
import {
  compareToLast,
  describeDeviation,
  resolveRoutineSlots,
  routineDeviation,
  routineSlotsFromSession,
  sessionClockEnd,
  sessionDeviation,
  sessionSummary,
  workingSetCount,
} from '../summary';

const bench = {
  load_mode: 'external' as const,
  tracking_type: 'reps' as const,
  bodyweight_factor: 1,
  name: 'Bench',
};
const pullUp = {
  load_mode: 'bodyweight' as const,
  tracking_type: 'reps' as const,
  bodyweight_factor: 1,
  name: 'Pull-up',
};
const plank = {
  load_mode: 'bodyweight' as const,
  tracking_type: 'time' as const,
  bodyweight_factor: 1,
  name: 'Plank',
};
const exercises = { bench, pullup: pullUp, plank };

let seq = 0;
function s(exercise_id: string, partial: Partial<SetFact>): SetFact {
  seq += 1;
  return {
    id: `s${seq}`,
    exercise_id,
    session_id: 'x',
    set_type: 'normal',
    reps: null,
    duration_seconds: null,
    weight_kg: 0,
    assist_kg: null,
    clean: true,
    created_at: '2026-10-19T10:00:00Z',
    ...partial,
  };
}

describe('sessionSummary', () => {
  it('adds up duration, working volume, working sets and records', () => {
    const sets = [
      s('bench', { set_type: 'warmup', reps: 10, weight_kg: 40 }),
      s('bench', { reps: 5, weight_kg: 80 }),
      s('bench', { reps: 5, weight_kg: 80 }),
      s('pullup', { reps: 10 }),
    ];
    const summary = sessionSummary({
      sets,
      exercisesById: exercises,
      bodyweightKg: 70,
      records: {
        [sets[2].id]: [{ kind: 'heaviest', value: 80, previous: 77.5, label: 'Heaviest weight' }],
      },
      startedAt: '2026-10-19T10:00:00Z',
      endedAt: '2026-10-19T11:05:00Z',
    });
    expect(summary.durationMs).toBe(65 * 60_000);
    expect(summary.volume).toBe(800 + 700);
    expect(summary.workingSets).toBe(3);
    expect(summary.records).toEqual([
      {
        exerciseId: 'bench',
        setId: sets[2].id,
        hit: expect.objectContaining({ kind: 'heaviest' }),
      },
    ]);
  });

  it('has no duration without a start and an end', () => {
    const summary = sessionSummary({
      sets: [],
      exercisesById: exercises,
      bodyweightKg: null,
      records: {},
      startedAt: null,
      endedAt: null,
    });
    expect(summary.durationMs).toBeNull();
  });
});

describe('compareToLast', () => {
  it("reports each exercise's volume change and best set against last time", () => {
    const now = [s('bench', { reps: 5, weight_kg: 82.5 }), s('bench', { reps: 5, weight_kg: 80 })];
    const last = [s('bench', { reps: 5, weight_kg: 80 }), s('bench', { reps: 5, weight_kg: 80 })];
    expect(compareToLast(now, last, exercises, null)).toEqual([
      {
        exerciseId: 'bench',
        name: 'Bench',
        change: 'up',
        volumeDelta: 12.5,
        best: '82.5 × 5',
        lastBest: '80 × 5',
      },
    ]);
  });

  it('marks an exercise you did not do last time as new', () => {
    const result = compareToLast(
      [s('pullup', { reps: 8 })],
      [s('bench', { reps: 5, weight_kg: 80 })],
      exercises,
      null,
    );
    expect(result).toEqual([
      expect.objectContaining({ exerciseId: 'pullup', change: 'new', lastBest: null }),
    ]);
  });

  it('compares bodyweight sets by reps and holds by time', () => {
    const result = compareToLast(
      [s('pullup', { reps: 9 }), s('plank', { duration_seconds: 50 })],
      [s('pullup', { reps: 10 }), s('plank', { duration_seconds: 45 })],
      exercises,
      null,
    );
    expect(result.map((r) => [r.exerciseId, r.change, r.best])).toEqual([
      ['pullup', 'down', '× 9'],
      ['plank', 'up', '50s'],
    ]);
  });

  it('is empty when there is no last time', () => {
    expect(compareToLast([s('bench', { reps: 5, weight_kg: 80 })], null, exercises, null)).toEqual(
      [],
    );
  });
});

describe('routineDeviation', () => {
  const names = { bench: 'Bench', rows: 'Rows', dips: 'Dips' };

  it('finds added exercises, skipped ones and changed set counts', () => {
    const dev = routineDeviation(
      [
        { exercise_id: 'bench', target_sets: 3 },
        { exercise_id: 'rows', target_sets: 3 },
      ],
      [
        { exerciseId: 'bench', workingSets: 5 },
        { exerciseId: 'dips', workingSets: 2 },
        { exerciseId: 'rows', workingSets: 0 },
      ],
    );
    expect(dev).toEqual({
      added: ['dips'],
      skipped: ['rows'],
      setCounts: [{ exerciseId: 'bench', from: 3, to: 5, progressionId: null }],
    });
    expect(describeDeviation(dev, names)).toEqual([
      'You added Dips',
      'You did 5 sets of Bench instead of 3',
      'You skipped Rows',
    ]);
  });

  it('a session that matched its routine has nothing to say', () => {
    const dev = routineDeviation(
      [{ exercise_id: 'bench', target_sets: 3 }],
      [{ exerciseId: 'bench', workingSets: 3 }],
    );
    expect(describeDeviation(dev, names)).toEqual([]);
  });

  it('ignores set counts the routine did not set', () => {
    const dev = routineDeviation(
      [{ exercise_id: 'bench', target_sets: null }],
      [{ exerciseId: 'bench', workingSets: 4 }],
    );
    expect(dev.setCounts).toEqual([]);
  });

  // I3: a slot that follows a ladder is the rung it resolved to, not an
  // exercise "you added", and Update must change the ladder slot itself.
  describe('with a ladder slot', () => {
    const ladder = {
      progression: { id: 'pull', current_step_id: 'r-neg' },
      steps: [
        { id: 'r-neg', exercise_id: 'negative' },
        { id: 'r-pull', exercise_id: 'pullup' },
      ],
    };
    const slots = [
      { exercise_id: 'squat', progression_id: null, target_sets: 3 },
      { exercise_id: null, progression_id: 'pull', target_sets: 3 },
    ];

    it('counts the rung trained as the planned slot, not an addition', () => {
      const resolved = resolveRoutineSlots(slots, [ladder], ['squat', 'negative']);
      const dev = routineDeviation(resolved, [
        { exerciseId: 'squat', workingSets: 3 },
        { exerciseId: 'negative', workingSets: 3 },
      ]);
      expect(dev).toEqual({ added: [], skipped: [], setCounts: [] });
    });

    it('a changed set count on the rung points at the ladder slot', () => {
      const resolved = resolveRoutineSlots(slots, [ladder], ['squat', 'negative']);
      const dev = routineDeviation(resolved, [
        { exerciseId: 'squat', workingSets: 3 },
        { exerciseId: 'negative', workingSets: 4 },
      ]);
      expect(dev.setCounts).toEqual([
        { exerciseId: 'negative', from: 3, to: 4, progressionId: 'pull' },
      ]);
      expect(dev.added).toEqual([]);
    });

    it('finds the rung the session trained even after the ladder moved on', () => {
      const movedUp = { ...ladder, progression: { id: 'pull', current_step_id: 'r-pull' } };
      const resolved = resolveRoutineSlots(slots, [movedUp], ['squat', 'negative']);
      expect(resolved[1]).toMatchObject({ exercise_id: 'negative', progression_id: 'pull' });
    });

    it('an untrained ladder slot is its current rung, and is skipped', () => {
      const resolved = resolveRoutineSlots(slots, [ladder], ['squat']);
      const dev = routineDeviation(resolved, [{ exerciseId: 'squat', workingSets: 3 }]);
      expect(dev.skipped).toEqual(['negative']);
    });
  });
});

// I5: Finish is optional, and an unfinished session simply ends at its last
// set (spec §4.4) - its clock must not count up to now for ever.
describe('sessionClockEnd', () => {
  const at = (h: number, m = 0, day = 19) => new Date(2026, 9, day, h, m).getTime();
  const base = { startedAt: at(9), lastSetAt: at(10), date: '2026-10-19' };

  it('a finished session ends when it was finished', () => {
    expect(sessionClockEnd({ ...base, endedAt: at(10, 30), now: at(12) })).toBe(at(10, 30));
  });

  it("today's session still going keeps counting", () => {
    expect(sessionClockEnd({ ...base, endedAt: null, now: at(10, 20) })).toBeNull();
  });

  it("another day's unfinished session ends at its last set", () => {
    expect(
      sessionClockEnd({ ...base, date: '2026-10-13', endedAt: null, now: at(12, 0, 20) }),
    ).toBe(at(10));
  });

  it("today's session left for three hours ends at its last set", () => {
    expect(sessionClockEnd({ ...base, endedAt: null, now: at(13, 1) })).toBe(at(10));
  });

  it('a v2 session with no start or sets has no clock to run', () => {
    expect(
      sessionClockEnd({
        startedAt: null,
        lastSetAt: null,
        date: '2026-10-13',
        endedAt: null,
        now: at(12),
      }),
    ).toBeNull();
  });
});

// A one-sided set is a pair: three lefts and three rights are three sets,
// in the summary, in "Update routine" and in "Save as a routine".
describe('counting one-sided sets in pairs', () => {
  const sided = (side: 'left' | 'right' | null, type: 'normal' | 'warmup' = 'normal') => ({
    set_type: type,
    side,
  });

  it('counts working sets, a left and a right as one', () => {
    expect(workingSetCount([sided('left'), sided('right'), sided('left'), sided('right')])).toBe(2);
    expect(workingSetCount([sided('left'), sided('right'), sided('left')])).toBe(2);
    expect(workingSetCount([sided(null), sided(null), sided(null, 'warmup')])).toBe(2);
  });

  it('three pairs against a routine of 3 is no change', () => {
    const pairs = [1, 2, 3].flatMap(() => [sided('left'), sided('right')]);
    const dev = sessionDeviation(
      [{ exercise_id: 'bss', progression_id: null, target_sets: 3 }],
      [],
      [{ exerciseId: 'bss', sets: pairs }],
    );
    expect(dev).toEqual({ added: [], skipped: [], setCounts: [] });
  });

  it('a routine made from a session sets one-sided targets in pairs', () => {
    const sets = [1, 2, 3].flatMap((n) => [
      { ...s('bss', { reps: 8 + n }), side: 'left' as const },
      { ...s('bss', { reps: 8 + n }), side: 'right' as const },
    ]);
    const [slot] = routineSlotsFromSession([], sets);
    expect(slot).toMatchObject({ exercise_id: 'bss', target_sets: 3, target_reps_min: 9 });
  });
});

// I4: until the routine's slots have loaded (or if that read failed) there is
// nothing to compare with, so nothing to offer - not every exercise as "added".
describe('sessionDeviation before the routine has loaded', () => {
  it('is null, so no update is offered', () => {
    expect(
      sessionDeviation(
        null,
        [],
        [{ exerciseId: 'bench', sets: [{ set_type: 'normal', side: null }] }],
      ),
    ).toBeNull();
  });
});
