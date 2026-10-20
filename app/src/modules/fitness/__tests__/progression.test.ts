/**
 * Ladders: which rung you are on, which you have mastered, and when you have
 * earned the next one. Moving up is always the person's choice; these rules
 * only decide when to ask.
 */
import type { SetFact } from '../load';
import {
  goalProgress,
  ladderLevel,
  ladderSlotTarget,
  levelUpCandidates,
  meetsGoal,
  neighbours,
  readyToMoveUp,
  rungStates,
  stepLabel,
} from '../progression';
import type { ProgressionMove, ProgressionStep } from '../types';

function step(id: string, position: number, goal: Partial<ProgressionStep> = {}): ProgressionStep {
  return {
    id,
    progression_id: 'p',
    user_id: 'u',
    exercise_id: `ex-${id}`,
    position,
    goal_sets: 3,
    goal_reps: 8,
    goal_seconds: null,
    goal_added_kg: null,
    start_reps: null,
    start_seconds: null,
    cue: '',
    created_at: '',
    ...goal,
  };
}

function move(
  kind: ProgressionMove['kind'],
  from: string | null,
  to: string,
  date: string,
): ProgressionMove {
  return {
    id: `${kind}-${to}-${date}`,
    progression_id: 'p',
    user_id: 'u',
    from_step_id: from,
    to_step_id: to,
    kind,
    date,
    session_id: null,
    note: '',
    created_at: `${date}T10:00:00Z`,
  };
}

let seq = 0;
function set(exercise_id: string, partial: Partial<SetFact>): SetFact {
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
    created_at: '',
    ...partial,
  };
}

const steps = [step('a', 0), step('b', 1), step('c', 2), step('d', 3)];

