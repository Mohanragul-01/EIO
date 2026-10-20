/**
 * blocks.ts - a session as the logging screen shows it: one block per
 * exercise, each a table of rows that are either saved sets or drafts.
 *
 * WHERE BLOCKS COME FROM. session_exercises, in position order - not the sets.
 * Rebuilding the list from logged sets (as v2 did) meant an exercise added but
 * not yet logged vanished when the session was reopened, and order, rest and
 * notes had nowhere to live. Sets that v2 logged without a block row are still
 * shown, after the rest in the order they were logged, so nothing already
 * recorded can be hidden by the change.
 *
 * DRAFTS. Rows not yet ticked live only on the screen. They are rebuilt on
 * open from the routine's target (or, failing that, last time's structure), so
 * losing them costs nothing: ticking is what saves.
 */
import type { SetFact } from './load';
import type { SessionExercise, SessionSet, SetType, Side } from './types';

export type Block = {
  /** The block row's id, or `orphan:<exerciseId>` for v2 sets without one. */
  id: string;
  exerciseId: string;
  sessionExercise: SessionExercise | null;
  /** Saved sets, in set order. */
  sets: SessionSet[];
};

/** A row being filled in. Text fields hold exactly what was typed. */
export type DraftRow = {
  key: string;
  set_type: SetType;
  reps: string;
  seconds: string;
  weight: string;
  assist: string;
  band_id: string | null;
  side: Side | null;
  rpe: number | null;
  clean: boolean;
  /**
   * The load has been set by hand (the load sheet, a copy from PREVIOUS, or
   * an untick), so an empty weight or assistance means none. Until then an
   * empty cell means last time's load, shown faint.
   */
  loadTyped?: boolean;
};

export function assembleBlocks(sessionExercises: SessionExercise[], sets: SessionSet[]): Block[] {
  const bySet = (a: SessionSet, b: SessionSet) => a.set_number - b.set_number;
  const blocks: Block[] = [...sessionExercises]
    .sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at))
    .map((row) => ({
      id: row.id,
      exerciseId: row.exercise_id,
      sessionExercise: row,
      sets: sets.filter((s) => s.exercise_id === row.exercise_id).sort(bySet),
    }));

  // Sets whose exercise has no block row: logged by v2. Appended in the order
  // each exercise was first logged.
  const known = new Set(blocks.map((b) => b.exerciseId));
  const orphans = [...sets]
    .filter((s) => !known.has(s.exercise_id))
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  for (const set of orphans) {
    if (known.has(set.exercise_id)) continue;
    known.add(set.exercise_id);
    blocks.push({
      id: `orphan:${set.exercise_id}`,
      exerciseId: set.exercise_id,
      sessionExercise: null,
      sets: sets.filter((s) => s.exercise_id === set.exercise_id).sort(bySet),
    });
  }
  return blocks;
}

let draftSeq = 0;

/** An empty row of the given type, with a key unique for the app's lifetime. */
export function newDraft(blockKey: string, set_type: SetType = 'normal'): DraftRow {
  draftSeq += 1;
  return {
    key: `${blockKey}:d${draftSeq}`,
    set_type,
    reps: '',
    seconds: '',
    weight: '',
    assist: '',
    band_id: null,
    side: null,
    rpe: null,
    clean: true,
  };
}

/**
 * The rows still to fill in when a block opens.
 *
 * With a routine, its target number of working sets. Without one, last time's
 * structure, warm-ups and all, since that is the best guess at today's. A new
 * exercise gets one row. Rows already saved are taken off the front, and a
 * block that is complete gets none (there is an "Add set" for more).
 */
export function initialDrafts(input: {
  blockKey: string;
  savedSets: Pick<SessionSet, 'set_type'>[];
  routineTargetSets: number | null;
  previousSets: Pick<SetFact, 'set_type'>[];
}): DraftRow[] {
  const structure: SetType[] =
    input.routineTargetSets !== null && input.routineTargetSets > 0
      ? Array.from({ length: input.routineTargetSets }, () => 'normal' as const)
      : input.previousSets.length > 0
        ? input.previousSets.map((s) => s.set_type)
        : ['normal'];

  const remaining =
    input.savedSets.length === 0 ? structure : structure.slice(input.savedSets.length);
  return remaining.map((type) => newDraft(input.blockKey, type));
}

type SupersetBlock = { id: string; supersetGroup: string | null; rows: { done: boolean }[] };

/**
 * Where to go after ticking a set, and whether to rest first.
 *
 * In a superset you alternate (A1, A2, A1, A2...) and rest only after the
 * last exercise of a round, so ticking moves on to the partner's next set
 * with no rest timer. Outside a superset you rest after every set and stay
 * on the same exercise. A partner that has run out of sets drops out of the
 * rotation, and what is left continues with rest between sets.
 */
export function supersetNext(
  blocks: SupersetBlock[],
  blockId: string,
  rowIndex: number,
): { nextBlockId: string | null; nextRowIndex: number | null; restAfter: boolean } {
  void rowIndex; // The ticked row is already marked done in `blocks`.
  const block = blocks.find((b) => b.id === blockId);
  const firstUndone = (b: SupersetBlock) => b.rows.findIndex((r) => !r.done);
  const none = { nextBlockId: null, nextRowIndex: null, restAfter: true };
  if (!block) return none;

  if (!block.supersetGroup) {
    const i = firstUndone(block);
    return i < 0 ? none : { nextBlockId: block.id, nextRowIndex: i, restAfter: true };
  }

  const group = blocks.filter((b) => b.supersetGroup === block.supersetGroup);
  const k = group.findIndex((b) => b.id === blockId);
  // Still in this round: the next exercise along with a set to do.
  for (let j = k + 1; j < group.length; j++) {
    const i = firstUndone(group[j]);
    if (i >= 0) return { nextBlockId: group[j].id, nextRowIndex: i, restAfter: false };
  }
  // End of the round: rest, then start the next one from the top.
  for (const b of group) {
    const i = firstUndone(b);
    if (i >= 0) return { nextBlockId: b.id, nextRowIndex: i, restAfter: true };
  }
  return none;
}

/** "A1", "A2", "B1"... for blocks in supersets, in order. */
export function supersetLabels(
  blocks: { id: string; supersetGroup: string | null }[],
): Record<string, string> {
  const counts: Record<string, number> = {};
  const out: Record<string, string> = {};
  for (const b of blocks) {
    if (!b.supersetGroup) continue;
    counts[b.supersetGroup] = (counts[b.supersetGroup] ?? 0) + 1;
    out[b.id] = `${b.supersetGroup}${counts[b.supersetGroup]}`;
  }
  return out;
}
