/**
 * useWorkoutSession - one training session being logged.
 *
 * The rules live in pure files and are tested there: what a row is and how it
 * changes (sessionState.ts), how a typed row becomes a set (commitDraft), what
 * a row is compared with (previous.ts), what counts as a record (records.ts),
 * and how much was lifted (load.ts). This hook only connects them to the
 * database and keeps the screen's state.
 *
 * SAVE AS YOU GO. Ticking a row writes the set immediately; nothing waits for
 * Finish, which only stamps the end time. A phone in a gym gets dropped,
 * locked and killed, and none of that may cost a set.
 *
 * RECORDS ARE RECOMPUTED, never stored: from the session's saved sets and a
 * baseline of every other session's sets for these exercises, fetched once on
 * open. So the badges after reopening are exactly the ones shown live.
 */
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';

import { todayISO } from '../../core/date';
import { useLatestRun } from '../../core/useLatestRun';

import * as api from './api';
import { initialDrafts, newDraft, type DraftRow } from './blocks';
import { toSetFact, workingVolume, type SetFact } from './load';
import { matchPrevious } from './previous';
import { ladderSlotTarget } from './progression';
import { nextTarget, type Target } from './targets';
import { sessionRecords, type RecordHit } from './records';
import {
  commitDraft,
  ghostValues,
  sessionReducer,
  type BlockState,
  type Ghost,
  type Row,
} from './sessionState';
import {
  nextSetNumber,
  type Band,
  type Exercise,
  type RoutineExercise,
  type SessionExercise,
  type SessionSet,
  type SetType,
  type WorkoutSession,
} from './types';

/** Rest when neither the block nor the exercise has one. */
export const DEFAULT_REST_SECONDS = 90;

export type TickResult =
  | { ok: true; set: SessionSet; records: RecordHit[]; restSeconds: number; exerciseId: string }
  | { ok: false; reason: string };

type Previous = Record<string, { date: string; sets: SetFact[] }>;

function blockFor(
  row: SessionExercise,
  sets: SessionSet[],
  slot: RoutineExercise | undefined,
  previous: Previous,
  unilateral = false,
): BlockState {
  const saved = sets
    .filter((s) => s.exercise_id === row.exercise_id)
    .sort((a, b) => a.set_number - b.set_number);
  const drafts = initialDrafts({
    blockKey: row.id,
    savedSets: saved,
    routineTargetSets: slot?.target_sets ?? null,
    previousSets: previous[row.exercise_id]?.sets ?? [],
  });
  // A one-sided exercise logs each set as a left and a right.
  const sided = unilateral
    ? drafts.flatMap((d) => [
        { ...d, side: 'left' as const },
        { ...newDraft(row.id, d.set_type), side: 'right' as const },
      ])
    : drafts;
  const rows: Row[] = [
    ...saved.map((set): Row => ({ kind: 'saved', key: set.id, set })),
    ...sided.map((draft): Row => ({ kind: 'draft', key: draft.key, draft })),
  ];
  return { id: row.id, exerciseId: row.exercise_id, sessionExercise: row, rows };
}

