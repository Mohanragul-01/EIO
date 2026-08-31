/**
 * FitnessPage - log, plan and body, as three views of one screen.
 *
 * The phone has three tabs and pushes a whole screen to log a session. Here the
 * session you are logging sits beside the exercise's own history, so you can
 * see what you lifted last time while deciding what to lift now - which is the
 * question a training log exists to answer and the one thing a phone screen
 * physically cannot show at the same time as the input.
 *
 * All the training maths - PR detection, one-rep max, volume, BMI - is the
 * shared code from the app, unchanged.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { formatEventDate, todayISO } from '@app/core/date';
import * as api from '@app/modules/fitness/api';
import { groupItems } from '@app/modules/fitness/pickerItems';
import {
  bmi,
  bmiLabel,
  estimatedOneRepMax,
  formatSet,
  isPersonalRecord,
  MUSCLE_GROUPS,
  nextSetNumber,
  totalVolume,
  type Exercise,
  type Routine,
  type SessionSet,
  type WorkoutSession,
} from '@app/modules/fitness/types';

import { Icon } from '../components/Icon';
import { Shell } from '../components/Shell';
import {
  ChipPicker,
  Empty,
  ErrorBanner,
  Modal,
  Segmented,
  Spinner,
  Stat,
  TextField,
  useConfirm,
} from '../components/ui';
import { useAsync } from '../lib/useAsync';
import { TOOLTIP_STYLE } from '../components/chart';

type View = 'log' | 'plan' | 'body';

export function FitnessPage() {
  const [view, setView] = useState<View>('log');

  return (
    <Shell
      title="Fitness"
      subtitle="Sessions, routines and body metrics"
      actions={
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: 'log', label: 'Log' },
            { value: 'plan', label: 'Plan' },
            { value: 'body', label: 'Body' },
          ]}
        />
      }
    >
      {view === 'log' ? <LogView /> : view === 'plan' ? <PlanView /> : <BodyView />}
    </Shell>
  );
}

/* LOG ---------------------------------------------------------------------- */

