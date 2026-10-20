/**
 * useWorkoutSession: the session screen's hook, against a mocked api.ts.
 *
 * The rules themselves (rows, drafts, records, targets) are tested in their
 * pure files. What is pinned here is how the hook connects them: what it
 * reloads, what it refetches when the date changes, and what an Undo does
 * after a write that failed.
 *
 * Only Date is faked (Monday 19 Oct 2026, noon): the hook's promises and the
 * testing library's waitFor need real timers.
 */
import { act, renderHook, waitFor } from '@testing-library/react-native';

import type { Exercise, SessionExercise, SessionSet, WorkoutSession } from '../types';
import { useWorkoutSession } from '../useWorkoutSession';

jest.mock('../api', () => ({
  getSession: jest.fn(),
  listSessionExercises: jest.fn(),
  listSessionSets: jest.fn(),
  listExercises: jest.fn(),
  listBands: jest.fn(() => Promise.resolve([])),
  listBaseline: jest.fn(() => Promise.resolve({})),
  listPreviousSets: jest.fn(() => Promise.resolve({})),
  listRoutineExercises: jest.fn(() => Promise.resolve([])),
  listLadders: jest.fn(() => Promise.resolve([])),
  addSessionExercise: jest.fn(),
  addSet: jest.fn(),
  deleteSet: jest.fn(() => Promise.resolve()),
  updateSession: jest.fn(() => Promise.resolve()),
  bodyweightOn: jest.fn(() => Promise.resolve(null)),
  finishSession: jest.fn(),
  reopenSession: jest.fn(() => Promise.resolve()),
  updateSessionExercise: jest.fn(() => Promise.resolve()),
}));

const api = jest.requireMock('../api') as Record<string, jest.Mock>;

const session: WorkoutSession = {
  id: 'w1',
  user_id: 'u',
  date: '2026-10-19',
  routine_id: null,
  notes: '',
  mode: 'calisthenics',
  started_at: '2026-10-19T10:00:00.000Z',
  ended_at: null,
  bodyweight_kg: 80,
  created_at: '2026-10-19T10:00:00.000Z',
  updated_at: '2026-10-19T10:00:00.000Z',
};

const pullUp: Exercise = {
  id: 'pull',
  user_id: 'u',
  name: 'Pull-up',
  muscle_group: 'Back',
  tracking_type: 'reps',
  discipline: 'both',
  load_mode: 'bodyweight',
  bodyweight_factor: 1,
  equipment: 'pull_up_bar',
  is_unilateral: false,
  default_rest_seconds: null,
  pinned_note: '',
  instructions: '',
  created_at: '2026-01-01T00:00:00Z',
};

const block: SessionExercise = {
  id: 'b1',
  session_id: 'w1',
  exercise_id: 'pull',
  user_id: 'u',
  position: 0,
  rest_seconds: null,
  note: '',
  superset_group: null,
  created_at: '2026-10-19T10:00:00.000Z',
};

function set(id: string, extra: Partial<SessionSet> = {}): SessionSet {
  return {
    id,
    session_id: 'w1',
    exercise_id: 'pull',
    user_id: 'u',
    set_number: 1,
    reps: 8,
    duration_seconds: null,
    weight_kg: 0,
    rpe: null,
    set_type: 'normal',
    assist_kg: null,
    band_id: null,
    side: null,
    clean: true,
    created_at: '2026-10-19T10:05:00.000Z',
    ...extra,
  };
}

beforeEach(() => {
  jest.useFakeTimers({
    now: new Date(2026, 9, 19, 12, 0),
    doNotFake: [
      'setTimeout',
      'clearTimeout',
      'setInterval',
      'clearInterval',
      'setImmediate',
      'clearImmediate',
      'nextTick',
      'queueMicrotask',
      'requestAnimationFrame',
      'cancelAnimationFrame',
    ],
  });
  jest.clearAllMocks();
  api.getSession.mockResolvedValue(session);
  api.listSessionExercises.mockResolvedValue([block]);
  api.listSessionSets.mockResolvedValue([]);
  api.listExercises.mockResolvedValue([pullUp]);
});

afterEach(() => {
  jest.useRealTimers();
});

async function opened() {
  const hook = await renderHook(() => useWorkoutSession('w1'));
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook;
}

