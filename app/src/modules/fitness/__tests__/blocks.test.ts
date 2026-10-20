/**
 * How a session's screen is put together from what is stored.
 *
 * The bug this replaces: a session's exercise list lived only in screen state
 * and was rebuilt from the sets logged, so an exercise added but not yet
 * logged vanished when the session was reopened. Blocks now come from
 * session_exercises - and a set that v2 logged without one still shows, so
 * nothing already recorded can go missing.
 */
import {
  assembleBlocks,
  buildBlock,
  initialDrafts,
  newDrafts,
  supersetLabels,
  supersetNext,
  type DraftRow,
} from '../blocks';
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
function saved(
  exercise_id: string,
  set_number: number,
  extra: Partial<SessionSet> = {},
): SessionSet {
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
      previousSets: [
        prev('warmup', 10, 40),
        prev('normal', 8),
        prev('normal', 8),
        prev('failure', 5),
      ],
    });
    expect(ids(drafts)).toEqual(['warmup', 'normal', 'normal', 'failure']);
  });

  it('a brand-new exercise gets one row to fill in', () => {
    expect(
      ids(
        initialDrafts({ blockKey: 'x', savedSets: [], routineTargetSets: null, previousSets: [] }),
      ),
    ).toEqual(['normal']);
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

  // I8: warm-ups are not the routine's sets. Ticking three warm-ups and one
  // working set, leaving and coming back, must still leave two to do.
  it('saved warm-ups do not use up the routine target', () => {
    const drafts = initialDrafts({
      blockKey: 'squat',
      savedSets: [
        saved('squat', 1, { set_type: 'warmup' }),
        saved('squat', 2, { set_type: 'warmup' }),
        saved('squat', 3, { set_type: 'warmup' }),
        saved('squat', 4),
      ],
      routineTargetSets: 3,
      previousSets: [],
    });
    expect(ids(drafts)).toEqual(['normal', 'normal']);
  });

  it('warm-ups alone leave every working set of a new exercise to do', () => {
    const drafts = initialDrafts({
      blockKey: 'x',
      savedSets: [saved('x', 1, { set_type: 'warmup' })],
      routineTargetSets: null,
      previousSets: [],
    });
    expect(ids(drafts)).toEqual(['normal']);
  });

  it("matches last time's structure kind by kind, and drops warm-ups once work has begun", () => {
    const last = [prev('warmup', 10, 40), prev('normal', 8), prev('normal', 8)];
    expect(
      ids(
        initialDrafts({
          blockKey: 'bench',
          savedSets: [saved('bench', 1, { set_type: 'warmup' })],
          routineTargetSets: null,
          previousSets: last,
        }),
      ),
    ).toEqual(['normal', 'normal']);
    expect(
      ids(
        initialDrafts({
          blockKey: 'bench',
          savedSets: [saved('bench', 1)],
          routineTargetSets: null,
          previousSets: last,
        }),
      ),
    ).toEqual(['normal']);
  });

  it('gives every draft a unique key', () => {
    const drafts = initialDrafts({
      blockKey: 'b',
      savedSets: [],
      routineTargetSets: 4,
      previousSets: [],
    });
    expect(new Set(drafts.map((d) => d.key)).size).toBe(4);
  });
});