function LogView() {
  const [openId, setOpenId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();

  const load = useCallback(async () => {
    const [sessions, routines, exercises] = await Promise.all([
      api.listSessions(),
      api.listRoutines(),
      // Seeds the starter library only when it is genuinely empty, so a first
      // visit is not a blank screen with no way forward.
      api.seedDefaultExercisesIfEmpty(),
    ]);
    return { sessions, routines, exercises };
  }, []);

  const { data, loading, error, reload } = useAsync(load, 'fitness-log');

  const sessions = data?.sessions ?? [];
  const exercises = data?.exercises ?? [];

  const start = async (routineId: string | null) => {
    setStarting(true);
    setActionError(null);
    try {
      // The session row is created BEFORE logging opens, so every set has a
      // parent. Holding an unsaved workout in memory loses the lot if the tab
      // closes mid-session.
      const session = await api.createSession({ date: todayISO(), routine_id: routineId, notes: '' });
      await reload();
      setOpenId(session.id);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not start a session');
    } finally {
      setStarting(false);
    }
  };

  const remove = async (session: WorkoutSession) => {
    if (!(await confirm('Delete workout', 'Every set in it is deleted too.'))) return;
    try {
      await api.deleteSession(session.id);
      await reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not delete that');
    }
  };

  // Resolved from the loaded list rather than stored, so an edit made in the
  // dialog is reflected the moment the list reloads.
  const openSession = sessions.find((s) => s.id === openId) ?? null;

  const weekCount = sessions.filter((s) => {
    const diff = (Date.now() - new Date(`${s.date}T00:00:00`).getTime()) / 86400000;
    return diff >= 0 && diff < 7;
  }).length;

  return (
    <>
      <ErrorBanner message={error ?? actionError} />

      <div className="row-between" style={{ marginBottom: 'var(--space-xl)' }}>
        <div className="row" style={{ gap: 'var(--space-2xl)' }}>
          <Stat label="This week" value={weekCount} sub="sessions" />
          <Stat label="All time" value={sessions.length} sub="sessions" />
        </div>

        <div className="row" style={{ gap: 'var(--space-sm)' }}>
          {(data?.routines ?? []).map((routine) => (
            <button
              key={routine.id}
              className="btn btn-secondary btn-sm"
              onClick={() => void start(routine.id)}
              disabled={starting}
            >
              <Icon name="play" size={11} /> {routine.name}
            </button>
          ))}
          <button className="btn" onClick={() => void start(null)} disabled={starting}>
            {starting ? <span className="spinner" /> : 'Freestyle'}
          </button>
        </div>
      </div>

      {loading && !data ? (
        <Spinner center />
      ) : sessions.length === 0 ? (
        <div className="card">
          <Empty
            icon="fitness"
            title="No workouts yet"
            message="Start a session and log sets as you go. Personal records are worked out from what you log."
          />
        </div>
      ) : (
        <div className="col" style={{ gap: 'var(--space-sm)' }}>
          {sessions.map((session) => (
            <SessionRow
              key={session.id}
              session={session}
              routineName={data?.routines.find((r) => r.id === session.routine_id)?.name}
              onOpen={() => setOpenId(session.id)}
              onDelete={() => void remove(session)}
            />
          ))}
        </div>
      )}

      {openSession ? (
        <SessionDialog
          // Keyed by id so switching between sessions remounts rather than
          // carrying the previous workout's sets into the next one.
          key={openSession.id}
          session={openSession}
          exercises={exercises}
          onClose={() => {
            setOpenId(null);
            void reload();
          }}
        />
      ) : null}

      {dialog}
    </>
  );
}

function SessionRow({
  session,
  routineName,
  onOpen,
  onDelete,
}: {
  session: WorkoutSession;
  routineName?: string;
  onOpen: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="list-row">
      <button
        onClick={onOpen}
        className="grow row"
        style={{ background: 'none', border: 0, padding: 0, textAlign: 'left', gap: 'var(--space-md)' }}
      >
        <div className="grow">
          <div style={{ fontSize: 13.5, fontWeight: 600 }}>
            {formatEventDate(session.date)}
            {routineName ? <span className="faint"> · {routineName}</span> : null}
          </div>
          {session.notes ? (
            <div className="faint truncate" style={{ fontSize: 12, maxWidth: 520 }}>
              {session.notes}
            </div>
          ) : null}
        </div>
      </button>

      <div className="row-actions">
        <button className="icon-btn" onClick={onOpen} aria-label="Open">
          <Icon name="edit" />
        </button>
        <button className="icon-btn danger" onClick={onDelete} aria-label="Delete">
          <Icon name="trash" />
        </button>
      </div>
    </div>
  );
}

/* SESSION ------------------------------------------------------------------ */

function SessionDialog({
  session,
  exercises,
  onClose,
}: {
  session: WorkoutSession;
  exercises: Exercise[];
  onClose: () => void;
}) {
  const [sets, setSets] = useState<SessionSet[]>([]);
  const [notes, setNotes] = useState(session.notes);
  const [savedNotes, setSavedNotes] = useState(session.notes);
  const [date, setDate] = useState(session.date);

  /**
   * The exercises showing in this session, in order.
   *
   * Held as its own state rather than derived from `sets`. Deriving it meant an
   * exercise you had picked but not yet logged a set for existed only while it
   * was the "active" one - so picking a second exercise made the first vanish,
   * taking the input you were about to use with it.
   */
  const [order, setOrder] = useState<string[]>([]);
  const [prIds, setPrIds] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const rows = await api.listSessionSets(session.id);
        if (!active) return;
        setSets(rows);

        // Whatever already has sets, in the order it was logged.
        const seen: string[] = [];
        rows.forEach((set) => {
          if (!seen.includes(set.exercise_id)) seen.push(set.exercise_id);
        });

        // Then the routine's own list, if this session came from one, so a
        // planned workout opens pre-filled instead of blank.
        if (session.routine_id) {
          try {
            const planned = await api.listRoutineExercises(session.routine_id);
            if (!active) return;
            planned.forEach((row) => {
              if (!seen.includes(row.exercise_id)) seen.push(row.exercise_id);
            });
          } catch {
            // A deleted routine leaves the session ad-hoc, which is fine.
          }
        }

        if (active) setOrder(seen);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Could not load this session');
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [session.id, session.routine_id]);

  const volume = totalVolume(sets);

  const logSet = async (exerciseId: string, reps: number, weightKg: number) => {
    setError(null);
    try {
      // History EXCLUDES this session, so a set is never compared against
      // itself or against its own warm-ups.
      const history = await api.listExerciseHistory(exerciseId, session.id);
      const isPr = isPersonalRecord(history, { exercise_id: exerciseId, reps, weight_kg: weightKg });

      const mine = sets.filter((s) => s.exercise_id === exerciseId);
      const saved = await api.addSet(session.id, {
        exercise_id: exerciseId,
        reps,
        weight_kg: weightKg,
        rpe: null,
        set_number: nextSetNumber(mine),
      });

      setSets((current) => [...current, saved]);

      if (isPr) {
        const previous = Math.max(...history.filter((h) => h.reps === reps).map((h) => h.weight_kg));
        setPrIds((current) => ({ ...current, [saved.id]: previous }));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that set');
    }
  };

  const removeSet = async (id: string) => {
    const snapshot = sets;
    setSets((current) => current.filter((s) => s.id !== id));
    try {
      await api.deleteSet(id);
    } catch (e) {
      setSets(snapshot);
      setError(e instanceof Error ? e.message : 'Could not delete that set');
    }
  };

  /**
   * Save notes on blur, and ONLY when they actually changed.
   *
   * The unconditional version was a data-loss bug: `notes` started empty and
   * was never seeded from the row, so opening an existing workout and merely
   * clicking in and out of the field wrote an empty string over whatever you
   * had written. Seeding from the session fixes the cause; comparing against
   * the last saved value also stops a pointless write on every focus change.
   */
  const saveNotes = async () => {
    if (notes === savedNotes) return;
    try {
      await api.updateSession(session.id, { notes });
      setSavedNotes(notes);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your notes');
    }
  };

  const changeDate = async (next: string) => {
    if (!next) return;
    setDate(next);
    try {
      await api.updateSession(session.id, { date: next });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not change the date');
    }
  };

  const addExercise = (id: string) =>
    setOrder((current) => (current.includes(id) ? current : [...current, id]));

  const dismissExercise = (id: string) =>
    // Only removes it from the view. Sets are deleted one at a time and on
    // purpose, so this can never take logged work with it.
    setOrder((current) => current.filter((x) => x !== id));

  return (
    <Modal open title="Workout" onClose={onClose} width={1000}>
      <ErrorBanner message={error} />

      <div className="row-between wrap" style={{ gap: 'var(--space-lg)' }}>
        <div className="row" style={{ gap: 'var(--space-2xl)' }}>
          <label className="field" style={{ gap: 2 }}>
            <span className="label">Date</span>
            <input
              className="input"
              type="date"
              value={date}
              onChange={(e) => void changeDate(e.target.value)}
              style={{ width: 160 }}
            />
          </label>
          <Stat label="Volume" value={volume.toLocaleString('en-IN') + ' kg'} sub="moved" />
          <Stat label="Sets" value={sets.length} sub="logged" />
        </div>
        <RestTimer />
      </div>

      <div className="split" style={{ gridTemplateColumns: 'minmax(0,1fr) 290px' }}>
        <div className="col" style={{ gap: 'var(--space-md)' }}>
          {loading ? (
            <Spinner center />
          ) : order.length === 0 ? (
            <Empty
              title="No exercises yet"
              message="Pick one from the list to start logging sets."
            />
          ) : (
            order.map((exerciseId) => (
              <ExerciseBlock
                key={exerciseId}
                exercise={exercises.find((e) => e.id === exerciseId)}
                sets={sets.filter((s) => s.exercise_id === exerciseId)}
                prIds={prIds}
                onLog={(reps, weight) => void logSet(exerciseId, reps, weight)}
                onRemove={(id) => void removeSet(id)}
                onDismiss={() => dismissExercise(exerciseId)}
              />
            ))
          )}

          <label className="field">
            <span className="label">Session notes</span>
            <textarea
              className="input"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => void saveNotes()}
              placeholder="How did it go?"
              rows={2}
            />
          </label>
        </div>

        <div className="col" style={{ gap: 'var(--space-sm)' }}>
          <div className="overline">Add an exercise</div>
          <ExerciseChooser exercises={exercises} chosen={order} onPick={addExercise} />
        </div>
      </div>
    </Modal>
  );
}