describe('rungStates', () => {
  it('a fresh ladder with no current rung has everything locked', () => {
    expect(rungStates(steps, null, []).map((r) => r.state)).toEqual([
      'locked',
      'locked',
      'locked',
      'locked',
    ]);
  });

  it('rungs before the current one are mastered, with the date you moved up from them', () => {
    const states = rungStates(steps, 'c', [
      move('start', null, 'a', '2026-08-01'),
      move('up', 'a', 'b', '2026-09-01'),
      move('up', 'b', 'c', '2026-10-01'),
    ]);
    expect(states.map((r) => [r.step.id, r.state, r.masteredOn])).toEqual([
      ['a', 'mastered', '2026-09-01'],
      ['b', 'mastered', '2026-10-01'],
      ['c', 'current', null],
      ['d', 'locked', null],
    ]);
  });

  it('after a step back, the rung you left is locked again', () => {
    const states = rungStates(steps, 'b', [
      move('start', null, 'a', '2026-08-01'),
      move('up', 'a', 'b', '2026-09-01'),
      move('up', 'b', 'c', '2026-10-01'),
      move('back', 'c', 'b', '2026-10-10'),
    ]);
    expect(states.map((r) => r.state)).toEqual(['mastered', 'current', 'locked', 'locked']);
  });

  it('starting partway up counts the rungs below as behind you, without a date', () => {
    const states = rungStates(steps, 'c', [move('start', null, 'c', '2026-08-01')]);
    expect(states.map((r) => [r.state, r.masteredOn])).toEqual([
      ['mastered', null],
      ['mastered', null],
      ['current', null],
      ['locked', null],
    ]);
  });

  it('orders rungs by position, whatever order they arrive in', () => {
    expect(rungStates([steps[2], steps[0], steps[1]], null, []).map((r) => r.step.id)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });
});

describe('meetsGoal', () => {
  const rung = step('b', 1, { goal_sets: 3, goal_reps: 8 });

  it('needs the goal number of sets at the goal reps', () => {
    expect(
      meetsGoal(
        rung,
        [8, 8, 8].map((reps) => set('ex-b', { reps })),
      ),
    ).toBe(true);
    expect(
      meetsGoal(
        rung,
        [8, 8, 7].map((reps) => set('ex-b', { reps })),
      ),
    ).toBe(false);
    expect(
      meetsGoal(
        rung,
        [10, 9, 8, 3].map((reps) => set('ex-b', { reps })),
      ),
    ).toBe(true);
  });

  it('ignores warm-ups, unclean sets, assisted sets and other exercises', () => {
    const sets = [
      set('ex-b', { reps: 8 }),
      set('ex-b', { reps: 8 }),
      set('ex-b', { reps: 8, set_type: 'warmup' }),
      set('ex-b', { reps: 8, clean: false }),
      set('ex-b', { reps: 8, assist_kg: 10 }),
      set('ex-other', { reps: 8 }),
    ];
    expect(meetsGoal(rung, sets)).toBe(false);
  });

  it('holds count seconds', () => {
    const hold = step('h', 0, { goal_reps: null, goal_seconds: 30, goal_sets: 2 });
    expect(
      meetsGoal(
        hold,
        [30, 31].map((s) => set('ex-h', { duration_seconds: s })),
      ),
    ).toBe(true);
    expect(
      meetsGoal(
        hold,
        [30, 29].map((s) => set('ex-h', { duration_seconds: s })),
      ),
    ).toBe(false);
  });

  it('a weighted goal needs the added weight too', () => {
    const weighted = step('w', 0, { goal_sets: 1, goal_reps: 5, goal_added_kg: 10 });
    expect(meetsGoal(weighted, [set('ex-w', { reps: 5, weight_kg: 10 })])).toBe(true);
    expect(meetsGoal(weighted, [set('ex-w', { reps: 5, weight_kg: 7.5 })])).toBe(false);
  });
});

describe('readyToMoveUp', () => {
  const rung = step('b', 1, { goal_sets: 1, goal_reps: 8 });
  const good = [set('ex-b', { reps: 8 })];
  const bad = [set('ex-b', { reps: 6 })];

  it('two of the last three sessions on the rung, by default', () => {
    expect(readyToMoveUp(rung, [good, bad, good], 'two_of_three')).toBe(true);
    expect(readyToMoveUp(rung, [good, bad, bad], 'two_of_three')).toBe(false);
    // Only the newest three count.
    expect(readyToMoveUp(rung, [good, bad, bad, good, good], 'two_of_three')).toBe(false);
  });

  it('one session is enough when the ladder says so', () => {
    expect(readyToMoveUp(rung, [good], 'one')).toBe(true);
    expect(readyToMoveUp(rung, [bad, good], 'one')).toBe(false);
  });

  it('sessions that did not train the rung do not count either way', () => {
    const other = [set('ex-other', { reps: 20 })];
    expect(readyToMoveUp(rung, [other, good, other, good], 'two_of_three')).toBe(true);
  });

  it('a single good session is not enough for two of three', () => {
    expect(readyToMoveUp(rung, [good], 'two_of_three')).toBe(false);
  });
});

describe('goalProgress', () => {
  const rung = step('b', 1, { goal_sets: 3, goal_reps: 8 });

  it('is the average share of the goal across the best goal-number of sets', () => {
    expect(
      goalProgress(
        rung,
        [8, 8, 8].map((reps) => set('ex-b', { reps })),
      ),
    ).toBe(1);
    expect(
      goalProgress(
        rung,
        [8, 6, 4].map((reps) => set('ex-b', { reps })),
      ),
    ).toBeCloseTo(0.75);
    expect(
      goalProgress(
        rung,
        [8].map((reps) => set('ex-b', { reps })),
      ),
    ).toBeCloseTo(1 / 3);
  });

  it('caps each set at the goal, so one huge set cannot fill the ring', () => {
    expect(
      goalProgress(
        rung,
        [30].map((reps) => set('ex-b', { reps })),
      ),
    ).toBeCloseTo(1 / 3);
  });

  it('is 0 with nothing logged', () => {
    expect(goalProgress(rung, [])).toBe(0);
  });
});

describe('labels and neighbours', () => {
  it('says where you are', () => {
    expect(stepLabel(4, 7, 'Advanced tuck')).toBe('Step 4/7 · Advanced tuck');
  });

  it('finds the rungs either side', () => {
    expect(neighbours(steps, 'b')).toEqual({ previous: steps[0], next: steps[2] });
    expect(neighbours(steps, 'a').previous).toBeNull();
    expect(neighbours(steps, 'd').next).toBeNull();
    expect(neighbours(steps, null)).toEqual({ previous: null, next: steps[0] });
  });
});

describe('levelUpCandidates', () => {
  const ladder = (current: string | null, paused = false) => ({
    progression: {
      id: 'p',
      user_id: 'u',
      name: 'Pull-up',
      family: 'pull' as const,
      current_step_id: current,
      position: 0,
      level_up_rule: 'one' as const,
      paused_at: paused ? '2026-10-01T00:00:00Z' : null,
      notes: '',
      created_at: '',
      updated_at: '',
    },
    steps: [step('a', 0, { goal_sets: 1, goal_reps: 8 }), step('b', 1)],
    moves: [],
  });
  const met = [set('ex-a', { reps: 8 })];

  it('offers the next rung when this session met the current one', () => {
    expect(levelUpCandidates([ladder('a')], met, {})).toEqual([
      {
        progressionId: 'p',
        name: 'Pull-up',
        from: expect.objectContaining({ id: 'a' }),
        to: expect.objectContaining({ id: 'b' }),
      },
    ]);
  });

  it('says nothing when the rung was not trained today', () => {
    expect(levelUpCandidates([ladder('a')], [set('ex-other', { reps: 20 })], {})).toEqual([]);
  });

  it('says nothing on the top rung, or on a paused ladder', () => {
    expect(
      levelUpCandidates(
        [ladder('b')],
        [set('ex-b', { reps: 20 }), set('ex-b', { reps: 20 }), set('ex-b', { reps: 20 })],
        {},
      ),
    ).toEqual([]);
    expect(levelUpCandidates([ladder('a', true)], met, {})).toEqual([]);
  });

  it('counts earlier sessions for two-of-three', () => {
    const strict = {
      ...ladder('a'),
      progression: { ...ladder('a').progression, level_up_rule: 'two_of_three' as const },
    };
    expect(levelUpCandidates([strict], met, {})).toEqual([]);
    expect(levelUpCandidates([strict], met, { 'ex-a': [met] })).toHaveLength(1);
  });
});

describe('ladderSlotTarget', () => {
  it('a ladder slot aims for the rung: restart point up to the goal', () => {
    expect(ladderSlotTarget(step('a', 0, { goal_sets: 3, goal_reps: 8, start_reps: 5 }))).toEqual({
      target_sets: 3,
      target_reps_min: 5,
      target_reps: 8,
      target_seconds_min: null,
      target_seconds_max: null,
    });
  });

  it('holds aim in seconds', () => {
    expect(
      ladderSlotTarget(
        step('h', 0, { goal_sets: 3, goal_reps: null, goal_seconds: 30, start_seconds: 10 }),
      ),
    ).toMatchObject({ target_seconds_min: 10, target_seconds_max: 30, target_reps: null });
  });
});

// I9: the session block of a ladder exercise shows where it stands on its
// ladder ("Front lever · 2/4") and steps to the rung either side.
describe('ladderLevel', () => {
  const ladder = (id: string, name: string, current: string | null, ids: string[]) => ({
    progression: {
      id,
      user_id: 'u',
      name,
      family: 'statics' as const,
      current_step_id: current,
      position: 0,
      level_up_rule: 'two_of_three' as const,
      paused_at: null,
      notes: '',
      created_at: '',
      updated_at: '',
    },
    steps: ids.map((sid, i) => ({ ...step(sid, i), progression_id: id })),
    moves: [],
  });
  const lever = ladder('lever', 'Front lever', 'b', ['a', 'b', 'c', 'd']);

  it("gives the rung's place and its neighbours", () => {
    expect(ladderLevel([lever], 'ex-b')).toMatchObject({
      progressionId: 'lever',
      name: 'Front lever',
      number: 2,
      total: 4,
      previous: { id: 'a' },
      next: { id: 'c' },
    });
  });

  it('works for a rung that is not the current one', () => {
    expect(ladderLevel([lever], 'ex-d')).toMatchObject({ number: 4, next: null });
  });

  it('prefers the ladder this exercise is the current rung of', () => {
    const other = ladder('other', 'Other', 'x', ['b2', 'x']);
    other.steps[1] = { ...other.steps[1], exercise_id: 'ex-b' };
    const movedOn = ladder('lever', 'Front lever', 'c', ['a', 'b', 'c', 'd']);
    expect(ladderLevel([movedOn, other], 'ex-b')?.progressionId).toBe('other');
  });

  it('is null for an exercise on no ladder', () => {
    expect(ladderLevel([lever], 'squat')).toBeNull();
  });
});
