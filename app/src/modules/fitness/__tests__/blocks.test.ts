/**
 * How a session's screen is put together from what is stored.
 *
 * The bug this replaces: a session's exercise list lived only in screen state
 * and was rebuilt from the sets logged, so an exercise added but not yet
 * logged vanished when the session was reopened. Blocks now come from
 * session_exercises - and a set that v2 logged without one still shows, so
 * nothing already recorded can go missing.
 */
import { assembleBlocks, initialDrafts, type DraftRow } from '../blocks';
import type { SetFact } from '../load';
import { matchPrevious } from '../previous';
import type { SessionExercise, SessionSet, SetType } from '../types';

function se(exercise_id: string, position: number): SessionExercise {
  return {
    id: `se-${exercise_id}`,
    session_id: 'today',
    exercise_id,
    user_id: 'u',
    position,
    rest_seconds: null,
    note: '',
    superset_group: null,
    created_at: '2026-10-19T10:00:00Z',
  };
}

let seq = 0;
function saved(exercise_id: string, set_number: number, extra: Partial<SessionSet> = {}): SessionSet {
  seq += 1;
  return {
    id: `set${seq}`,
    session_id: 'today',
    exercise_id,
    user_id: 'u',
    set_number,
    reps: 8,
    duration_seconds: null,
    weight_kg: 60,
    rpe: null,
    set_type: 'normal',
    assist_kg: null,
    band_id: null,
    side: null,
    clean: true,
    created_at: `2026-10-19T10:${String(seq).padStart(2, '0')}:00Z`,
    ...extra,
  };
}

function prev(set_type: SetType, reps: number, weight_kg = 60): SetFact {
  seq += 1;
  return {
    id: `p${seq}`,
    exercise_id: 'bench',
    session_id: 'last',
    set_type,
    reps,
    duration_seconds: null,
    weight_kg,
    assist_kg: null,
    clean: true,
    created_at: '2026-10-12T10:00:00Z',
  };
}

describe('assembleBlocks', () => {
  it('orders blocks by position, each with its sets in set order', () => {
    const blocks = assembleBlocks(
      [se('squat', 1), se('bench', 0)],
      [saved('squat', 2), saved('bench', 1), saved('squat', 1)],
    );
    expect(blocks.map((b) => b.exerciseId)).toEqual(['bench', 'squat']);
    expect(blocks[1].sets.map((s) => s.set_number)).toEqual([1, 2]);
  });

  it('keeps an exercise that was added but not logged (the reopen bug)', () => {
    const blocks = assembleBlocks([se('bench', 0), se('dips', 1)], [saved('bench', 1)]);
    expect(blocks.map((b) => b.exerciseId)).toEqual(['bench', 'dips']);
    expect(blocks[1].sets).toEqual([]);
  });

  it('still shows sets that v2 logged with no block row, after the others, in logged order', () => {
    const blocks = assembleBlocks(
      [se('bench', 0)],
      [saved('rows', 1), saved('bench', 1), saved('curl', 1)],
    );
    expect(blocks.map((b) => b.exerciseId)).toEqual(['bench', 'rows', 'curl']);
    expect(blocks[1].sessionExercise).toBeNull();
  });
});

describe('initialDrafts', () => {
  const ids = (drafts: DraftRow[]) => drafts.map((d) => d.set_type);

  it('fills up to the routine target, less what is already saved', () => {
    const drafts = initialDrafts({
      blockKey: 'bench',
      savedSets: [saved('bench', 1)],
      routineTargetSets: 3,
      previousSets: [],
    });
    expect(ids(drafts)).toEqual(['normal', 'normal']);
  });

  it('without a routine, mirrors last time, warm-ups included', () => {
    const drafts = initialDrafts({
      blockKey: 'bench',
      savedSets: [],
      routineTargetSets: null,
      previousSets: [prev('warmup', 10, 40), prev('normal', 8), prev('normal', 8), prev('failure', 5)],
    });
    expect(ids(drafts)).toEqual(['warmup', 'normal', 'normal', 'failure']);
  });

  it('a brand-new exercise gets one row to fill in', () => {
    expect(ids(initialDrafts({ blockKey: 'x', savedSets: [], routineTargetSets: null, previousSets: [] }))).toEqual([
      'normal',
    ]);
  });

  it('a finished block gets no extra rows', () => {
    expect(
      initialDrafts({
        blockKey: 'bench',
        savedSets: [saved('bench', 1), saved('bench', 2)],
        routineTargetSets: 2,
        previousSets: [],
      }),
    ).toEqual([]);
  });

  it('gives every draft a unique key', () => {
    const drafts = initialDrafts({ blockKey: 'b', savedSets: [], routineTargetSets: 4, previousSets: [] });
    expect(new Set(drafts.map((d) => d.key)).size).toBe(4);
  });
});

describe('matchPrevious', () => {
  const last = [prev('warmup', 10, 40), prev('normal', 8, 60), prev('normal', 7, 60), prev('drop', 12, 40)];

  it('matches the nth working set with last time\'s nth working set', () => {
    expect(matchPrevious(last, ['warmup', 'normal', 'normal'], 2)?.reps).toBe(7);
  });

  it('matches warm-ups with warm-ups', () => {
    expect(matchPrevious(last, ['warmup', 'normal'], 0)?.weight_kg).toBe(40);
  });

  it('is null past the end of last time', () => {
    expect(matchPrevious(last, ['normal', 'normal', 'normal', 'normal'], 3)).toBeNull();
  });

  it('counts drop and failure sets as working sets', () => {
    expect(matchPrevious(last, ['normal', 'normal', 'drop'], 2)?.reps).toBe(12);
  });
});
