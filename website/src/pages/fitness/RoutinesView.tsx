/**
 * RoutinesView - the Routines tab: templates that lay out a session.
 *
 * A routine holds no training; it is a named, ordered list of slots whose only
 * job is to lay out a session. Each mode lists its own routines - a routine's
 * mode is set when it is made, from the switch at the top. On a desktop every
 * routine shows its slots at once, which is most of what planning is.
 */
import { useCallback, useMemo, useState } from 'react';

import { todayISO } from '@app/core/date';
import * as api from '@app/modules/fitness/api';
import { MODE_LABEL } from '@app/modules/fitness/mode';
import type { Exercise, FitnessMode, Routine, RoutineExercise } from '@app/modules/fitness/types';

import { Icon } from '../../components/Icon';
import { useToast } from '../../components/Toast';
import { Empty, ErrorBanner, Spinner, useConfirm } from '../../components/ui';
import { useAsync } from '../../lib/useAsync';
import { plural, restLabel, supersetColor } from './format';
import type { FitnessNav } from './nav';
import { RoutineEditor } from './RoutineEditor';

/** "3 × 8–12", "3 × 20–30 s", "4 sets". */
function targetText(slot: RoutineExercise): string {
  const timed = slot.target_seconds_min !== null || slot.target_seconds_max !== null;
  const min = timed ? slot.target_seconds_min : slot.target_reps_min;
  const max = timed ? slot.target_seconds_max : slot.target_reps;
  const unit = timed ? ' s' : '';
  const range =
    min !== null && max !== null && min !== max
      ? `${min}–${max}${unit}`
      : (max ?? min) !== null
        ? `${max ?? min}${unit}`
        : null;
  if (slot.target_sets && range) return `${slot.target_sets} × ${range}`;
  if (slot.target_sets) return plural(slot.target_sets, 'set');
  return range ?? 'No target';
}

