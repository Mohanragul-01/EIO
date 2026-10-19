/**
 * The logging screen's state: saved rows, drafts, and a tick in flight.
 *
 * What must never happen, and is pinned here:
 *  - a double tap ticking the same row twice (two identical sets saved);
 *  - a failed save losing what was typed;
 *  - unticking moving the row, or forgetting its values;
 *  - undoing a removal putting the row back somewhere else.
 */
import { newDraft, type DraftRow } from '../blocks';
import {
  commitDraft,
  ghostValues,
  sessionReducer,
  type BlockState,
  type SessionUiState,
} from '../sessionState';
import type { SessionSet } from '../types';

function savedSet(id: string, extra: Partial<SessionSet> = {}): SessionSet {
  return {
    id,
    session_id: 'today',
    exercise_id: 'bench',
    user_id: 'u',
    set_number: 1,
    reps: 8,
    duration_seconds: null,
    weight_kg: 60,
    rpe: null,
    set_type: 'normal',
    assist_kg: null,
    band_id: null,
    side: null,
    clean: true,
    created_at: '2026-10-19T10:00:00Z',
    ...extra,
  };
}

function draft(patch: Partial<DraftRow> = {}): DraftRow {
  return { ...newDraft('bench'), ...patch };
}

function state(rows: BlockState['rows']): SessionUiState {
  return {
    blocks: [{ id: 'b1', exerciseId: 'bench', sessionExercise: null, rows }],
  };
}

const rowsOf = (s: SessionUiState) => s.blocks[0].rows;

describe('ticking', () => {
  it('a tick marks the draft pending, and the save replaces it in place', () => {
    const a = draft({ reps: '8' });
    const b = draft();
    let s = state([{ kind: 'draft', key: a.key, draft: a }, { kind: 'draft', key: b.key, draft: b }]);

    s = sessionReducer(s, { type: 'tickStart', blockId: 'b1', key: a.key });
    expect(rowsOf(s)[0].kind).toBe('pending');

    s = sessionReducer(s, { type: 'tickSaved', blockId: 'b1', key: a.key, set: savedSet('s1') });
    expect(rowsOf(s)[0]).toMatchObject({ kind: 'saved', key: a.key });
    expect(rowsOf(s)[1]).toMatchObject({ kind: 'draft', key: b.key });
  });

  it('a second tick on a pending row does nothing (no double save)', () => {
    const a = draft({ reps: '8' });
    let s = state([{ kind: 'draft', key: a.key, draft: a }]);
    s = sessionReducer(s, { type: 'tickStart', blockId: 'b1', key: a.key });
    expect(sessionReducer(s, { type: 'tickStart', blockId: 'b1', key: a.key })).toBe(s);
  });

  it('a failed save puts back exactly what was typed', () => {
    const a = draft({ reps: '8', weight: '62.5' });
    let s = state([{ kind: 'draft', key: a.key, draft: a }]);
    s = sessionReducer(s, { type: 'tickStart', blockId: 'b1', key: a.key });
    s = sessionReducer(s, { type: 'tickFailed', blockId: 'b1', key: a.key });
    expect(rowsOf(s)[0]).toEqual({ kind: 'draft', key: a.key, draft: a });
  });
});

describe('unticking', () => {
  it('turns the saved row back into a draft with its values, in the same place', () => {
    const before = draft();
    let s = state([
      { kind: 'saved', key: 'k1', set: savedSet('s1', { reps: 10, weight_kg: 62.5, set_type: 'failure' }) },
      { kind: 'draft', key: before.key, draft: before },
    ]);
    s = sessionReducer(s, { type: 'untick', blockId: 'b1', key: 'k1' });
    expect(rowsOf(s)[0]).toMatchObject({
      kind: 'draft',
      key: 'k1',
      draft: { reps: '10', weight: '62.5', set_type: 'failure' },
    });
    expect(rowsOf(s)[1].key).toBe(before.key);
  });
});

describe('removing and undoing', () => {
  it('restore puts the row back at its index', () => {
    const a = draft();
    const b = draft();
    const c = draft();
    let s = state([
      { kind: 'draft', key: a.key, draft: a },
      { kind: 'draft', key: b.key, draft: b },
      { kind: 'draft', key: c.key, draft: c },
    ]);
    const removed = rowsOf(s)[1];
    s = sessionReducer(s, { type: 'removeRow', blockId: 'b1', key: b.key });
    expect(rowsOf(s).map((r) => r.key)).toEqual([a.key, c.key]);
    s = sessionReducer(s, { type: 'restoreRow', blockId: 'b1', row: removed, index: 1 });
    expect(rowsOf(s).map((r) => r.key)).toEqual([a.key, b.key, c.key]);
  });

  it('restoring past the end appends', () => {
    const a = draft();
    let s = state([]);
    s = sessionReducer(s, { type: 'restoreRow', blockId: 'b1', row: { kind: 'draft', key: a.key, draft: a }, index: 5 });
    expect(rowsOf(s)).toHaveLength(1);
  });
});