/** Searchable exercise list for the session pane. */
function ExerciseChooser({
  exercises,
  chosen,
  onPick,
}: {
  exercises: Exercise[];
  chosen: string[];
  onPick: (id: string) => void;
}) {
  const [query, setQuery] = useState('');

  // The shared grouping the app's picker uses: matches the muscle group too,
  // so typing "legs" finds the squat, and "Other" sinks to the bottom.
  const sections = useMemo(
    () =>
      groupItems(
        exercises.map((exercise) => ({
          id: exercise.id,
          label: exercise.name,
          group: exercise.muscle_group,
          disabled: chosen.includes(exercise.id),
        })),
        query,
      ),
    [exercises, chosen, query],
  );

  return (
    <>
      <input
        className="input"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search exercises"
      />

      <div className="col" style={{ gap: 4, maxHeight: 380, overflowY: 'auto', paddingRight: 4 }}>
        {sections.length === 0 ? (
          <p className="faint" style={{ fontSize: 12.5, padding: 'var(--space-md) 0' }}>
            Nothing matches that search.
          </p>
        ) : (
          sections.map((section) => (
            <div key={section.group}>
              <div className="overline" style={{ marginTop: 'var(--space-sm)', marginBottom: 4 }}>
                {section.group}
              </div>
              {section.items.map((item) => (
                <button
                  key={item.id}
                  className="list-row"
                  style={{
                    padding: '7px 11px',
                    width: '100%',
                    opacity: item.disabled ? 0.45 : 1,
                    cursor: item.disabled ? 'default' : 'pointer',
                    textAlign: 'left',
                    marginBottom: 3,
                  }}
                  disabled={item.disabled}
                  onClick={() => onPick(item.id)}
                >
                  <span className="grow" style={{ fontSize: 12.5 }}>
                    {item.label}
                  </span>
                  <span className="faint" style={{ fontSize: 11 }}>
                    {item.disabled ? 'added' : '+'}
                  </span>
                </button>
              ))}
            </div>
          ))
        )}
      </div>
    </>
  );
}


