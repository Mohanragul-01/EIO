/**
 * sessionState.ts - the logging screen's state, as a pure reducer.
 *
 * Each block is a list of rows, and a row is one of three things:
 *   saved    a set in the database (ticked);
 *   pending  a tick in flight: the row shows as ticked, and a second tap on it
 *            does nothing, so a double tap cannot save the same set twice;
 *   draft    being filled in, living only on the screen.
 *
 * A row keeps its key through every change, so the list never jumps: a failed
 * save returns the row to a draft with exactly what was typed, unticking turns
 * the set back into a draft where it stood, and undoing a removal puts the row
 * back at its index. Every action that finds nothing to change returns the
 * same state object, so callers can tell.
 */
import { newDraft, type DraftRow } from './blocks';
import type { SetFact } from './load';
import type { Target } from './targets';
import type {
  Exercise,
  RoutineExercise,
  SessionExercise,
  SessionSet,
  SetInput,
  SetType,
} from './types';

export type Row =
  | { kind: 'saved'; key: string; set: SessionSet }
  | { kind: 'pending'; key: string; draft: DraftRow }
  | { kind: 'draft'; key: string; draft: DraftRow };

export type BlockState = {
  id: string;
  exerciseId: string;
  sessionExercise: SessionExercise | null;
  rows: Row[];
};

export type SessionUiState = { blocks: BlockState[] };

export type SessionAction =
  | { type: 'load'; blocks: BlockState[] }
  | { type: 'tickStart'; blockId: string; key: string }
  | { type: 'tickSaved'; blockId: string; key: string; set: SessionSet }
  | { type: 'tickFailed'; blockId: string; key: string }
  | { type: 'untick'; blockId: string; key: string }
  | { type: 'removeRow'; blockId: string; key: string }
  | { type: 'restoreRow'; blockId: string; row: Row; index: number }
  | { type: 'updateDraft'; blockId: string; key: string; patch: Partial<Omit<DraftRow, 'key'>> }
  | { type: 'replaceSet'; blockId: string; key: string; set: SessionSet }
  | { type: 'addRow'; blockId: string; row: Row; index?: number }
  | { type: 'addBlock'; block: BlockState; index?: number }
  | { type: 'removeBlock'; blockId: string }
  | { type: 'moveBlock'; blockId: string; delta: -1 | 1 }
  | { type: 'updateBlock'; blockId: string; patch: Partial<SessionExercise> }
  | { type: 'reorderBlocks'; ids: string[] }
  | { type: 'replaceBlock'; blockId: string; block: BlockState };

/**
 * A saved set as an editable draft, keeping the row's key. Its load is the
 * set's own, so an empty cell here means none - not last time's, which would
 * quietly bring back the assistance you had just done without.
 */
export function draftFromSet(set: SessionSet, key: string): DraftRow {
  const text = (n: number | null) => (n === null || n === 0 ? '' : String(n));
  return {
    key,
    set_type: set.set_type,
    reps: set.reps === null ? '' : String(set.reps),
    seconds: text(set.duration_seconds),
    weight: text(set.weight_kg),
    assist: text(set.assist_kg),
    band_id: set.band_id,
    side: set.side,
    rpe: set.rpe,
    clean: set.clean,
    loadTyped: true,
  };
}

function mapBlock(
  state: SessionUiState,
  blockId: string,
  change: (block: BlockState) => BlockState,
): SessionUiState {
  const index = state.blocks.findIndex((b) => b.id === blockId);
  if (index < 0) return state;
  const next = change(state.blocks[index]);
  if (next === state.blocks[index]) return state;
  const blocks = [...state.blocks];
  blocks[index] = next;
  return { ...state, blocks };
}

function mapRow(
  state: SessionUiState,
  blockId: string,
  key: string,
  change: (row: Row) => Row,
): SessionUiState {
  return mapBlock(state, blockId, (block) => {
    const index = block.rows.findIndex((r) => r.key === key);
    if (index < 0) return block;
    const next = change(block.rows[index]);
    if (next === block.rows[index]) return block;
    const rows = [...block.rows];
    rows[index] = next;
    return { ...block, rows };
  });
}