describe('reopening from the summary', () => {
  it('refreshSession picks up an end time cleared elsewhere, keeping typed rows', async () => {
    api.getSession.mockResolvedValue({ ...session, ended_at: '2026-10-19T11:00:00.000Z' });
    const { result } = await opened();
    expect(result.current.session?.ended_at).not.toBeNull();
    const key = result.current.blocks[0].rows[0].key;
    await act(async () => result.current.updateDraft('b1', key, { reps: '9' }));

    // The summary screen reopened the session.
    api.getSession.mockResolvedValue(session);
    await act(async () => {
      await result.current.refreshSession();
    });

    expect(result.current.session?.ended_at).toBeNull();
    const row = result.current.blocks[0].rows[0];
    expect(row.kind === 'draft' && row.draft.reps).toBe('9');
  });
});

describe('adding rows', () => {
  it('warm-ups on a one-sided exercise come out L1 R1 L2 R2 L3 R3, before the work', async () => {
    api.listExercises.mockResolvedValue([{ ...pullUp, is_unilateral: true }]);
    const { result } = await opened();

    await act(async () =>
      result.current.addRows('b1', 'warmup', 0, [{ reps: '8' }, { reps: '5' }, { reps: '3' }]),
    );

    const rows = result.current.blocks[0].rows.flatMap((r) =>
      r.kind === 'draft'
        ? [
            `${r.draft.set_type === 'warmup' ? r.draft.reps : 'work'}${r.draft.side === 'left' ? 'L' : 'R'}`,
          ]
        : [],
    );
    expect(rows).toEqual(['8L', '8R', '5L', '5R', '3L', '3R', 'workL', 'workR']);
  });
});

describe('finishing', () => {
  it("an old session's Finish stamps its last set, not now", async () => {
    api.getSession.mockResolvedValue({ ...session, date: '2026-10-13', started_at: null });
    api.listSessionSets.mockResolvedValue([
      set('s1', { created_at: '2026-10-13T10:05:00.000Z' }),
      set('s2', { set_number: 2, created_at: '2026-10-13T10:09:00.000Z' }),
    ]);
    api.finishSession.mockImplementation((id: string, at: string) =>
      Promise.resolve({ ...session, id, ended_at: at }),
    );
    const { result } = await opened();

    await act(async () => {
      await result.current.finish();
    });
    expect(api.finishSession).toHaveBeenCalledWith('w1', '2026-10-13T10:09:00.000Z');
  });

  it("today's session in progress finishes now", async () => {
    // Started half an hour ago (noon in New York is 16:00 UTC).
    api.getSession.mockResolvedValue({ ...session, started_at: '2026-10-19T15:30:00.000Z' });
    api.finishSession.mockResolvedValue({ ...session, ended_at: '2026-10-19T12:00:00.000Z' });
    const { result } = await opened();
    await act(async () => {
      await result.current.finish();
    });
    expect(api.finishSession).toHaveBeenCalledWith('w1', undefined);
  });
});

describe('changing the date', () => {
  const fact = (reps: number) => ({ ...set(`f${reps}`, { reps }), session_id: 'other' });
  const tuesday = { date: '2026-10-13', sets: [fact(9)] };
  const sunday = { date: '2026-10-11', sets: [fact(7)] };
  const previousReps = (current: ReturnType<typeof useWorkoutSession>) =>
    current.previousFor(current.blocks[0], 0)?.reps;

  it("compares with the session before the new day, at that day's weigh-in", async () => {
    api.listPreviousSets.mockImplementation((_ids: string[], _id: string, onOrBefore: string) =>
      Promise.resolve({ pull: onOrBefore >= '2026-10-13' ? tuesday : sunday }),
    );
    api.bodyweightOn.mockImplementation((date: string) =>
      Promise.resolve(date >= '2026-10-15' ? 80 : 78),
    );
    const { result } = await opened();
    expect(previousReps(result.current)).toBe(9);

    await act(async () => {
      await result.current.setDate('2026-10-12');
    });

    expect(api.listPreviousSets).toHaveBeenLastCalledWith(['pull'], 'w1', '2026-10-12');
    expect(previousReps(result.current)).toBe(7);
    expect(api.updateSession).toHaveBeenCalledWith('w1', {
      date: '2026-10-12',
      bodyweight_kg: 78,
    });
    expect(result.current.session).toMatchObject({ date: '2026-10-12', bodyweight_kg: 78 });
  });

  it('refuses a day in the future', async () => {
    const { result } = await opened();
    await act(async () => {
      await result.current.setDate('2026-10-20');
    });
    expect(api.updateSession).not.toHaveBeenCalled();
    expect(result.current.session?.date).toBe('2026-10-19');
  });

  it('puts the old date back if the change cannot be saved', async () => {
    api.updateSession.mockRejectedValueOnce(new Error('offline'));
    const { result } = await opened();
    await act(async () => {
      await result.current.setDate('2026-10-12');
    });
    expect(result.current.session?.date).toBe('2026-10-19');
    expect(result.current.error).toBe('offline');
  });
});