function ExerciseBlock({
  exercise,
  sets,
  prIds,
  onLog,
  onRemove,
  onDismiss,
}: {
  exercise: Exercise | undefined;
  sets: SessionSet[];
  prIds: Record<string, number>;
  onLog: (reps: number, weight: number) => void;
  onRemove: (id: string) => void;
  onDismiss: () => void;
}) {
  const last = sets[sets.length - 1];
  const [weight, setWeight] = useState(last ? String(last.weight_kg) : '');
  const [reps, setReps] = useState(last ? String(last.reps) : '');

  const submit = () => {
    const w = Number(weight.trim());
    const r = Number(reps.trim());
    // Weight of 0 is valid (bodyweight); reps of 0 is not a set.
    if (!Number.isFinite(w) || w < 0) return;
    if (!Number.isInteger(r) || r <= 0) return;
    onLog(r, w);
  };

  return (
    <div className="card card-pad">
      <div className="row-between" style={{ marginBottom: 'var(--space-md)' }}>
        <span style={{ fontWeight: 600, fontSize: 13.5 }}>{exercise?.name ?? 'Exercise'}</span>

        {/*
          Only offered while the block is empty. Once sets exist, removing it
          from the view would hide logged work behind no obvious way back, so
          those are deleted set by set instead.
        */}
        {sets.length === 0 ? (
          <button
            className="icon-btn"
            onClick={onDismiss}
            title="Remove from this session"
            aria-label="Remove from this session"
          >
            <Icon name="close" />
          </button>
        ) : null}
      </div>

      {sets.map((set, index) => (
        <div className="row" key={set.id} style={{ gap: 'var(--space-md)', padding: '4px 0' }}>
          {/* Position, not set.set_number: deleting a middle set leaves a gap
              in the stored number, and showing "1, 3, 4" would read as a bug. */}
          <span className="faint numeric" style={{ width: 18 }}>
            {index + 1}
          </span>
          <span className="numeric grow" style={{ fontSize: 13 }}>
            {formatSet(set.weight_kg, set.reps)}
          </span>
          {prIds[set.id] !== undefined ? (
            <span
              className="pill"
              style={{
                background: 'color-mix(in srgb, var(--warning) 16%, transparent)',
                color: 'var(--warning)',
              }}
            >
              PR · was {prIds[set.id]}
            </span>
          ) : null}
          <button className="icon-btn danger" onClick={() => onRemove(set.id)} aria-label="Remove set">
            <Icon name="close" />
          </button>
        </div>
      ))}

      <div className="row" style={{ gap: 'var(--space-sm)', marginTop: 'var(--space-md)' }}>
        <input
          className="input"
          style={{ width: 96 }}
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          placeholder="kg"
          inputMode="decimal"
        />
        <span className="faint"><Icon name="close" /></span>
        <input
          className="input"
          style={{ width: 80 }}
          value={reps}
          onChange={(e) => setReps(e.target.value)}
          placeholder="reps"
          inputMode="numeric"
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
        />
        <button className="btn btn-sm" onClick={submit}>
          Log set
        </button>
      </div>
    </div>
  );
}

/* REST TIMER --------------------------------------------------------------- */

/**
 * Counts down to a stored DEADLINE rather than decrementing a number.
 *
 * Browsers throttle timers in a background tab, so a counter that subtracts one
 * per tick drifts badly the moment you switch away - which is exactly what you
 * do while resting. Recomputing from the clock means the display is correct
 * whenever it next renders, however long the gap was.
 */