describe('matchPrevious', () => {
  const last = [
    prev('warmup', 10, 40),
    prev('normal', 8, 60),
    prev('normal', 7, 60),
    prev('drop', 12, 40),
  ];

  it("matches the nth working set with last time's nth working set", () => {
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

describe('newDrafts', () => {
  const warmups = [
    { weight: '40', reps: '8' },
    { weight: '60', reps: '5' },
    { weight: '80', reps: '3' },
  ];

  it('one row per set on a two-sided exercise', () => {
    const rows = newDrafts('b', 'warmup', false, warmups);
    expect(rows.map((r) => [r.weight, r.side, r.set_type])).toEqual([
      ['40', null, 'warmup'],
      ['60', null, 'warmup'],
      ['80', null, 'warmup'],
    ]);
  });

  it('a one-sided exercise gets each set as a left and a right, kept together', () => {
    const rows = newDrafts('b', 'warmup', true, warmups);
    expect(rows.map((r) => `${r.weight}${r.side === 'left' ? 'L' : 'R'}`)).toEqual([
      '40L',
      '40R',
      '60L',
      '60R',
      '80L',
      '80R',
    ]);
    expect(new Set(rows.map((r) => r.key)).size).toBe(6);
  });
});

describe('supersetNext', () => {
  const block = (id: string, group: string | null, done: boolean[]) => ({
    id,
    supersetGroup: group,
    rows: done.map((d) => ({ done: d })),
  });

  it('alternates within a superset, resting only after the round', () => {
    // A1 set 1 just ticked: go to A2 set 1, no rest yet.
    expect(
      supersetNext(
        [block('a1', 'A', [true, false, false]), block('a2', 'A', [false, false, false])],
        'a1',
        0,
      ),
    ).toEqual({ nextBlockId: 'a2', nextRowIndex: 0, restAfter: false });
    // A2 set 1 ticked: the round is over; rest, then A1 set 2.
    expect(
      supersetNext(
        [block('a1', 'A', [true, false, false]), block('a2', 'A', [true, false, false])],
        'a2',
        0,
      ),
    ).toEqual({ nextBlockId: 'a1', nextRowIndex: 1, restAfter: true });
  });

  it('when the partner has run out of sets, carries on with what is left, resting between', () => {
    expect(
      supersetNext([block('a1', 'A', [true, true, true]), block('a2', 'A', [true, true])], 'a1', 2),
    ).toEqual({ nextBlockId: null, nextRowIndex: null, restAfter: true });
    expect(
      supersetNext(
        [block('a1', 'A', [true, true, false]), block('a2', 'A', [true, true])],
        'a1',
        1,
      ),
    ).toEqual({ nextBlockId: 'a1', nextRowIndex: 2, restAfter: true });
  });

  it('a block outside a superset rests after every set and stays put', () => {
    expect(supersetNext([block('b', null, [true, false])], 'b', 0)).toEqual({
      nextBlockId: 'b',
      nextRowIndex: 1,
      restAfter: true,
    });
  });

  it('other groups do not interfere', () => {
    const blocks = [
      block('a1', 'A', [true, false]),
      block('b1', 'B', [false, false]),
      block('a2', 'A', [false, false]),
    ];
    expect(supersetNext(blocks, 'a1', 0)).toEqual({
      nextBlockId: 'a2',
      nextRowIndex: 0,
      restAfter: false,
    });
  });
});

describe('supersetLabels', () => {
  it('numbers each group in order: A1, A2, then B1', () => {
    expect(
      supersetLabels([
        { id: 'x', supersetGroup: 'A' },
        { id: 'y', supersetGroup: null },
        { id: 'z', supersetGroup: 'A' },
      ]),
    ).toEqual({
      x: 'A1',
      z: 'A2',
    });
  });
});

// One-sided exercises: a set is a PAIR, a left and a right. A routine's
// target_sets counts pairs, last time's structure is counted in pairs, and
// saved sets are matched side by side, so three pairs stay three pairs.
describe('one-sided blocks', () => {
  const sides = (drafts: DraftRow[]) =>
    drafts.map((d) => `${d.set_type === 'warmup' ? 'W' : 'N'}${d.side === 'left' ? 'L' : 'R'}`);
  const pair = (type: SetType): SetFact[] => [
    { ...prev(type, 8), side: 'left' },
    { ...prev(type, 8), side: 'right' },
  ];

  it("last time's three pairs open as three pairs, not six", () => {
    const drafts = initialDrafts({
      blockKey: 'bss',
      savedSets: [],
      routineTargetSets: null,
      previousSets: [...pair('normal'), ...pair('normal'), ...pair('normal')],
      unilateral: true,
    });
    expect(sides(drafts)).toEqual(['NL', 'NR', 'NL', 'NR', 'NL', 'NR']);
  });

  it('a routine target of 3 with one pair saved leaves two pairs', () => {
    const drafts = initialDrafts({
      blockKey: 'bss',
      savedSets: [saved('bss', 1, { side: 'left' }), saved('bss', 2, { side: 'right' })],
      routineTargetSets: 3,
      previousSets: [],
      unilateral: true,
    });
    expect(sides(drafts)).toEqual(['NL', 'NR', 'NL', 'NR']);
  });

  it('a pair half done leaves its other side first', () => {
    const drafts = initialDrafts({
      blockKey: 'bss',
      savedSets: [
        saved('bss', 1, { side: 'left' }),
        saved('bss', 2, { side: 'right' }),
        saved('bss', 3, { side: 'left' }),
      ],
      routineTargetSets: 3,
      previousSets: [],
      unilateral: true,
    });
    expect(sides(drafts)).toEqual(['NR', 'NL', 'NR']);
  });

  it('buildBlock lays out saved sets in order, then the drafts', () => {
    const block = buildBlock({
      row: { ...se('bss', 0), id: 'b1' },
      sets: [saved('bss', 2, { side: 'right' }), saved('bss', 1, { side: 'left' }), saved('x', 1)],
      routineTargetSets: 2,
      previousSets: [],
      unilateral: true,
    });
    expect(block.id).toBe('b1');
    expect(
      block.rows.map((r) =>
        r.kind === 'saved' ? `saved ${r.set.side}` : `draft ${r.kind === 'draft' && r.draft.side}`,
      ),
    ).toEqual(['saved left', 'saved right', 'draft left', 'draft right']);
  });
});