export function RoutinesView({ mode, nav }: { mode: FitnessMode; nav: FitnessNav }) {
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const [editing, setEditing] = useState<Routine | 'new' | null>(null);
  const [starting, setStarting] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [routines, exercises, ladders] = await Promise.all([
      api.listRoutines(),
      api.seedDefaultExercisesIfEmpty(),
      api.listLadders().catch(() => [] as api.Ladder[]),
    ]);
    const slots = Object.fromEntries(
      await Promise.all(
        routines.map(async (r) => [r.id, await api.listRoutineExercises(r.id)] as const),
      ),
    ) as Record<string, RoutineExercise[]>;
    return { routines, exercises, ladders, slots };
  }, []);
  const { data, loading, error, reload } = useAsync(load, 'fitness-routines');

  const routines = useMemo(
    () => (data?.routines ?? []).filter((r) => r.mode === mode),
    [data, mode],
  );
  const exerciseById = useMemo(
    () => new Map((data?.exercises ?? []).map((e) => [e.id, e])),
    [data],
  );
  const ladderById = useMemo(
    () => new Map((data?.ladders ?? []).map((l) => [l.progression.id, l])),
    [data],
  );

  const start = async (routine: Routine) => {
    setStarting(routine.id);
    try {
      const session = await api.startSession({
        date: todayISO(),
        mode: routine.mode,
        routine_id: routine.id,
      });
      nav.session(session.id);
    } catch (e) {
      toast.show({ message: e instanceof Error ? e.message : 'Could not start a workout' });
      setStarting(null);
    }
  };

  const remove = async (routine: Routine) => {
    const ok = await confirm(
      `Delete ${routine.name}?`,
      'Sessions you already logged from it are kept. This cannot be undone.',
    );
    if (!ok) return;
    try {
      await api.deleteRoutine(routine.id);
      await reload();
      toast.show({ message: `${routine.name} deleted` });
    } catch (e) {
      toast.show({ message: e instanceof Error ? e.message : 'Could not delete that routine' });
    }
  };

  if (loading && !data) return <Spinner center />;

  const slotTitle = (slot: RoutineExercise): { name: string; kind: string } => {
    if (slot.progression_id) {
      const ladder = ladderById.get(slot.progression_id);
      const rung = ladder?.steps.find((s) => s.id === ladder.progression.current_step_id);
      return {
        name: ladder?.progression.name ?? 'A removed ladder',
        kind: `Ladder · now ${rung ? (exerciseById.get(rung.exercise_id)?.name ?? 'a rung') : 'not started'}`,
      };
    }
    const exercise: Exercise | undefined = slot.exercise_id
      ? exerciseById.get(slot.exercise_id)
      : undefined;
    return { name: exercise?.name ?? 'A removed exercise', kind: '' };
  };

  return (
    <>
      <ErrorBanner message={error} />

      <div className="row-between fx-section-head">
        <h2 className="fx-h2">
          {MODE_LABEL[mode]} routines <span className="column-count">{routines.length}</span>
        </h2>
        <button type="button" className="btn" onClick={() => setEditing('new')}>
          <Icon name="plus" />
          New routine
        </button>
      </div>

      {routines.length === 0 ? (
        <div className="card">
          <Empty
            icon="checklist"
            title={`No ${MODE_LABEL[mode].toLowerCase()} routines yet`}
            message="A routine is a template: exercises (or ladders) in order, with sets, a rep range, rest and supersets. It logs nothing itself; it lays out a session."
            action={
              <button type="button" className="btn" onClick={() => setEditing('new')}>
                New routine
              </button>
            }
          />
        </div>
      ) : (
        <div className="fx-routine-grid">
          {routines.map((routine) => {
            const slots = data?.slots[routine.id] ?? [];
            return (
              <article
                key={routine.id}
                className="card fx-routine"
                aria-labelledby={`fx-r-${routine.id}`}
              >
                <header className="fx-routine-head">
                  <h3 id={`fx-r-${routine.id}`} className="fx-h3 grow">
                    {routine.name}
                  </h3>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => setEditing(routine)}
                    aria-label={`Edit ${routine.name}`}
                    title="Edit"
                  >
                    <Icon name="edit" />
                  </button>
                  <button
                    type="button"
                    className="icon-btn danger"
                    onClick={() => void remove(routine)}
                    aria-label={`Delete ${routine.name}`}
                    title="Delete"
                  >
                    <Icon name="trash" />
                  </button>
                </header>
                {slots.length === 0 ? (
                  <p className="muted fx-small">Nothing in it yet.</p>
                ) : (
                  <ol className="fx-slot-list">
                    {slots.map((slot) => {
                      const title = slotTitle(slot);
                      return (
                        <li key={slot.id}>
                          {slot.pair_group ? (
                            <span
                              className="fx-ss-tag"
                              style={{ color: supersetColor(slot.pair_group) }}
                              aria-label={`Superset ${slot.pair_group}`}
                            >
                              {slot.pair_group}
                            </span>
                          ) : null}
                          <span className="grow">
                            <span className="fx-slot-name">{title.name}</span>
                            {title.kind ? <span className="fx-row-sub">{title.kind}</span> : null}
                          </span>
                          <span className="numeric secondary fx-small">
                            {targetText(slot)}
                            {slot.rest_seconds ? ` · rest ${restLabel(slot.rest_seconds)}` : ''}
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                )}
                <button
                  type="button"
                  className="btn btn-secondary btn-sm fx-routine-start"
                  onClick={() => void start(routine)}
                  disabled={starting !== null}
                >
                  {starting === routine.id ? (
                    <span className="spinner" />
                  ) : (
                    <Icon name="play" size={12} />
                  )}
                  Start today
                </button>
              </article>
            );
          })}
        </div>
      )}

      {editing && data ? (
        <RoutineEditor
          routine={editing === 'new' ? null : editing}
          mode={editing === 'new' ? mode : editing.mode}
          exercises={data.exercises}
          ladders={data.ladders}
          initialSlots={editing === 'new' ? [] : (data.slots[editing.id] ?? [])}
          onClose={() => setEditing(null)}
          onSaved={(name) => {
            setEditing(null);
            toast.show({ message: `${name} saved` });
            void reload();
          }}
        />
      ) : null}

      {dialog}
    </>
  );
}
