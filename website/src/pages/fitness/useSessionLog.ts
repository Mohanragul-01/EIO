/**
 * useSessionLog - one training session being logged, on the website.
 *
 * The browser's twin of the phone's useWorkoutSession, and deliberately close
 * to it line for line. It cannot simply import that hook: any app file that
 * imports React resolves `react` from the app's node_modules, which would put
 * a second React in this bundle and break every hook. So the WIRING is written
 * again here, and every RULE is the app's own, imported unchanged:
 *
 *   what a row is and how it changes     sessionState.sessionReducer
 *   how a typed row becomes a set        sessionState.commitDraft
 *   the greyed values a row shows        sessionState.ghostValues + targets.nextTarget
 *   which set last time it compares with previous.matchPrevious
 *   what counts as a record              records.sessionRecords
 *   how much was lifted                  load.workingVolume
 *
 * SAVE AS YOU GO, as on the phone: ticking writes the set immediately and
 * Finish only stamps the end time. RECORDS ARE RECOMPUTED from the saved sets
 * and a baseline of every other session, so badges after a reload are exactly
 * the ones shown live. There is no rest timer here: rest is set and stored per
 * block, for the phone to count down.
 */
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';

import { todayISO } from '@app/core/date';
import * as api from '@app/modules/fitness/api';
import { initialDrafts, newDraft, type DraftRow } from '@app/modules/fitness/blocks';
import { toSetFact, workingVolume, type SetFact } from '@app/modules/fitness/load';
import { matchPrevious } from '@app/modules/fitness/previous';
import { ladderSlotTarget } from '@app/modules/fitness/progression';
import { sessionRecords, type RecordHit } from '@app/modules/fitness/records';
import {
  applyTarget,
  commitDraft,
  ghostValues,
  NO_GHOST,
  sessionReducer,
  type BlockState,
  type Ghost,
  type Row,
} from '@app/modules/fitness/sessionState';
import { nextTarget, type Target } from '@app/modules/fitness/targets';
import {
  nextSetNumber,
  type Band,
  type Exercise,
  type RoutineExercise,
  type SessionExercise,
  type SessionSet,
  type SetType,
  type WorkoutSession,
} from '@app/modules/fitness/types';

import { useAsync } from '../../lib/useAsync';

/** Rest when neither the block nor the exercise has one - the phone's default. */
export const DEFAULT_REST_SECONDS = 90;

export type TickResult =
  | { ok: true; set: SessionSet; records: RecordHit[]; exerciseId: string }
  | { ok: false; reason: string };

type Previous = Record<string, { date: string; sets: SetFact[] }>;

const NO_TARGET: Target = { weight: null, assist: null, reps: null, seconds: null, reason: null };

export const rowType = (row: Row): SetType =>
  row.kind === 'saved' ? row.set.set_type : row.draft.set_type;

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

/** Everything a session page needs, fetched together. */
type Loaded = {
  /** Null when the session no longer exists (deleted on the phone, say). */
  session: WorkoutSession | null;
  exercises: Exercise[];
  bands: Band[];
  baseline: Record<string, SetFact[]>;
  previous: Previous;
  slots: Record<string, RoutineExercise>;
  blocks: BlockState[];
};