export function useWorkoutSession(sessionId: string) {
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [bands, setBands] = useState<Band[]>([]);
  const [baseline, setBaseline] = useState<Record<string, SetFact[]>>({});
  const [previous, setPrevious] = useState<Previous>({});
  /**
   * The routine's target for each exercise in the session. A ladder slot is
   * keyed by its current rung's exercise, with the rung's range as target.
   */
  const [slotsByExercise, setSlotsByExercise] = useState<Record<string, RoutineExercise>>({});
  const [state, dispatch] = useReducer(sessionReducer, { blocks: [] });
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { begin, isMounted } = useLatestRun();

  // The latest state for async callbacks, which would otherwise read the state
  // from the render they were created in.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Rows with a save in flight. Checked synchronously, so a second tap on the
  // same row before the screen re-renders is ignored rather than saved twice.
  const inFlight = useRef(new Set<string>());

  const exercisesById = useMemo(
    () => Object.fromEntries(exercises.map((e) => [e.id, e])) as Record<string, Exercise>,
    [exercises],
  );

  const load = useCallback(async () => {
    const isCurrent = begin();
    setError(null);
    try {
      const [found, blockRows, sets, exerciseRows, bandRows] = await Promise.all([
        api.getSession(sessionId),
        api.listSessionExercises(sessionId),
        api.listSessionSets(sessionId),
        api.listExercises(),
        api.listBands(),
      ]);
      if (!isCurrent()) return;
      if (!found) {
        setMissing(true);
        return;
      }

      // Sets v2 logged without a block row: give them one now, after the
      // existing blocks in the order each was first logged, so this session
      // behaves like any other from here on.
      const known = new Set(blockRows.map((b) => b.exercise_id));
      const orphanIds: string[] = [];
      [...sets]
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .forEach((s) => {
          if (!known.has(s.exercise_id)) {
            known.add(s.exercise_id);
            orphanIds.push(s.exercise_id);
          }
        });
      const adopted = await Promise.all(
        orphanIds.map((exerciseId, i) =>
          api.addSessionExercise({
            session_id: sessionId,
            exercise_id: exerciseId,
            position: blockRows.length + i,
          }),
        ),
      );
      const allBlocks = [...blockRows, ...adopted].sort((a, b) => a.position - b.position);
      const ids = allBlocks.map((b) => b.exercise_id);

      const [baselineRows, previousRows, slotRows] = await Promise.all([
        api.listBaseline(ids, sessionId),
        api.listPreviousSets(ids, sessionId, found.date),
        found.routine_id
          ? api.listRoutineExercises(found.routine_id).catch(() => [])
          : Promise.resolve([]),
      ]);
      if (!isCurrent()) return;

      const slotMap = Object.fromEntries(
        slotRows.flatMap((slot) => (slot.exercise_id ? [[slot.exercise_id, slot]] : [])),
      ) as Record<string, RoutineExercise>;
      // Ladder slots aim at their current rung: its restart point up to its goal.
      if (slotRows.some((slot) => slot.progression_id)) {
        const ladders = await api.listLadders().catch(() => []);
        for (const slot of slotRows) {
          const ladder = ladders.find((l) => l.progression.id === slot.progression_id);
          const rung = ladder?.steps.find((st) => st.id === ladder.progression.current_step_id);
          if (!rung || slotMap[rung.exercise_id]) continue;
          const target = ladderSlotTarget(rung);
          slotMap[rung.exercise_id] = {
            ...slot,
            exercise_id: rung.exercise_id,
            ...target,
            target_sets: slot.target_sets ?? target.target_sets,
          };
        }
        if (!isCurrent()) return;
      }

      setSession(found);
      setExercises(exerciseRows);
      setBands(bandRows);
      setBaseline(baselineRows);
      setPrevious(previousRows);
      setSlotsByExercise(slotMap);
      dispatch({
        type: 'load',
        blocks: allBlocks.map((row) =>
          blockFor(
            row,
            sets,
            slotMap[row.exercise_id],
            previousRows,
            exerciseRows.find((e) => e.id === row.exercise_id)?.is_unilateral,
          ),
        ),
      });
    } catch (e) {
      if (isCurrent()) setError(e instanceof Error ? e.message : 'Could not load this workout');
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [sessionId, begin]);

  useEffect(() => {
    // Starts a fetch rather than computing derived state - see useTodos.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  // DERIVED ---------------------------------------------------------------------

  const savedFacts = useMemo(
    () =>
      state.blocks
        .flatMap((b) => b.rows.flatMap((r) => (r.kind === 'saved' ? [toSetFact(r.set)] : [])))
        .sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [state.blocks],
  );

  const records = useMemo(
    () => sessionRecords(exercisesById, baseline, savedFacts),
    [exercisesById, baseline, savedFacts],
  );

  const stats = useMemo(() => {
    const firstSet = savedFacts[0]?.created_at ?? null;
    const startedAt = session?.started_at ?? firstSet;
    return {
      volume: workingVolume(savedFacts, exercisesById, session?.bodyweight_kg ?? null),
      workingSets: savedFacts.filter((s) => s.set_type !== 'warmup').length,
      startedAt: startedAt ? Date.parse(startedAt) : null,
      endedAt: session?.ended_at ? Date.parse(session.ended_at) : null,
    };
  }, [savedFacts, exercisesById, session]);

  const rowTypes = (block: BlockState): SetType[] =>
    block.rows.map((r) => (r.kind === 'saved' ? r.set.set_type : r.draft.set_type));

  /** Last time's set that row `index` of a block is compared with. */
  const previousFor = useCallback(
    (block: BlockState, index: number): SetFact | null =>
      matchPrevious(previous[block.exerciseId]?.sets ?? [], rowTypes(block), index),
    [previous],
  );

  /**
   * What to aim for this session, by double progression (targets.ts). Its
   * numbers replace the ghosts only when it has a reason - a step up, or a
   * hold after a break - and the reason is shown beside the exercise.
   */
  const targetFor = useCallback(
    (block: BlockState): Target => {
      const exercise = exercisesById[block.exerciseId];
      const last = previous[block.exerciseId];
      const slot = slotsByExercise[block.exerciseId];
      if (!exercise || !last) return { weight: null, reps: null, seconds: null, reason: null };
      return nextTarget({
        exercise,
        slot: slot
          ? {
              repsMin: slot.target_reps_min,
              repsMax: slot.target_reps,
              secondsMin: slot.target_seconds_min,
              secondsMax: slot.target_seconds_max,
              incrementKg: slot.increment_kg,
            }
          : null,
        lastWorkingSets: last.sets,
        lastDate: last.date,
        today: session?.date ?? todayISO(),
      });
    },
    [exercisesById, previous, slotsByExercise, session],
  );

  /** The greyed values a row shows and commits if left empty. */
  const ghostFor = useCallback(
    (block: BlockState, index: number): Ghost => {
      const exercise = exercisesById[block.exerciseId];
      const row = block.rows[index];
      if (!exercise || !row) return { reps: null, seconds: null, weight: null, assist: null };
      const rowType = row.kind === 'saved' ? row.set.set_type : row.draft.set_type;
      const ghost = ghostValues({
        exercise,
        previous: previousFor(block, index),
        slot: slotsByExercise[block.exerciseId] ?? null,
        rowType,
      });
      // A progression target applies to working sets, never warm-ups or drops.
      const target = targetFor(block);
      if (target.reason && (rowType === 'normal' || rowType === 'failure')) {
        return {
          reps: target.reps ?? ghost.reps,
          seconds: target.seconds ?? ghost.seconds,
          weight: target.weight ?? ghost.weight,
          assist: ghost.assist,
        };
      }
      return ghost;
    },
    [exercisesById, previousFor, slotsByExercise, targetFor],
  );

  /** A block's rest: its own, else the exercise's, else the default. */
  const restFor = useCallback(
    (block: BlockState): number =>
      block.sessionExercise?.rest_seconds ??
      exercisesById[block.exerciseId]?.default_rest_seconds ??
      DEFAULT_REST_SECONDS,
    [exercisesById],
  );

  const fail = useCallback(
    (e: unknown, fallback: string) => {
      if (isMounted()) setError(e instanceof Error ? e.message : fallback);
    },
    [isMounted],
  );

  // ROWS --------------------------------------------------------------------------

  const tick = useCallback(
    /**
     * `override` carries values decided at the moment of ticking (the hold
     * timer's seconds), which have not reached the draft in state yet.
     */
    async (
      blockId: string,
      key: string,
      override?: Partial<Omit<DraftRow, 'key'>>,
    ): Promise<TickResult> => {
      const block = stateRef.current.blocks.find((b) => b.id === blockId);
      const index = block?.rows.findIndex((r) => r.key === key) ?? -1;
      const row = block?.rows[index];
      const exercise = block ? exercisesById[block.exerciseId] : undefined;
      if (!block || !row || row.kind !== 'draft' || !exercise || inFlight.current.has(key)) {
        return { ok: false, reason: '' };
      }
      if (override) dispatch({ type: 'updateDraft', blockId, key, patch: override });
      const draft = override ? { ...row.draft, ...override } : row.draft;

      const committed = commitDraft(draft, ghostFor(block, index), exercise);
      if (!committed.ok) return committed;

      inFlight.current.add(key);
      dispatch({ type: 'tickStart', blockId, key });
      try {
        const savedSets = block.rows.flatMap((r) => (r.kind === 'saved' ? [r.set] : []));
        const set = await api.addSet(sessionId, {
          ...committed.values,
          exercise_id: block.exerciseId,
          set_number: nextSetNumber(savedSets),
        });
        if (!isMounted()) return { ok: false, reason: '' };
        dispatch({ type: 'tickSaved', blockId, key, set });

        const facts = [...savedFacts, toSetFact(set)];
        const hits = sessionRecords(exercisesById, baseline, facts)[set.id] ?? [];
        // No rest before a drop set: it follows straight on.
        const next = block.rows[index + 1];
        const nextType = next
          ? next.kind === 'saved'
            ? next.set.set_type
            : next.draft.set_type
          : null;
        return {
          ok: true,
          set,
          records: hits,
          restSeconds: nextType === 'drop' ? 0 : restFor(block),
          exerciseId: block.exerciseId,
        };
      } catch (e) {
        dispatch({ type: 'tickFailed', blockId, key });
        fail(e, 'Could not save that set');
        return { ok: false, reason: 'Could not save that set' };
      } finally {
        inFlight.current.delete(key);
      }
    },
    [sessionId, exercisesById, ghostFor, baseline, savedFacts, restFor, isMounted, fail],
  );

  /** Unticking deletes the saved set and leaves its values in the row. */
  const untick = useCallback(
    async (blockId: string, key: string) => {
      const block = stateRef.current.blocks.find((b) => b.id === blockId);
      const row = block?.rows.find((r) => r.key === key);
      if (!row || row.kind !== 'saved' || inFlight.current.has(key)) return;
      inFlight.current.add(key);
      dispatch({ type: 'untick', blockId, key });
      try {
        await api.deleteSet(row.set.id);
      } catch (e) {
        fail(e, 'Could not untick that set');
        void load();
      } finally {
        inFlight.current.delete(key);
      }
    },
    [fail, load],
  );

  /**
   * Remove a row. Returns an undo, or null when there was nothing to remove.
   * A saved set is deleted now; undoing writes it back with the same values.
   */
  const removeRow = useCallback(
    (blockId: string, key: string): (() => void) | null => {
      const block = stateRef.current.blocks.find((b) => b.id === blockId);
      const index = block?.rows.findIndex((r) => r.key === key) ?? -1;
      const row = block?.rows[index];
      if (!block || !row || row.kind === 'pending' || inFlight.current.has(key)) return null;

      dispatch({ type: 'removeRow', blockId, key });

      if (row.kind === 'draft') {
        return () => dispatch({ type: 'restoreRow', blockId, row, index });
      }

      const removed = row.set;
      const deleting = api.deleteSet(removed.id).catch((e) => {
        fail(e, 'Could not delete that set');
        void load();
      });
      return () => {
        void (async () => {
          await deleting;
          try {
            const restored = await api.addSet(sessionId, {
              exercise_id: removed.exercise_id,
              set_number: removed.set_number,
              reps: removed.reps,
              duration_seconds: removed.duration_seconds,
              weight_kg: removed.weight_kg,
              rpe: removed.rpe,
              set_type: removed.set_type,
              assist_kg: removed.assist_kg,
              band_id: removed.band_id,
              side: removed.side,
              clean: removed.clean,
            });
            if (!isMounted()) return;
            dispatch({
              type: 'restoreRow',
              blockId,
              row: { kind: 'saved', key: restored.id, set: restored },
              index,
            });
          } catch (e) {
            fail(e, 'Could not restore that set');
          }
        })();
      };
    },
    [sessionId, fail, load, isMounted],
  );

  /**
   * Add a row (with starting values, if given); a one-sided exercise gets a
   * left and a right.
   */
  const addRow = useCallback(
    (
      blockId: string,
      setType: SetType = 'normal',
      index?: number,
      values: Partial<Omit<DraftRow, 'key' | 'set_type' | 'side'>> = {},
    ) => {
      const block = stateRef.current.blocks.find((b) => b.id === blockId);
      const sides =
        block && exercisesById[block.exerciseId]?.is_unilateral
          ? (['left', 'right'] as const)
          : [null];
      sides.forEach((side, i) => {
        const draft = { ...newDraft(blockId, setType), ...values, side };
        dispatch({
          type: 'addRow',
          blockId,
          row: { kind: 'draft', key: draft.key, draft },
          index: index === undefined ? undefined : index + i,
        });
      });
    },
    [exercisesById],
  );

  const updateDraft = useCallback(
    (blockId: string, key: string, patch: Partial<Omit<DraftRow, 'key'>>) => {
      dispatch({ type: 'updateDraft', blockId, key, patch });
    },
    [],
  );

  /** Change a row's type, or its RPE. A saved set is updated in place. */
  const updateRow = useCallback(
    async (
      blockId: string,
      key: string,
      patch: { set_type?: SetType; rpe?: number | null; clean?: boolean },
    ) => {
      const block = stateRef.current.blocks.find((b) => b.id === blockId);
      const row = block?.rows.find((r) => r.key === key);
      if (!row || row.kind === 'pending') return;
      if (row.kind === 'draft') {
        dispatch({ type: 'updateDraft', blockId, key, patch });
        return;
      }
      // A non-failure set cannot hold 0 reps; refuse rather than fail on save.
      if (patch.set_type && patch.set_type !== 'failure' && row.set.reps === 0) {
        setError('A set with no reps can only be a failure set');
        return;
      }
      dispatch({ type: 'replaceSet', blockId, key, set: { ...row.set, ...patch } });
      try {
        await api.updateSet(row.set.id, patch);
      } catch (e) {
        fail(e, 'Could not change that set');
        void load();
      }
    },
    [fail, load],
  );

  // BLOCKS ------------------------------------------------------------------------

  const addExercise = useCallback(
    async (exerciseId: string) => {
      const current = stateRef.current.blocks;
      if (current.some((b) => b.exerciseId === exerciseId) || !session) return;
      try {
        const row = await api.addSessionExercise({
          session_id: sessionId,
          exercise_id: exerciseId,
          position: current.length,
        });
        const [base, prev] = await Promise.all([
          api.listBaseline([exerciseId], sessionId),
          api.listPreviousSets([exerciseId], sessionId, session.date),
        ]);
        if (!isMounted()) return;
        setBaseline((b) => ({ ...b, ...base }));
        setPrevious((p) => ({ ...p, ...prev }));
        dispatch({
          type: 'addBlock',
          block: blockFor(
            row,
            [],
            slotsByExercise[exerciseId],
            prev,
            exercisesById[exerciseId]?.is_unilateral,
          ),
        });
      } catch (e) {
        fail(e, 'Could not add that exercise');
      }
    },
    [session, sessionId, slotsByExercise, exercisesById, isMounted, fail],
  );

  /** Remove a block and every set logged in it. The screen confirms first if any. */
  const removeExercise = useCallback(
    async (blockId: string) => {
      const block = stateRef.current.blocks.find((b) => b.id === blockId);
      if (!block) return;
      dispatch({ type: 'removeBlock', blockId });
      try {
        await api.removeSessionExercise({
          sessionId,
          exerciseId: block.exerciseId,
          blockId: block.sessionExercise?.id ?? null,
        });
      } catch (e) {
        fail(e, 'Could not remove that exercise');
        void load();
      }
    },
    [sessionId, fail, load],
  );

  const moveExercise = useCallback(
    async (blockId: string, delta: -1 | 1) => {
      const before = stateRef.current.blocks;
      const from = before.findIndex((b) => b.id === blockId);
      const to = from + delta;
      if (from < 0 || to < 0 || to >= before.length) return;
      dispatch({ type: 'moveBlock', blockId, delta });
      const order = [...before];
      [order[from], order[to]] = [order[to], order[from]];
      try {
        await api.reorderSessionExercises(
          order.flatMap((b) => (b.sessionExercise ? [b.sessionExercise.id] : [])),
        );
      } catch (e) {
        fail(e, 'Could not reorder');
        void load();
      }
    },
    [fail, load],
  );

  /**
   * Set a block's rest, and remember it on the exercise so next time starts
   * there too. null means "no rest timer" for this block.
   */
  const setRest = useCallback(
    async (blockId: string, seconds: number) => {
      const block = stateRef.current.blocks.find((b) => b.id === blockId);
      if (!block?.sessionExercise) return;
      dispatch({ type: 'updateBlock', blockId, patch: { rest_seconds: seconds } });
      setExercises((list) =>
        list.map((e) => (e.id === block.exerciseId ? { ...e, default_rest_seconds: seconds } : e)),
      );
      try {
        await Promise.all([
          api.updateSessionExercise(block.sessionExercise.id, { rest_seconds: seconds }),
          api.updateExercise(block.exerciseId, { default_rest_seconds: seconds }),
        ]);
      } catch (e) {
        fail(e, 'Could not save the rest time');
      }
    },
    [fail],
  );

  const setBlockNote = useCallback(
    async (blockId: string, note: string) => {
      const block = stateRef.current.blocks.find((b) => b.id === blockId);
      if (!block?.sessionExercise || block.sessionExercise.note === note) return;
      dispatch({ type: 'updateBlock', blockId, patch: { note } });
      try {
        await api.updateSessionExercise(block.sessionExercise.id, { note });
      } catch (e) {
        fail(e, 'Could not save the note');
      }
    },
    [fail],
  );

  /** Edit the exercise's pinned note from the session. */
  const setPinnedNote = useCallback(
    async (exerciseId: string, pinned_note: string) => {
      setExercises((list) => list.map((e) => (e.id === exerciseId ? { ...e, pinned_note } : e)));
      try {
        await api.updateExercise(exerciseId, { pinned_note });
      } catch (e) {
        fail(e, 'Could not save the pinned note');
      }
    },
    [fail],
  );

  // SESSION -----------------------------------------------------------------------

  const finish = useCallback(async (): Promise<boolean> => {
    try {
      const updated = await api.finishSession(sessionId);
      if (isMounted()) setSession(updated);
      return true;
    } catch (e) {
      fail(e, 'Could not finish the workout');
      return false;
    }
  }, [sessionId, isMounted, fail]);

  const reopen = useCallback(async () => {
    setSession((s) => (s ? { ...s, ended_at: null } : s));
    try {
      await api.reopenSession(sessionId);
    } catch (e) {
      fail(e, 'Could not reopen the workout');
    }
  }, [sessionId, fail]);

  /** Change the day a session belongs to - for logging a workout you forgot. */
  const setDate = useCallback(
    async (date: string) => {
      setSession((current) => (current ? { ...current, date } : current));
      try {
        await api.updateSession(sessionId, { date });
      } catch (e) {
        fail(e, 'Could not change the date');
      }
    },
    [sessionId, fail],
  );

  const saveNotes = useCallback(
    async (notes: string) => {
      setSession((current) => (current ? { ...current, notes } : current));
      try {
        await api.updateSession(sessionId, { notes });
      } catch (e) {
        fail(e, 'Could not save your notes');
      }
    },
    [sessionId, fail],
  );

  return {
    session,
    missing,
    blocks: state.blocks,
    exercises,
    exercisesById,
    bands,
    records,
    stats,
    /** Each exercise's sets from other sessions, for bests. */
    baseline,
    slotsByExercise,
    previousFor,
    ghostFor,
    targetFor,
    restFor,
    loading,
    error,
    clearError: () => setError(null),
    reload: load,
    tick,
    untick,
    removeRow,
    addRow,
    updateDraft,
    updateRow,
    addExercise,
    removeExercise,
    moveExercise,
    setRest,
    setBlockNote,
    setPinnedNote,
    finish,
    reopen,
    setDate,
    saveNotes,
  };
}