describe('editing', () => {
  it('updates a draft field without touching other rows', () => {
    const a = draft();
    const b = draft();
    const before = state([{ kind: 'draft', key: a.key, draft: a }, { kind: 'draft', key: b.key, draft: b }]);
    const untouched = rowsOf(before)[1];
    const after = sessionReducer(before, { type: 'updateDraft', blockId: 'b1', key: a.key, patch: { reps: '9' } });
    expect(rowsOf(after)[0]).toMatchObject({ draft: { reps: '9' } });
    expect(rowsOf(after)[1]).toBe(untouched);
  });

  it('an unknown block or row changes nothing', () => {
    const s = state([]);
    expect(sessionReducer(s, { type: 'tickStart', blockId: 'nope', key: 'x' })).toBe(s);
    expect(sessionReducer(s, { type: 'untick', blockId: 'b1', key: 'x' })).toBe(s);
  });

  it('moves a block, and refuses to move past either end', () => {
    let s: SessionUiState = {
      blocks: ['a', 'b', 'c'].map((id) => ({ id, exerciseId: id, sessionExercise: null, rows: [] })),
    };
    s = sessionReducer(s, { type: 'moveBlock', blockId: 'c', delta: -1 });
    expect(s.blocks.map((b) => b.id)).toEqual(['a', 'c', 'b']);
    expect(sessionReducer(s, { type: 'moveBlock', blockId: 'a', delta: -1 })).toBe(s);
  });
});

describe('commitDraft', () => {
  const external = { tracking_type: 'reps' as const, load_mode: 'external' as const };
  const pullUp = { tracking_type: 'reps' as const, load_mode: 'bodyweight' as const };
  const plank = { tracking_type: 'time' as const, load_mode: 'bodyweight' as const };
  const noGhost = { reps: null, seconds: null, weight: null, assist: null };

  it('takes typed values, accepting a comma as the decimal point', () => {
    const result = commitDraft(draft({ reps: '8', weight: '62,5' }), noGhost, external);
    expect(result).toEqual({
      ok: true,
      values: expect.objectContaining({ reps: 8, duration_seconds: null, weight_kg: 62.5 }),
    });
  });

  it('fills empty cells from the ghost values, so a set can be logged without typing', () => {
    const result = commitDraft(draft(), { reps: 10, seconds: null, weight: 60, assist: null }, external);
    expect(result).toMatchObject({ ok: true, values: { reps: 10, weight_kg: 60 } });
  });

  it('says what is missing when there is no value and no ghost', () => {
    expect(commitDraft(draft(), noGhost, external)).toEqual({ ok: false, reason: 'Enter the reps first' });
    expect(commitDraft(draft(), noGhost, plank)).toEqual({ ok: false, reason: 'Enter the seconds first' });
  });

  it('allows 0 reps only on a failure set', () => {
    expect(commitDraft(draft({ reps: '0' }), noGhost, external).ok).toBe(false);
    expect(commitDraft(draft({ reps: '0', set_type: 'failure' }), noGhost, external)).toMatchObject({
      ok: true,
      values: { reps: 0 },
    });
  });

  it('rejects nonsense', () => {
    expect(commitDraft(draft({ reps: '8.5' }), noGhost, external).ok).toBe(false);
    expect(commitDraft(draft({ reps: '8', weight: '-5' }), noGhost, external).ok).toBe(false);
    expect(commitDraft(draft({ reps: 'abc' }), noGhost, external).ok).toBe(false);
  });

  it('a bodyweight set with no weight is unloaded, not an error', () => {
    expect(commitDraft(draft({ reps: '10' }), noGhost, pullUp)).toMatchObject({
      ok: true,
      values: { reps: 10, weight_kg: 0, assist_kg: null },
    });
  });

  it('records assistance on a bodyweight set, and ignores it on an external one', () => {
    expect(commitDraft(draft({ reps: '6', assist: '20' }), noGhost, pullUp)).toMatchObject({
      ok: true,
      values: { assist_kg: 20 },
    });
    expect(commitDraft(draft({ reps: '6', weight: '40', assist: '20' }), noGhost, external)).toMatchObject({
      ok: true,
      values: { assist_kg: null },
    });
  });

  it('a hold takes seconds and no reps', () => {
    expect(commitDraft(draft({ seconds: '45' }), noGhost, plank)).toMatchObject({
      ok: true,
      values: { reps: null, duration_seconds: 45 },
    });
  });
});

describe('ghostValues', () => {
  const pullUp = { tracking_type: 'reps' as const };
  const previous = {
    id: 'p',
    exercise_id: 'x',
    session_id: 'last',
    set_type: 'normal' as const,
    reps: 9,
    duration_seconds: null,
    weight_kg: 10,
    assist_kg: null,
    clean: true,
    created_at: '',
  };

  it('takes the routine target reps, and the weight from last time', () => {
    expect(
      ghostValues({ exercise: pullUp, previous, slot: { target_reps: 12, target_reps_min: 8, target_seconds_min: null, target_seconds_max: null }, rowType: 'normal' }),
    ).toEqual({ reps: 8, seconds: null, weight: 10, assist: null });
  });

  it('falls back to last time without a routine', () => {
    expect(ghostValues({ exercise: pullUp, previous, slot: null, rowType: 'normal' })).toEqual({
      reps: 9,
      seconds: null,
      weight: 10,
      assist: null,
    });
  });

  it('a warm-up never takes the working target', () => {
    expect(
      ghostValues({ exercise: pullUp, previous: null, slot: { target_reps: 12, target_reps_min: null, target_seconds_min: null, target_seconds_max: null }, rowType: 'warmup' }),
    ).toEqual({ reps: null, seconds: null, weight: null, assist: null });
  });

  it('nothing to go on gives nothing', () => {
    expect(ghostValues({ exercise: pullUp, previous: null, slot: null, rowType: 'normal' })).toEqual({
      reps: null,
      seconds: null,
      weight: null,
      assist: null,
    });
  });
});