async function fetchSession(sessionId: string): Promise<Loaded> {
  const [found, blockRows, sets, exerciseRows, bandRows] = await Promise.all([
    api.getSession(sessionId),
    api.listSessionExercises(sessionId),
    api.listSessionSets(sessionId),
    api.listExercises(),
    api.listBands(),
  ]);
  const empty = { baseline: {}, previous: {}, slots: {}, blocks: [] };
  if (!found) return { session: null, exercises: exerciseRows, bands: bandRows, ...empty };

  // Sets v2 logged without a block row get one now, after the existing blocks
  // in the order each was first logged - as the phone does.
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

  const [baseline, previous, slotRows] = await Promise.all([
    api.listBaseline(ids, sessionId),
    api.listPreviousSets(ids, sessionId, found.date),
    found.routine_id
      ? api.listRoutineExercises(found.routine_id).catch(() => [])
      : Promise.resolve([]),
  ]);

  const slots = Object.fromEntries(
    slotRows.flatMap((slot) => (slot.exercise_id ? [[slot.exercise_id, slot]] : [])),
  ) as Record<string, RoutineExercise>;
  // Ladder slots aim at their current rung: its restart point up to its goal.
  if (slotRows.some((slot) => slot.progression_id)) {
    const ladders = await api.listLadders().catch(() => []);
    for (const slot of slotRows) {
      const ladder = ladders.find((l) => l.progression.id === slot.progression_id);
      const rung = ladder?.steps.find((st) => st.id === ladder.progression.current_step_id);
      if (!rung || slots[rung.exercise_id]) continue;
      const target = ladderSlotTarget(rung);
      slots[rung.exercise_id] = {
        ...slot,
        exercise_id: rung.exercise_id,
        ...target,
        target_sets: slot.target_sets ?? target.target_sets,
      };
    }
  }

  return {
    session: found,
    exercises: exerciseRows,
    bands: bandRows,
    baseline,
    previous,
    slots,
    blocks: allBlocks.map((row) =>
      blockFor(
        row,
        sets,
        slots[row.exercise_id],
        previous,
        exerciseRows.find((e) => e.id === row.exercise_id)?.is_unilateral,
      ),
    ),
  };
}