describe('reopening a routine session', () => {
  it('keeps the working sets still to do after warm-ups were ticked', async () => {
    api.getSession.mockResolvedValue({ ...session, routine_id: 'r1' });
    api.listRoutineExercises.mockResolvedValue([
      {
        id: 'slot',
        routine_id: 'r1',
        exercise_id: 'pull',
        progression_id: null,
        user_id: 'u',
        position: 0,
        target_sets: 3,
        target_reps: 8,
        target_reps_min: null,
        target_seconds_min: null,
        target_seconds_max: null,
        rest_seconds: null,
        pair_group: null,
        increment_kg: null,
      },
    ]);
    api.listSessionSets.mockResolvedValue([
      set('w1', { set_number: 1, set_type: 'warmup' }),
      set('w2', { set_number: 2, set_type: 'warmup' }),
      set('w3', { set_number: 3, set_type: 'warmup' }),
      set('n1', { set_number: 4 }),
    ]);
    const { result } = await opened();
    expect(result.current.blocks[0].rows.map((r) => r.kind)).toEqual([
      'saved',
      'saved',
      'saved',
      'saved',
      'draft',
      'draft',
    ]);
  });
});

describe('removing a saved set', () => {
  it('Undo after a delete that failed does not write the set a second time', async () => {
    api.listSessionSets.mockResolvedValue([set('s1')]);
    api.deleteSet.mockRejectedValueOnce(new Error('offline'));
    const { result } = await opened();

    let undo: (() => void) | null = null;
    await act(async () => {
      undo = result.current.removeRow('b1', 's1');
    });
    await act(async () => {
      undo?.();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(api.addSet).not.toHaveBeenCalled();
  });

  it('Undo after a delete that worked writes the set back', async () => {
    api.listSessionSets.mockResolvedValue([set('s1')]);
    api.addSet.mockResolvedValue(set('s1-again'));
    const { result } = await opened();

    let undo: (() => void) | null = null;
    await act(async () => {
      undo = result.current.removeRow('b1', 's1');
    });
    await act(async () => {
      undo?.();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(api.addSet).toHaveBeenCalledTimes(1);
    expect(result.current.blocks[0].rows[0]).toMatchObject({ kind: 'saved', key: 's1-again' });
  });
});

describe('the ladder level of a block', () => {
  const step = (id: string, exercise_id: string, position: number) => ({
    id,
    progression_id: 'lad',
    user_id: 'u',
    exercise_id,
    position,
    goal_sets: 3,
    goal_reps: 8,
    goal_seconds: null,
    goal_added_kg: null,
    start_reps: 5,
    start_seconds: null,
    cue: '',
    created_at: '',
  });
  const ladder = {
    progression: {
      id: 'lad',
      user_id: 'u',
      name: 'Pull-up ladder',
      family: 'pull',
      current_step_id: 'r1',
      position: 0,
      level_up_rule: 'two_of_three',
      paused_at: null,
      notes: '',
      created_at: '',
      updated_at: '',
    },
    steps: [step('r1', 'pull', 0), step('r2', 'archer', 1)],
    moves: [],
  };

  it("says where the block's exercise stands, and steps to the next rung", async () => {
    api.listLadders.mockResolvedValue([ladder]);
    api.listExercises.mockResolvedValue([pullUp, { ...pullUp, id: 'archer', name: 'Archer' }]);
    const { result } = await opened();
    expect(result.current.levelFor(result.current.blocks[0])).toMatchObject({
      name: 'Pull-up ladder',
      number: 1,
      total: 2,
    });

    await act(async () => {
      await result.current.stepLevel('b1', 1);
    });

    expect(api.updateSessionExercise).toHaveBeenCalledWith('b1', { exercise_id: 'archer' });
    expect(result.current.blocks[0].exerciseId).toBe('archer');
    expect(result.current.levelFor(result.current.blocks[0])).toMatchObject({ number: 2 });
  });
});
