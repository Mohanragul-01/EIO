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
