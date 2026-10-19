/**
 * Ladders: which rung you are on, which you have mastered, and when you have
 * earned the next one. Moving up is always the person's choice; these rules
 * only decide when to ask.
 */
import type { SetFact } from '../load';
import {
  goalProgress,
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

function move(kind: ProgressionMove['kind'], from: string | null, to: string, date: string): ProgressionMove {
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
    expect(rungStates(steps, null, []).map((r) => r.state)).toEqual(['locked', 'locked', 'locked', 'locked']);
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
    expect(rungStates([steps[2], steps[0], steps[1]], null, []).map((r) => r.step.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('meetsGoal', () => {
  const rung = step('b', 1, { goal_sets: 3, goal_reps: 8 });

  it('needs the goal number of sets at the goal reps', () => {
    expect(meetsGoal(rung, [8, 8, 8].map((reps) => set('ex-b', { reps })))).toBe(true);
    expect(meetsGoal(rung, [8, 8, 7].map((reps) => set('ex-b', { reps })))).toBe(false);
    expect(meetsGoal(rung, [10, 9, 8, 3].map((reps) => set('ex-b', { reps })))).toBe(true);
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
    expect(meetsGoal(hold, [30, 31].map((s) => set('ex-h', { duration_seconds: s })))).toBe(true);
    expect(meetsGoal(hold, [30, 29].map((s) => set('ex-h', { duration_seconds: s })))).toBe(false);
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
    expect(goalProgress(rung, [8, 8, 8].map((reps) => set('ex-b', { reps })))).toBe(1);
    expect(goalProgress(rung, [8, 6, 4].map((reps) => set('ex-b', { reps })))).toBeCloseTo(0.75);
    expect(goalProgress(rung, [8].map((reps) => set('ex-b', { reps })))).toBeCloseTo(1 / 3);
  });

  it('caps each set at the goal, so one huge set cannot fill the ring', () => {
    expect(goalProgress(rung, [30].map((reps) => set('ex-b', { reps })))).toBeCloseTo(1 / 3);
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