export function useSessionLog(sessionId: string) {
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [bands, setBands] = useState<Band[]>([]);
  const [baseline, setBaseline] = useState<Record<string, SetFact[]>>({});
  const [previous, setPrevious] = useState<Previous>({});
  /** The routine's target per exercise; a ladder slot is keyed by its current rung. */
  const [slotsByExercise, setSlotsByExercise] = useState<Record<string, RoutineExercise>>({});
  const [state, dispatch] = useReducer(sessionReducer, { blocks: [] });
  const [actionError, setError] = useState<string | null>(null);
  /** A reload's error that was dismissed; a different one shows again. */
  const [dismissedLoadError, setDismissedLoadError] = useState<string | null>(null);

  // The fetch goes through the site's useAsync (its stale-response guard), and
  // each new answer is copied into the page's state DURING render, the moment
  // it arrives - the "adjust state when the input changes" pattern - so the
  // first paint after a load already shows the blocks.
  const loader = useCallback(() => fetchSession(sessionId), [sessionId]);
  const loaded = useAsync(loader, sessionId);
  const [applied, setApplied] = useState<Loaded | null>(null);
  if (loaded.data && loaded.data !== applied) {
    const data = loaded.data;
    setApplied(data);
    setSession(data.session);
    setExercises(data.exercises);
    setBands(data.bands);
    setBaseline(data.baseline);
    setPrevious(data.previous);
    setSlotsByExercise(data.slots);
    dispatch({ type: 'load', blocks: data.blocks });
  }
  const load = loaded.reload;
  const loading = applied === null && loaded.error === null;
  const missing = applied !== null && applied.session === null;
  const error = actionError ?? (loaded.error !== dismissedLoadError ? loaded.error : null);

  // Nothing lands after the page has gone.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // The latest state for async callbacks, which would otherwise read the
  // state of the render they were created in.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Rows with a save in flight, checked synchronously: a double click on a
  // tick cannot save the same set twice.
  const inFlight = useRef(new Set<string>());

  const exercisesById = useMemo(
    () => Object.fromEntries(exercises.map((e) => [e.id, e])) as Record<string, Exercise>,
    [exercises],
  );

  // DERIVED -----------------------------------------------------------------------

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
    const startedAt = session?.started_at ?? savedFacts[0]?.created_at ?? null;
    return {
      volume: workingVolume(savedFacts, exercisesById, session?.bodyweight_kg ?? null),
      workingSets: savedFacts.filter((s) => s.set_type !== 'warmup').length,
      startedAt: startedAt ? Date.parse(startedAt) : null,
      endedAt: session?.ended_at ? Date.parse(session.ended_at) : null,
    };
  }, [savedFacts, exercisesById, session]);

  /** Last time's set that row `index` of a block is compared with. */
  const previousFor = useCallback(
    (block: BlockState, index: number): SetFact | null =>
      matchPrevious(previous[block.exerciseId]?.sets ?? [], block.rows.map(rowType), index),
    [previous],
  );

  /** Last time's date for an exercise, for "last time 12 Oct". */
  const previousDate = useCallback(
    (exerciseId: string): string | null => previous[exerciseId]?.date ?? null,
    [previous],
  );

  /** What to aim for this session, by double progression, with its reason. */
  const targetFor = useCallback(
    (block: BlockState): Target => {
      const exercise = exercisesById[block.exerciseId];
      const last = previous[block.exerciseId];
      const slot = slotsByExercise[block.exerciseId];
      if (!exercise || !last) return NO_TARGET;
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
      if (!exercise || !row) return NO_GHOST;
      const type = rowType(row);
      const ghost = ghostValues({
        exercise,
        previous: previousFor(block, index),
        slot: slotsByExercise[block.exerciseId] ?? null,
        rowType: type,
      });
      // A progression target applies to working sets, with its own load.
      return applyTarget(ghost, targetFor(block), type);
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

  const fail = useCallback((e: unknown, fallback: string) => {
    if (mounted.current) setError(e instanceof Error ? e.message : fallback);
  }, []);

  // ROWS --------------------------------------------------------------------------

  const tick = useCallback(
    async (blockId: string, key: string): Promise<TickResult> => {
      const block = stateRef.current.blocks.find((b) => b.id === blockId);
      const index = block?.rows.findIndex((r) => r.key === key) ?? -1;
      const row = block?.rows[index];
      const exercise = block ? exercisesById[block.exerciseId] : undefined;
      if (!block || !row || row.kind !== 'draft' || !exercise || inFlight.current.has(key)) {
        return { ok: false, reason: '' };
      }

      const committed = commitDraft(row.draft, ghostFor(block, index), exercise);
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
        if (!mounted.current) return { ok: false, reason: '' };
        dispatch({ type: 'tickSaved', blockId, key, set });
        const facts = [...savedFacts, toSetFact(set)];
        const hits = sessionRecords(exercisesById, baseline, facts)[set.id] ?? [];
        return { ok: true, set, records: hits, exerciseId: block.exerciseId };
      } catch (e) {
        dispatch({ type: 'tickFailed', blockId, key });
        fail(e, 'Could not save that set');
        return { ok: false, reason: 'Could not save that set' };
      } finally {
        inFlight.current.delete(key);
      }
    },
    [sessionId, exercisesById, ghostFor, baseline, savedFacts, fail],
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
            if (!mounted.current) return;
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
    [sessionId, fail, load],
  );

  /** Add a row (with starting values, if given); a one-sided exercise gets a left and a right. */
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

  /** Change a row's type, RPE or clean flag. A saved set is updated in place. */
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
        if (!mounted.current) return;
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
    [session, sessionId, slotsByExercise, exercisesById, fail],
  );

  /** Remove a block and every set logged in it. The page confirms first if any. */
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
   * Put a block in a superset with another (partnerId), or take it out
   * (null). The pair share a letter, and the partner moves to sit after the
   * group's last member. A group left with one member is dissolved.
   */
  const setSuperset = useCallback(
    async (blockId: string, partnerId: string | null) => {
      const blocks = stateRef.current.blocks;
      const a = blocks.find((b) => b.id === blockId);
      if (!a?.sessionExercise) return;
      const groupOf = (b: BlockState) => b.sessionExercise?.superset_group ?? null;
      try {
        if (partnerId === null) {
          const group = groupOf(a);
          if (!group) return;
          const members = blocks.filter((b) => groupOf(b) === group);
          const clear = members.length <= 2 ? members : [a];
          clear.forEach((b) =>
            dispatch({ type: 'updateBlock', blockId: b.id, patch: { superset_group: null } }),
          );
          await Promise.all(
            clear.flatMap((b) =>
              b.sessionExercise
                ? [api.updateSessionExercise(b.sessionExercise.id, { superset_group: null })]
                : [],
            ),
          );
          return;
        }
        const b = blocks.find((x) => x.id === partnerId);
        if (!b?.sessionExercise) return;
        const used = new Set(blocks.map(groupOf).filter((g): g is string => !!g));
        const group =
          groupOf(a) ?? groupOf(b) ?? 'ABCDEFGH'.split('').find((l) => !used.has(l)) ?? 'A';
        dispatch({ type: 'updateBlock', blockId: a.id, patch: { superset_group: group } });
        dispatch({ type: 'updateBlock', blockId: b.id, patch: { superset_group: group } });

        const order = blocks.map((x) => x.id).filter((id) => id !== b.id);
        const lastMember = order.reduce((last, id, i) => {
          const member = blocks.find((x) => x.id === id);
          return id === a.id || (member && groupOf(member) === group) ? i : last;
        }, -1);
        order.splice(lastMember + 1, 0, b.id);
        dispatch({ type: 'reorderBlocks', ids: order });

        await Promise.all([
          api.updateSessionExercise(a.sessionExercise.id, { superset_group: group }),
          api.updateSessionExercise(b.sessionExercise.id, { superset_group: group }),
        ]);
        await api.reorderSessionExercises(
          order.flatMap((id) => {
            const block = blocks.find((x) => x.id === id);
            return block?.sessionExercise ? [block.sessionExercise.id] : [];
          }),
        );
      } catch (e) {
        fail(e, 'Could not change the superset');
        void load();
      }
    },
    [fail, load],
  );

  /** Swap a block's exercise for another. Only before anything is logged in it. */
  const replaceExercise = useCallback(
    async (blockId: string, exerciseId: string) => {
      const block = stateRef.current.blocks.find((b) => b.id === blockId);
      if (!block?.sessionExercise || !session) return;
      if (block.rows.some((r) => r.kind === 'saved')) return;
      try {
        await api.updateSessionExercise(block.sessionExercise.id, { exercise_id: exerciseId });
        const [base, prev] = await Promise.all([
          api.listBaseline([exerciseId], sessionId),
          api.listPreviousSets([exerciseId], sessionId, session.date),
        ]);
        if (!mounted.current) return;
        setBaseline((b) => ({ ...b, ...base }));
        setPrevious((p) => ({ ...p, ...prev }));
        dispatch({
          type: 'replaceBlock',
          blockId,
          block: blockFor(
            { ...block.sessionExercise, exercise_id: exerciseId },
            [],
            slotsByExercise[exerciseId],
            prev,
            exercisesById[exerciseId]?.is_unilateral,
          ),
        });
      } catch (e) {
        fail(e, 'Could not replace that exercise');
      }
    },
    [session, sessionId, slotsByExercise, exercisesById, fail],
  );

  /** A block's rest, also remembered on the exercise so next time starts there. */
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
      if (mounted.current) setSession(updated);
      return true;
    } catch (e) {
      fail(e, 'Could not finish the workout');
      return false;
    }
  }, [sessionId, fail]);

  const reopen = useCallback(async (): Promise<boolean> => {
    setSession((s) => (s ? { ...s, ended_at: null } : s));
    try {
      await api.reopenSession(sessionId);
      return true;
    } catch (e) {
      fail(e, 'Could not reopen the workout');
      return false;
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

  // Dismiss hides what is showing: an action's error, or a failed reload's.
  const loadError = loaded.error;
  const clearError = useCallback(() => {
    setError(null);
    setDismissedLoadError(loadError);
  }, [loadError]);

  return {
    session,
    missing,
    blocks: state.blocks,
    exercises,
    exercisesById,
    bands,
    records,
    stats,
    savedFacts,
    baseline,
    slotsByExercise,
    previousFor,
    previousDate,
    ghostFor,
    targetFor,
    restFor,
    loading,
    error,
    clearError,
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
    setSuperset,
    replaceExercise,
    setRest,
    setBlockNote,
    setPinnedNote,
    finish,
    reopen,
    setDate,
    saveNotes,
  };
}

export type SessionLog = ReturnType<typeof useSessionLog>;