export function sessionReducer(state: SessionUiState, action: SessionAction): SessionUiState {
  switch (action.type) {
    case 'load':
      return { blocks: action.blocks };

    case 'tickStart':
      return mapRow(state, action.blockId, action.key, (row) =>
        row.kind === 'draft' ? { kind: 'pending', key: row.key, draft: row.draft } : row,
      );

    case 'tickSaved':
      return mapRow(state, action.blockId, action.key, (row) =>
        row.kind === 'pending' ? { kind: 'saved', key: row.key, set: action.set } : row,
      );

    case 'tickFailed':
      return mapRow(state, action.blockId, action.key, (row) =>
        row.kind === 'pending' ? { kind: 'draft', key: row.key, draft: row.draft } : row,
      );

    case 'untick':
      return mapRow(state, action.blockId, action.key, (row) =>
        row.kind === 'saved'
          ? { kind: 'draft', key: row.key, draft: draftFromSet(row.set, row.key) }
          : row,
      );

    case 'replaceSet':
      return mapRow(state, action.blockId, action.key, (row) =>
        row.kind === 'saved' ? { ...row, set: action.set } : row,
      );

    case 'updateDraft':
      return mapRow(state, action.blockId, action.key, (row) =>
        row.kind === 'draft' ? { ...row, draft: { ...row.draft, ...action.patch } } : row,
      );

    case 'removeRow':
      return mapBlock(state, action.blockId, (block) => {
        const rows = block.rows.filter((r) => r.key !== action.key);
        return rows.length === block.rows.length ? block : { ...block, rows };
      });

    case 'restoreRow':
    case 'addRow':
      return mapBlock(state, action.blockId, (block) => {
        if (block.rows.some((r) => r.key === action.row.key)) return block;
        const rows = [...block.rows];
        const at =
          action.index === undefined
            ? rows.length
            : Math.min(Math.max(0, action.index), rows.length);
        rows.splice(at, 0, action.row);
        return { ...block, rows };
      });

    case 'addBlock': {
      if (state.blocks.some((b) => b.id === action.block.id)) return state;
      const blocks = [...state.blocks];
      const at = action.index === undefined ? blocks.length : action.index;
      blocks.splice(at, 0, action.block);
      return { ...state, blocks };
    }

    case 'removeBlock': {
      const blocks = state.blocks.filter((b) => b.id !== action.blockId);
      return blocks.length === state.blocks.length ? state : { ...state, blocks };
    }

    case 'moveBlock': {
      const from = state.blocks.findIndex((b) => b.id === action.blockId);
      const to = from + action.delta;
      if (from < 0 || to < 0 || to >= state.blocks.length) return state;
      const blocks = [...state.blocks];
      [blocks[from], blocks[to]] = [blocks[to], blocks[from]];
      return { ...state, blocks };
    }

    case 'reorderBlocks': {
      // Blocks in the given order; any the order leaves out keep their
      // relative order after them, so a stale list can never drop a block.
      const byId = new Map(state.blocks.map((b) => [b.id, b]));
      const ordered = action.ids.flatMap((id) => {
        const block = byId.get(id);
        if (!block) return [];
        byId.delete(id);
        return [block];
      });
      return { ...state, blocks: [...ordered, ...state.blocks.filter((b) => byId.has(b.id))] };
    }

    case 'replaceBlock':
      return mapBlock(state, action.blockId, () => action.block);

    case 'updateBlock':
      return mapBlock(state, action.blockId, (block) =>
        block.sessionExercise
          ? { ...block, sessionExercise: { ...block.sessionExercise, ...action.patch } }
          : block,
      );
  }
}

/** The values a draft row shows greyed out, and commits if left empty. */
export type Ghost = {
  reps: number | null;
  seconds: number | null;
  weight: number | null;
  assist: number | null;
};

export const NO_GHOST: Ghost = { reps: null, seconds: null, weight: null, assist: null };

/**
 * Ghost values for a row: the routine's target where it has one (the bottom of
 * the range - the number to reach first), otherwise last time's matching set;
 * the load always comes from last time, because routines do not hold weights.
 * A warm-up only ever echoes last time's warm-up: a working target on a
 * warm-up row would be a trap.
 */
export function ghostValues(input: {
  exercise: Pick<Exercise, 'tracking_type'>;
  previous: SetFact | null;
  slot: Pick<
    RoutineExercise,
    'target_reps' | 'target_reps_min' | 'target_seconds_min' | 'target_seconds_max'
  > | null;
  rowType: SetType;
}): Ghost {
  const { exercise, previous, rowType } = input;
  const slot = rowType === 'warmup' ? null : input.slot;
  const timed = exercise.tracking_type === 'time';
  return {
    reps: timed ? null : (slot?.target_reps_min ?? slot?.target_reps ?? previous?.reps ?? null),
    seconds: timed
      ? (slot?.target_seconds_min ?? slot?.target_seconds_max ?? previous?.duration_seconds ?? null)
      : null,
    weight: previous?.weight_kg ?? null,
    assist: previous?.assist_kg ?? null,
  };
}

/**
 * A row's ghost once the progression target is applied (targets.ts). The
 * target replaces the ghost only when it has a reason, and only on working
 * rows - never a warm-up or a drop - and it brings its whole load: a
 * bodyweight target set at last time's unassisted load must not keep the
 * assistance of whichever set the row happens to match.
 */
export function applyTarget(
  ghost: Ghost,
  target: Pick<Target, 'weight' | 'assist' | 'reps' | 'seconds' | 'reason'>,
  rowType: SetType,
): Ghost {
  if (!target.reason || (rowType !== 'normal' && rowType !== 'failure')) return ghost;
  const load =
    target.weight !== null
      ? { weight: target.weight, assist: target.assist }
      : { weight: ghost.weight, assist: ghost.assist };
  return {
    reps: target.reps ?? ghost.reps,
    seconds: target.seconds ?? ghost.seconds,
    ...load,
  };
}

