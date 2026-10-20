/**
 * A ladder's history: where you stood on it over time, your best recent
 * attempt at a rung, and the latest moves up across every ladder.
 */
import type { SetFact } from '../load';
import { bestAttempt, ladderPositions, moveTimeline } from '../ladderHistory';
import type { Progression, ProgressionMove, ProgressionStep } from '../types';

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
  time = '10:00:00',
  progression_id = 'p',
): ProgressionMove {
  return {
    id: `${progression_id}-${kind}-${to}-${date}-${time}`,
    progression_id,
    user_id: 'u',
    from_step_id: from,
    to_step_id: to,
    kind,
    date,
    session_id: null,
    note: '',
    created_at: `${date}T${time}Z`,
  };
}

let seq = 0;
function set(exercise_id: string, partial: Partial<SetFact>): SetFact {
  seq += 1;
  return {
    id: `set${seq}`,
    exercise_id,
    session_id: 'sess',
    set_type: 'normal',
    reps: null,
    duration_seconds: null,
    weight_kg: 0,
    assist_kg: null,
    clean: true,
    created_at: `2026-10-01T10:00:${String(seq % 60).padStart(2, '0')}Z`,
    ...partial,
  };
}

const steps = [step('c', 2), step('a', 0), step('b', 1)];

describe('ladderPositions', () => {
  it('follows the moves in order, numbering rungs by position', () => {
    expect(
      ladderPositions(steps, [
        move('up', 'b', 'c', '2026-09-20'),
        move('start', null, 'a', '2026-08-01'),
        move('up', 'a', 'b', '2026-08-30'),
      ]),
    ).toEqual([
      { date: '2026-08-01', number: 1 },
      { date: '2026-08-30', number: 2 },
      { date: '2026-09-20', number: 3 },
    ]);
  });

  it('keeps one point per day, the last move that day', () => {
    expect(
      ladderPositions(steps, [
        move('start', null, 'a', '2026-08-01', '09:00:00'),
        move('up', 'a', 'b', '2026-08-01', '10:00:00'),
        move('back', 'b', 'a', '2026-08-03'),
      ]),
    ).toEqual([
      { date: '2026-08-01', number: 2 },
      { date: '2026-08-03', number: 1 },
    ]);
  });

  it('skips moves to a rung that has since been removed', () => {
    expect(
      ladderPositions(steps, [
        move('start', null, 'gone', '2026-08-01'),
        move('up', 'gone', 'b', '2026-08-02'),
      ]),
    ).toEqual([{ date: '2026-08-02', number: 2 }]);
  });

  it('is empty with no moves', () => {
    expect(ladderPositions(steps, [])).toEqual([]);
  });
});

describe('bestAttempt', () => {
  const rung = step('a', 0, { goal_sets: 3, goal_reps: 8 });

  it('lists the top sets of the session that came closest to the goal', () => {
    const weaker = [set('ex-a', { reps: 5 }), set('ex-a', { reps: 5 }), set('ex-a', { reps: 4 })];
    const stronger = [
      set('ex-a', { reps: 6 }),
      set('ex-a', { reps: 8 }),
      set('ex-a', { reps: 7 }),
      set('ex-a', { reps: 3 }),
    ];
    expect(bestAttempt(rung, [weaker, stronger])).toBe('8 · 7 · 6');
  });

  it('leaves out warm-ups and other exercises', () => {
    const sets = [
      set('ex-a', { reps: 12, set_type: 'warmup' }),
      set('ex-b', { reps: 20 }),
      set('ex-a', { reps: 6 }),
    ];
    expect(bestAttempt(rung, [sets])).toBe('6');
  });

  it('writes holds in seconds', () => {
    const hold = step('h', 0, { goal_sets: 2, goal_reps: null, goal_seconds: 30 });
    const sets = [set('ex-h', { duration_seconds: 25 }), set('ex-h', { duration_seconds: 20 })];
    expect(bestAttempt(hold, [sets])).toBe('25s · 20s');
  });

  it('is null with nothing on the rung', () => {
    expect(bestAttempt(rung, [])).toBeNull();
    expect(bestAttempt(rung, [[set('ex-b', { reps: 5 })]])).toBeNull();
  });
});

describe('moveTimeline', () => {
  const progression = (id: string, name: string): Progression => ({
    id,
    user_id: 'u',
    name,
    family: 'pull',
    current_step_id: null,
    position: 0,
    level_up_rule: 'two_of_three',
    paused_at: null,
    notes: '',
    created_at: '',
    updated_at: '',
  });

  const ladders = [
    {
      progression: progression('p', 'Pull-up'),
      steps,
      moves: [
        move('start', null, 'a', '2026-08-01'),
        move('up', 'a', 'b', '2026-08-30'),
        move('back', 'b', 'a', '2026-09-02'),
        move('up', 'a', 'b', '2026-09-10'),
      ],
    },
    {
      progression: progression('q', 'Front lever'),
      steps: [step('x', 0), step('y', 1)],
      moves: [move('up', 'x', 'y', '2026-09-05', '10:00:00', 'q')],
    },
  ];

  it('lists moves up across ladders, newest first, with their rungs', () => {
    expect(moveTimeline(ladders)).toEqual([
      {
        id: 'p-up-b-2026-09-10-10:00:00',
        progressionId: 'p',
        date: '2026-09-10',
        kind: 'up',
        fromExerciseId: 'ex-a',
        toExerciseId: 'ex-b',
      },
      {
        id: 'q-up-y-2026-09-05-10:00:00',
        progressionId: 'q',
        date: '2026-09-05',
        kind: 'up',
        fromExerciseId: 'ex-x',
        toExerciseId: 'ex-y',
      },
      {
        id: 'p-up-b-2026-08-30-10:00:00',
        progressionId: 'p',
        date: '2026-08-30',
        kind: 'up',
        fromExerciseId: 'ex-a',
        toExerciseId: 'ex-b',
      },
    ]);
  });

  it('can include every kind of move, and stops at the limit', () => {
    const all = moveTimeline(ladders, { kinds: ['start', 'up', 'back'], limit: 2 });
    expect(all.map((e) => [e.date, e.kind])).toEqual([
      ['2026-09-10', 'up'],
      ['2026-09-05', 'up'],
    ]);
    expect(moveTimeline(ladders, { kinds: ['back'] }).map((e) => e.date)).toEqual(['2026-09-02']);
  });

  it('names a removed rung as null rather than guessing', () => {
    const removed = [{ ...ladders[0], moves: [move('up', 'gone', 'b', '2026-09-01')] }];
    expect(moveTimeline(removed)[0]).toMatchObject({ fromExerciseId: null, toExerciseId: 'ex-b' });
  });
});