function RestTimer() {
  const [deadline, setDeadline] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (deadline === null) return;

    const tick = () => {
      const left = Math.ceil((deadline - Date.now()) / 1000);
      setRemaining(Math.max(0, left));
      if (left <= 0) setDeadline(null);
    };

    tick(); // immediately, so the first second is not blank
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [deadline]);

  const start = (seconds: number) => {
    // Tapping a running timer ADDS time rather than restarting: mid-rest you
    // want thirty more seconds, not to start again from the top.
    const base = deadline !== null && deadline > Date.now() ? deadline : Date.now();
    setDeadline(base + seconds * 1000);
  };

  if (deadline === null) {
    return (
      <div className="row" style={{ gap: 6 }}>
        <span className="faint" style={{ fontSize: 12 }}>
          Rest
        </span>
        {[60, 90, 120, 180].map((seconds) => (
          <button key={seconds} className="chip" onClick={() => start(seconds)}>
            {seconds < 120 ? `${seconds}s` : `${seconds / 60}m`}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="row" style={{ gap: 'var(--space-sm)' }}>
      <span className="numeric" style={{ fontSize: 20, fontWeight: 700, color: 'var(--primary)' }}>
        {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}
      </span>
      <button className="chip" onClick={() => start(30)}>
        +30s
      </button>
      <button className="chip" onClick={() => setDeadline(null)}>
        Stop
      </button>
    </div>
  );
}

/* PLAN --------------------------------------------------------------------- */

function PlanView() {
  const [error, setError] = useState<string | null>(null);
  const [newExercise, setNewExercise] = useState('');
  const [group, setGroup] = useState<string>(MUSCLE_GROUPS[0]);
  const [progressFor, setProgressFor] = useState<Exercise | null>(null);
  const [renaming, setRenaming] = useState<Exercise | null>(null);
  const [editingRoutine, setEditingRoutine] = useState<Routine | 'new' | null>(null);
  const { confirm, dialog } = useConfirm();

  const load = useCallback(async () => {
    const [exercises, routines] = await Promise.all([
      api.seedDefaultExercisesIfEmpty(),
      api.listRoutines(),
    ]);
    return { exercises, routines };
  }, []);

  const { data, loading, reload } = useAsync(load, 'fitness-plan');

  const add = async () => {
    const name = newExercise.trim();
    if (!name) return;
    setError(null);
    try {
      await api.createExercise({ name, muscle_group: group });
      setNewExercise('');
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add that exercise');
    }
  };

  const rename = async (exercise: Exercise, name: string, muscleGroup: string) => {
    // The KEY thing a rename must not do is orphan history: session_sets
    // reference the exercise by id, so the name is only a label and changing
    // it keeps every set and every personal record attached.
    await api.updateExercise(exercise.id, { name: name.trim(), muscle_group: muscleGroup });
    setRenaming(null);
    await reload();
  };

  const removeExercise = async (exercise: Exercise) => {
    if (!(await confirm('Delete exercise', `Remove ${exercise.name}?`))) return;
    setError(null);
    try {
      await api.deleteExercise(exercise.id);
      await reload();
    } catch (e) {
      // Translated by the api: an exercise with logged sets cannot be deleted,
      // because that history is what every PR is measured against.
      setError(e instanceof Error ? e.message : 'Could not delete that exercise');
    }
  };

  const removeRoutine = async (routine: Routine) => {
    if (!(await confirm('Delete routine', 'Sessions you already logged from it are kept.'))) return;
    try {
      await api.deleteRoutine(routine.id);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete that routine');
    }
  };

  const byGroup = useMemo(() => {
    const groups = new Map<string, Exercise[]>();
    (data?.exercises ?? []).forEach((exercise) => {
      const key = exercise.muscle_group?.trim() || 'Other';
      (groups.get(key) ?? groups.set(key, []).get(key)!).push(exercise);
    });
    return [...groups.entries()].sort(([a], [b]) =>
      a === 'Other' ? 1 : b === 'Other' ? -1 : a.localeCompare(b),
    );
  }, [data]);

  if (loading && !data) return <Spinner center />;

  return (
    <>
      <ErrorBanner message={error} />

      <div className="split">
        <div className="col" style={{ gap: 'var(--space-lg)' }}>
          <div className="row-between">
            <span className="column-title">Exercise library</span>
            <span className="column-count">{data?.exercises.length ?? 0}</span>
          </div>

          {byGroup.map(([groupName, items]) => (
            <div key={groupName}>
              <div className="overline" style={{ marginBottom: 'var(--space-sm)' }}>
                {groupName}
              </div>
              <div className="col" style={{ gap: 4 }}>
                {items.map((exercise) => (
                  <div className="list-row bordered" key={exercise.id}>
                    <button
                      className="grow"
                      style={{ background: 'none', border: 0, padding: 0, textAlign: 'left' }}
                      onClick={() => setProgressFor(exercise)}
                    >
                      <span style={{ fontSize: 13 }}>{exercise.name}</span>
                    </button>
                    <div className="row-actions">
                      <button
                        className="icon-btn"
                        onClick={() => setProgressFor(exercise)}
                        aria-label="Progress"
                        title="Progress"
                      >
                        <Icon name="trend" />
                      </button>
                      <button
                        className="icon-btn"
                        onClick={() => setRenaming(exercise)}
                        aria-label="Rename"
                        title="Rename"
                      >
                        <Icon name="edit" />
                      </button>
                      <button
                        className="icon-btn danger"
                        onClick={() => void removeExercise(exercise)}
                        aria-label="Delete"
                        title="Delete"
                      >
                        <Icon name="trash" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="card card-pad">
            <div className="overline" style={{ marginBottom: 'var(--space-md)' }}>
              Add an exercise
            </div>
            <div className="row" style={{ gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
              <input
                className="input grow"
                value={newExercise}
                onChange={(e) => setNewExercise(e.target.value)}
                placeholder="Name"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void add();
                }}
              />
              <button className="btn" onClick={() => void add()} disabled={!newExercise.trim()}>
                Add
              </button>
            </div>
            <ChipPicker
              value={group}
              onChange={setGroup}
              options={MUSCLE_GROUPS.map((g) => ({ value: g, label: g }))}
            />
          </div>
        </div>

        <div className="col" style={{ gap: 'var(--space-lg)' }}>
          <div className="row-between">
            <span className="column-title">Routines</span>
            <button className="btn btn-secondary btn-sm" onClick={() => setEditingRoutine('new')}>
              <Icon name="plus" /> New
            </button>
          </div>

          {(data?.routines ?? []).length === 0 ? (
            <div className="card">
              <Empty
                title="No routines"
                message="A routine is a template. It logs nothing itself; it pre-fills a session."
              />
            </div>
          ) : (
            <div className="col" style={{ gap: 'var(--space-sm)' }}>
              {(data?.routines ?? []).map((routine) => (
                <div className="list-row bordered" key={routine.id}>
                  <span className="grow" style={{ fontSize: 13, fontWeight: 500 }}>
                    {routine.name}
                  </span>
                  <div className="row-actions">
                    <button
                      className="icon-btn"
                      onClick={() => setEditingRoutine(routine)}
                      aria-label="Edit"
                    >
                      <Icon name="edit" />
                    </button>
                    <button
                      className="icon-btn danger"
                      onClick={() => void removeRoutine(routine)}
                      aria-label="Delete"
                    >
                      <Icon name="trash" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {progressFor ? (
        <ProgressDialog exercise={progressFor} onClose={() => setProgressFor(null)} />
      ) : null}

      {renaming ? (
        <ExerciseDialog
          exercise={renaming}
          onClose={() => setRenaming(null)}
          onSave={(name, group) => rename(renaming, name, group)}
        />
      ) : null}

      {editingRoutine ? (
        <RoutineDialog
          routine={editingRoutine === 'new' ? null : editingRoutine}
          exercises={data?.exercises ?? []}
          onClose={() => setEditingRoutine(null)}
          onSaved={() => {
            setEditingRoutine(null);
            void reload();
          }}
        />
      ) : null}

      {dialog}
    </>
  );
}

/** Rename an exercise, or move it to a different muscle group. */
function ExerciseDialog({
  exercise,
  onClose,
  onSave,
}: {
  exercise: Exercise;
  onClose: () => void;
  onSave: (name: string, muscleGroup: string) => Promise<void>;
}) {
  const [name, setName] = useState(exercise.name);
  const [group, setGroup] = useState<string>(exercise.muscle_group ?? MUSCLE_GROUPS[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!name.trim()) return setError('Give it a name');
    setSaving(true);
    setError(null);
    try {
      await onSave(name, group);
    } catch (e) {
      // The unique constraint on (user, name) surfaces here, which is the
      // useful failure: two exercises with one name would split the PR history
      // across them without that being visible anywhere.
      setError(
        e instanceof Error && e.message.includes('duplicate')
          ? 'You already have an exercise with that name.'
          : e instanceof Error
            ? e.message
            : 'Could not rename that',
      );
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      title="Edit exercise"
      onClose={onClose}
      width={460}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" onClick={() => void save()} disabled={saving}>
            {saving ? <span className="spinner" /> : 'Save'}
          </button>
        </>
      }
    >
      <TextField
        label="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter') void save();
        }}
      />
      <ChipPicker
        label="Muscle group"
        value={group}
        onChange={setGroup}
        options={MUSCLE_GROUPS.map((g) => ({ value: g, label: g }))}
      />
      <p className="faint" style={{ fontSize: 12 }}>
        Renaming is safe. Sets reference this exercise by id, so every logged set and personal
        record stays attached.
      </p>
      <ErrorBanner message={error} />
    </Modal>
  );
}

/* PROGRESS ----------------------------------------------------------------- */

function ProgressDialog({ exercise, onClose }: { exercise: Exercise; onClose: () => void }) {
  const load = useCallback(() => api.listExerciseProgress(exercise.id), [exercise.id]);
  const { data, loading, error } = useAsync(load, `progress-${exercise.id}`);

  const points = data ?? [];

  /**
   * Best set per day, ranked by estimated one-rep max rather than raw weight.
   * Ranking by weight alone would make dropping the reps look like progress.
   */
  const daily = useMemo(() => {
    const best = new Map<string, { date: string; oneRm: number; weight: number; reps: number }>();
    points.forEach((point) => {
      const oneRm = estimatedOneRepMax(point.weight_kg, point.reps);
      const existing = best.get(point.date);
      if (!existing || oneRm > existing.oneRm) {
        best.set(point.date, { date: point.date, oneRm: Math.round(oneRm * 10) / 10, weight: point.weight_kg, reps: point.reps });
      }
    });
    return [...best.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [points]);

  const heaviest = points.reduce((top, p) => Math.max(top, p.weight_kg), 0);

  return (
    <Modal open title={exercise.name} onClose={onClose} width={720}>
      <ErrorBanner message={error} />

      {loading ? (
        <Spinner center />
      ) : daily.length < 2 ? (
        <Empty
          title="Not enough history"
          message="Log this exercise on at least two different days and the trend appears here."
        />
      ) : (
        <>
          <div className="stat-row">
            <Stat label="Heaviest" value={`${heaviest} kg`} sub="single set" />
            <Stat label="Sessions" value={daily.length} sub="days logged" />
            <Stat
              label="Best e1RM"
              value={`${Math.max(...daily.map((d) => d.oneRm))} kg`}
              sub="estimated"
            />
          </div>

          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={daily} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                tickFormatter={(d: string) => formatEventDate(d)}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'var(--text-faint)' }}
                axisLine={false}
                tickLine={false}
                domain={['dataMin - 5', 'dataMax + 5']}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelFormatter={(d) => formatEventDate(String(d))}
                formatter={(value) => [`${value} kg`, 'Estimated 1RM']}
              />
              <Line
                type="monotone"
                dataKey="oneRm"
                stroke="var(--primary)"
                strokeWidth={2}
                dot={{ r: 3, fill: 'var(--primary)' }}
              />
            </LineChart>
          </ResponsiveContainer>

          <p className="faint" style={{ fontSize: 12 }}>
            Ranked by estimated one-rep max, not raw weight — otherwise dropping the reps would
            always look like progress.
          </p>
        </>
      )}
    </Modal>
  );
}

/* ROUTINE ------------------------------------------------------------------ */

function RoutineDialog({
  routine,
  exercises,
  onClose,
  onSaved,
}: {
  routine: Routine | null;
  exercises: Exercise[];
  onClose: () => void;
  onSaved: () => void;
}) {
  /** One row per chosen exercise, in order, with its optional targets. */
  type Entry = { exercise_id: string; sets: string; reps: string };

  const [name, setName] = useState(routine?.name ?? '');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(routine === null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!routine) return;
    let active = true;

    api
      .listRoutineExercises(routine.id)
      .then((rows) => {
        if (!active) return;
        setEntries(
          rows.map((row) => ({
            exercise_id: row.exercise_id,
            sets: row.target_sets === null ? '' : String(row.target_sets),
            reps: row.target_reps === null ? '' : String(row.target_reps),
          })),
        );
        setLoaded(true);
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : 'Could not load that routine');
      });

    return () => {
      active = false;
    };
  }, [routine]);

  const chosen = entries.map((entry) => entry.exercise_id);

  const toggle = (id: string) =>
    setEntries((current) =>
      current.some((entry) => entry.exercise_id === id)
        ? current.filter((entry) => entry.exercise_id !== id)
        : [...current, { exercise_id: id, sets: '', reps: '' }],
    );

  const patch = (id: string, change: Partial<Entry>) =>
    setEntries((current) =>
      current.map((entry) => (entry.exercise_id === id ? { ...entry, ...change } : entry)),
    );

  /** Position IS the order a session is pre-filled in, so it has to be editable. */
  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= entries.length) return;
    setEntries((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const sections = useMemo(
    () =>
      groupItems(
        exercises.map((exercise) => ({
          id: exercise.id,
          label: exercise.name,
          group: exercise.muscle_group,
        })),
        query,
      ),
    [exercises, query],
  );

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) return setError('Give the routine a name');
    if (entries.length === 0) return setError('A routine with nothing in it would pre-fill nothing');

    setSaving(true);
    setError(null);
    try {
      await api.saveRoutine(
        { id: routine?.id, name: trimmed },
        entries.map((entry) => ({
          exercise_id: entry.exercise_id,
          // Blank means "no target", which is different from zero. null keeps
          // that distinction in the database rather than flattening it.
          target_sets: entry.sets.trim() ? Number(entry.sets) : null,
          target_reps: entry.reps.trim() ? Number(entry.reps) : null,
        })),
      );
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that routine');
      setSaving(false);
    }
  };

  const nameOf = (id: string) => exercises.find((e) => e.id === id)?.name ?? 'Exercise';

  return (
    <Modal
      open
      title={routine ? 'Edit routine' : 'New routine'}
      onClose={onClose}
      width={720}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" onClick={() => void save()} disabled={saving || !loaded}>
            {saving ? <span className="spinner" /> : 'Save'}
          </button>
        </>
      }
    >
      <TextField
        label="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Push day, Legs, Full body…"
        autoFocus
      />

      <div className="split" style={{ gridTemplateColumns: 'minmax(0,1fr) 260px' }}>
        <div className="field">
          <span className="label">In this routine ({entries.length})</span>

          {entries.length === 0 ? (
            <p className="faint" style={{ fontSize: 12.5 }}>
              Pick exercises on the right. Targets are optional — leave them blank if you just want
              the exercise pre-filled.
            </p>
          ) : (
            <div className="col" style={{ gap: 6 }}>
              {entries.map((entry, index) => (
                <div
                  key={entry.exercise_id}
                  className="row"
                  style={{ gap: 'var(--space-sm)', alignItems: 'center' }}
                >
                  <div className="col" style={{ gap: 0 }}>
                    <button
                      className="icon-btn"
                      style={{ height: 16, width: 20 }}
                      onClick={() => move(index, -1)}
                      disabled={index === 0}
                      aria-label="Move up"
                    >
                      <Icon name="chevronUp" size={12} />
                    </button>
                    <button
                      className="icon-btn"
                      style={{ height: 16, width: 20 }}
                      onClick={() => move(index, 1)}
                      disabled={index === entries.length - 1}
                      aria-label="Move down"
                    >
                      <Icon name="chevronDown" size={12} />
                    </button>
                  </div>

                  <span className="grow truncate" style={{ fontSize: 13 }}>
                    {nameOf(entry.exercise_id)}
                  </span>

                  <input
                    className="input"
                    style={{ width: 64 }}
                    value={entry.sets}
                    onChange={(e) => patch(entry.exercise_id, { sets: e.target.value })}
                    placeholder="sets"
                    inputMode="numeric"
                    aria-label={`Target sets for ${nameOf(entry.exercise_id)}`}
                  />
                  <input
                    className="input"
                    style={{ width: 64 }}
                    value={entry.reps}
                    onChange={(e) => patch(entry.exercise_id, { reps: e.target.value })}
                    placeholder="reps"
                    inputMode="numeric"
                    aria-label={`Target reps for ${nameOf(entry.exercise_id)}`}
                  />

                  <button
                    className="icon-btn danger"
                    onClick={() => toggle(entry.exercise_id)}
                    aria-label="Remove"
                  >
                    <Icon name="close" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="field">
          <span className="label">Add</span>
          <input
            className="input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
          />
          <div className="col" style={{ gap: 3, maxHeight: 300, overflowY: 'auto', marginTop: 6 }}>
            {sections.map((section) => (
              <div key={section.group}>
                <div className="overline" style={{ marginTop: 6, marginBottom: 3 }}>
                  {section.group}
                </div>
                {section.items.map((item) => {
                  const on = chosen.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      className="list-row"
                      style={{
                        padding: '6px 10px',
                        width: '100%',
                        textAlign: 'left',
                        marginBottom: 3,
                        opacity: on ? 0.5 : 1,
                      }}
                      onClick={() => toggle(item.id)}
                    >
                      <span className="grow" style={{ fontSize: 12.5 }}>
                        {item.label}
                      </span>
                      <span className="faint" style={{ fontSize: 11 }}>
                        {on ? 'added' : '+'}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <ErrorBanner message={error} />
    </Modal>
  );
}

/* BODY --------------------------------------------------------------------- */

function BodyView() {
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [profile, metrics] = await Promise.all([api.getProfile(), api.listBodyMetrics()]);
    setHeight(profile.height_cm ? String(profile.height_cm) : '');
    return { profile, metrics };
  }, []);

  const { data, loading, reload } = useAsync(load, 'fitness-body');

  const metrics = data?.metrics ?? [];
  const latest = metrics[0];
  // Never stored: BMI is fully determined by weight and height, and a stored
  // copy goes stale while looking just as authoritative.
  const currentBmi = latest ? bmi(latest.weight_kg, data?.profile.height_cm ?? null) : null;

  const chart = useMemo(
    () => [...metrics].reverse().map((m) => ({ date: m.date, weight: m.weight_kg })),
    [metrics],
  );

  const record = async () => {
    const value = Number(weight.trim());
    if (!Number.isFinite(value) || value <= 0) return setError('Enter a weight above zero');
    setError(null);
    try {
      await api.recordWeight(todayISO(), value);
      setWeight('');
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that');
    }
  };

  const saveHeight = async () => {
    const value = height.trim() ? Number(height.trim()) : null;
    if (value !== null && (!Number.isFinite(value) || value <= 0)) return;
    try {
      await api.setHeight(value);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your height');
    }
  };

  if (loading && !data) return <Spinner center />;

  return (
    <>
      <ErrorBanner message={error} />

      <div className="split">
        <div className="card card-pad rise">
          {chart.length < 2 ? (
            <Empty
              title="Not enough weigh-ins"
              message="Record your weight on two different days and the trend appears here."
            />
          ) : (
            <>
              <div className="overline" style={{ marginBottom: 'var(--space-md)' }}>
                Weight
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={chart} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                    tickFormatter={(d: string) => formatEventDate(d)}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: 'var(--text-faint)' }}
                    axisLine={false}
                    tickLine={false}
                    domain={['dataMin - 2', 'dataMax + 2']}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    labelFormatter={(d) => formatEventDate(String(d))}
                    formatter={(value) => [`${value} kg`, 'Weight']}
                  />
                  <Line
                    type="monotone"
                    dataKey="weight"
                    stroke="var(--accent-emerald)"
                    strokeWidth={2}
                    dot={{ r: 3, fill: 'var(--accent-emerald)' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </>
          )}
        </div>

        <div className="col" style={{ gap: 'var(--space-lg)' }}>
          <div className="card card-pad">
            <div className="stat-row">
              <Stat
                label="Weight"
                value={latest ? `${latest.weight_kg} kg` : '—'}
                sub={latest ? formatEventDate(latest.date) : 'Not recorded'}
              />
              <Stat
                label="BMI"
                value={currentBmi ? currentBmi.toFixed(1) : '—'}
                sub={currentBmi ? bmiLabel(currentBmi) : 'Needs height'}
              />
            </div>
          </div>

          <div className="card card-pad">
            <div className="overline" style={{ marginBottom: 'var(--space-md)' }}>
              Today's weigh-in
            </div>
            <div className="row" style={{ gap: 'var(--space-sm)' }}>
              <input
                className="input grow"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder={latest ? String(latest.weight_kg) : 'kg'}
                inputMode="decimal"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void record();
                }}
              />
              <button className="btn" onClick={() => void record()}>
                Save
              </button>
            </div>
            <p className="faint" style={{ fontSize: 12, marginTop: 'var(--space-sm)' }}>
              One weigh-in per day. Saving again replaces today's rather than adding a second.
            </p>
          </div>

          <div className="card card-pad">
            <TextField
              label="Height (cm)"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              onBlur={() => void saveHeight()}
              placeholder="175"
              inputMode="decimal"
              hint="Stored once on your profile, not on every weigh-in."
            />
          </div>
        </div>
      </div>
    </>
  );
}