/** What a committed draft saves. */
export type SetValues = Required<Omit<SetInput, 'exercise_id' | 'set_number'>>;

export type CommitResult = { ok: true; values: SetValues } | { ok: false; reason: string };

/** '' -> null; '62,5' -> 62.5; anything unreadable -> NaN. */
function parse(text: string): number | null {
  const trimmed = text.trim().replace(',', '.');
  if (trimmed === '') return null;
  return Number(trimmed);
}

export type DraftLoad = {
  weight: number;
  assist: number | null;
  band_id: string | null;
  /** The load is last time's, not typed: the row draws it faint. */
  ghosted: boolean;
};

/**
 * The load a draft row will save, and so the load its LOAD cell must show:
 * what was typed, and for a cell left empty, last time's - until the load has
 * been set by hand, after which empty means none. commitDraft saves exactly
 * this, so a row can never save a load it did not show.
 */
export function draftLoad(draft: DraftRow, ghost: Ghost): DraftLoad {
  const weight = parse(draft.weight);
  const assist = parse(draft.assist);
  const fromGhost = !draft.loadTyped;
  const shownAssist = assist ?? (fromGhost ? ghost.assist : null);
  return {
    weight: weight ?? (fromGhost ? ghost.weight : null) ?? 0,
    assist: shownAssist !== null && shownAssist > 0 ? shownAssist : null,
    band_id: draft.band_id,
    ghosted:
      fromGhost &&
      weight === null &&
      assist === null &&
      ((ghost.weight ?? 0) > 0 || (ghost.assist ?? 0) > 0),
  };
}

/** A load in a cell: '' for none, so the field shows its "0" placeholder. */
const loadText = (n: number | null) =>
  n === null || n === 0 ? '' : String(Math.round(n * 100) / 100);

/**
 * The patch that writes a row's shown load into its cells, for opening the
 * load sheet: the sheet then holds real values, and clearing one means none.
 * What was already typed is kept as typed.
 */
export function settleLoad(
  draft: DraftRow,
  ghost: Ghost,
): Pick<DraftRow, 'weight' | 'assist' | 'loadTyped'> {
  const load = draftLoad(draft, ghost);
  return {
    weight: draft.weight.trim() !== '' ? draft.weight : loadText(load.weight),
    assist: draft.assist.trim() !== '' ? draft.assist : loadText(load.assist),
    loadTyped: true,
  };
}

/**
 * Turn a draft into the set to save, filling empty cells from the ghost
 * values - which is what lets a row be ticked without typing anything - or
 * say, in a few words, what is missing or wrong.
 */
export function commitDraft(
  draft: DraftRow,
  ghost: Ghost,
  exercise: Pick<Exercise, 'tracking_type' | 'load_mode'>,
): CommitResult {
  const timed = exercise.tracking_type === 'time';
  const load = draftLoad(draft, ghost);

  const typedWeight = parse(draft.weight);
  if (
    typedWeight !== null &&
    !(Number.isFinite(typedWeight) && typedWeight >= 0 && typedWeight < 10000)
  ) {
    return { ok: false, reason: 'Weight must be 0 or more' };
  }
  const weight = load.weight;

  let reps: number | null = null;
  let seconds: number | null = null;
  if (timed) {
    const typed = parse(draft.seconds);
    seconds = typed ?? ghost.seconds;
    if (seconds === null) return { ok: false, reason: 'Enter the seconds first' };
    if (!Number.isInteger(seconds) || seconds <= 0) {
      return { ok: false, reason: 'Seconds must be a whole number' };
    }
  } else {
    const typed = parse(draft.reps);
    reps = typed ?? ghost.reps;
    if (reps === null) return { ok: false, reason: 'Enter the reps first' };
    if (!Number.isInteger(reps) || reps < 0)
      return { ok: false, reason: 'Reps must be a whole number' };
    // A failed attempt is the one set that may record no reps.
    if (reps === 0 && draft.set_type !== 'failure') {
      return { ok: false, reason: 'Reps must be at least 1' };
    }
  }

  let assist: number | null = null;
  if (exercise.load_mode === 'bodyweight') {
    const typed = parse(draft.assist);
    if (typed !== null && !(Number.isFinite(typed) && typed >= 0 && typed < 1000)) {
      return { ok: false, reason: 'Assistance must be 0 or more' };
    }
    assist = load.assist;
  }

  return {
    ok: true,
    values: {
      reps,
      duration_seconds: seconds,
      weight_kg: weight,
      rpe: draft.rpe,
      set_type: draft.set_type,
      assist_kg: assist,
      band_id: exercise.load_mode === 'bodyweight' ? draft.band_id : null,
      side: draft.side,
      clean: draft.clean,
    },
  };
}

/** A fresh row for a block, of the given type. */
export function draftRow(blockId: string, setType: SetType = 'normal'): Row {
  const draft = newDraft(blockId, setType);
  return { kind: 'draft', key: draft.key, draft };
}
