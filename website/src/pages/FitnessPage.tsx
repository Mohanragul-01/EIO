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
              className="btn btn-glass btn-sm"
              onClick={() => void start(routine.id)}
              disabled={starting}
            >
              ▶ {routine.name}
            </button>
          ))}
          <button className="btn" onClick={() => void start(null)} disabled={starting}>
            {starting ? <span className="spinner" /> : '＋ Freestyle'}
          </button>
        </div>
      </div>

      {loading && !data ? (
        <Spinner center />
      ) : sessions.length === 0 ? (
        <div className="card">
          <Empty
            icon="◑"
            title="No workouts yet"
            message="Start a session and log sets as you go. Personal records are worked out from what you log."
          />
        </div>
      ) : (
        <div className="col" style={{ gap: 'var(--space-sm)' }}>
          {sessions.map((session, index) => (
            <SessionRow
              key={session.id}
              session={session}
              routineName={data?.routines.find((r) => r.id === session.routine_id)?.name}
              delay={Math.min(index, 8) * 35}
              onOpen={() => setOpenId(session.id)}
              onDelete={() => void remove(session)}
            />
          ))}
        </div>
      )}

      {openId ? (
        <SessionDialog
          sessionId={openId}
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
  delay,
  onOpen,
  onDelete,
}: {
  session: WorkoutSession;
  routineName?: string;
  delay: number;
  onOpen: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="list-row rise" style={{ animationDelay: `${delay}ms` }}>
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
          ✎
        </button>
        <button className="icon-btn danger" onClick={onDelete} aria-label="Delete">
          🗑
        </button>
      </div>
    </div>
  );
}

/* SESSION ------------------------------------------------------------------ */

function SessionDialog({
  sessionId,
  exercises,
  onClose,
}: {
  sessionId: string;
  exercises: Exercise[];
  onClose: () => void;
}) {
  const [sets, setSets] = useState<SessionSet[] | null>(null);
  const [notes, setNotes] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [prIds, setPrIds] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const rows = await api.listSessionSets(sessionId);
    setSets(rows);
    // The first exercise in the session, so opening a part-finished workout
    // lands you where you were rather than on a blank pane.
    if (rows.length > 0 && !activeId) setActiveId(rows[0].exercise_id);
    return rows;
    // activeId is deliberately not a dependency: it is seeded once here and
    // owned by the user afterwards.
  }, [sessionId, activeId]);

  useAsync(load, `session-${sessionId}`);

  const blocks = useMemo(() => {
    const order: string[] = [];
    (sets ?? []).forEach((set) => {
      if (!order.includes(set.exercise_id)) order.push(set.exercise_id);
    });
    if (activeId && !order.includes(activeId)) order.push(activeId);
    return order;
  }, [sets, activeId]);

  const volume = totalVolume(sets ?? []);

  const logSet = async (exerciseId: string, reps: number, weightKg: number) => {
    setError(null);
    try {
      // History EXCLUDES this session, so a set is never compared against
      // itself or against its own warm-ups.
      const history = await api.listExerciseHistory(exerciseId, sessionId);
      const isPr = isPersonalRecord(history, { exercise_id: exerciseId, reps, weight_kg: weightKg });

      const mine = (sets ?? []).filter((s) => s.exercise_id === exerciseId);
      const saved = await api.addSet(sessionId, {
        exercise_id: exerciseId,
        reps,
        weight_kg: weightKg,
        rpe: null,
        set_number: nextSetNumber(mine),
      });

      setSets((current) => [...(current ?? []), saved]);

      if (isPr) {
        const previous = Math.max(
          ...history.filter((h) => h.reps === reps).map((h) => h.weight_kg),
        );
        setPrIds((current) => ({ ...current, [saved.id]: previous }));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that set');
    }
  };

  const removeSet = async (id: string) => {
    const snapshot = sets;
    setSets((current) => (current ?? []).filter((s) => s.id !== id));
    try {
      await api.deleteSet(id);
    } catch (e) {
      setSets(snapshot);
      setError(e instanceof Error ? e.message : 'Could not delete that set');
    }
  };

  const saveNotes = async () => {
    try {
      await api.updateSession(sessionId, { notes });
    } catch {
      // A failed note is not worth interrupting a workout for; it is retried
      // the next time the field loses focus.
    }
  };

  return (
    <Modal open title="Workout" onClose={onClose} width={980}>
      <ErrorBanner message={error} />

      <div className="row-between">
        <Stat label="Volume" value={`${volume.toLocaleString('en-IN')} kg`} sub="moved this session" />
        <RestTimer />
      </div>

      <div className="split" style={{ gridTemplateColumns: 'minmax(0,1fr) 300px' }}>
        <div className="col" style={{ gap: 'var(--space-md)' }}>
          {sets === null ? (
            <Spinner center />
          ) : blocks.length === 0 ? (
            <Empty title="No exercises yet" message="Pick one on the right to start logging." />
          ) : (
            blocks.map((exerciseId) => (
              <ExerciseBlock
                key={exerciseId}
                exercise={exercises.find((e) => e.id === exerciseId)}
                sets={(sets ?? []).filter((s) => s.exercise_id === exerciseId)}
                prIds={prIds}
                onLog={(reps, weight) => void logSet(exerciseId, reps, weight)}
                onRemove={(id) => void removeSet(id)}
              />
            ))
          )}

          <textarea
            className="input"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => void saveNotes()}
            placeholder="How did it go?"
            rows={2}
          />
        </div>

        <div className="col" style={{ gap: 'var(--space-sm)' }}>
          <div className="overline">Add an exercise</div>
          <div
            className="col"
            style={{ gap: 4, maxHeight: 420, overflowY: 'auto', paddingRight: 4 }}
          >
            {exercises.map((exercise) => {
              const already = blocks.includes(exercise.id);
              return (
                <button
                  key={exercise.id}
                  className={`list-row${already ? '' : ''}`}
                  style={{
                    padding: '8px 12px',
                    opacity: already ? 0.5 : 1,
                    cursor: already ? 'default' : 'pointer',
                    textAlign: 'left',
                  }}
                  disabled={already}
                  onClick={() => setActiveId(exercise.id)}
                >
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{exercise.name}</div>
                    <div className="faint" style={{ fontSize: 11.5 }}>
                      {exercise.muscle_group ?? 'Other'}
                      {already ? ' · added' : ''}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function ExerciseBlock({
  exercise,
  sets,
  prIds,
  onLog,
  onRemove,
}: {
  exercise: Exercise | undefined;
  sets: SessionSet[];
  prIds: Record<string, number>;
  onLog: (reps: number, weight: number) => void;
  onRemove: (id: string) => void;
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
      <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 'var(--space-md)' }}>
        {exercise?.name ?? 'Exercise'}
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
            ✕
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
        <span className="faint">×</span>
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
                  <div className="list-row" key={exercise.id} style={{ padding: '9px 14px' }}>
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
                        ↗
                      </button>
                      <button
                        className="icon-btn danger"
                        onClick={() => void removeExercise(exercise)}
                        aria-label="Delete"
                      >
                        🗑
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
            <button className="btn btn-glass btn-sm" onClick={() => setEditingRoutine('new')}>
              ＋ New
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
                <div className="list-row" key={routine.id}>
                  <span className="grow" style={{ fontSize: 13, fontWeight: 500 }}>
                    {routine.name}
                  </span>
                  <div className="row-actions">
                    <button
                      className="icon-btn"
                      onClick={() => setEditingRoutine(routine)}
                      aria-label="Edit"
                    >
                      ✎
                    </button>
                    <button
                      className="icon-btn danger"
                      onClick={() => void removeRoutine(routine)}
                      aria-label="Delete"
                    >
                      🗑
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
              <CartesianGrid stroke="var(--glass-border)" vertical={false} />
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
  const [name, setName] = useState(routine?.name ?? '');
  const [picked, setPicked] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(routine === null);

  const load = useCallback(async () => {
    if (!routine) return [];
    const rows = await api.listRoutineExercises(routine.id);
    setPicked(rows.map((r) => r.exercise_id));
    setLoaded(true);
    return rows;
  }, [routine]);

  useAsync(load, `routine-${routine?.id ?? 'new'}`);

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) return setError('Give the routine a name');
    if (picked.length === 0) return setError('A routine with nothing in it would pre-fill nothing');

    setSaving(true);
    setError(null);
    try {
      await api.saveRoutine(
        { id: routine?.id, name: trimmed },
        picked.map((id) => ({ exercise_id: id, target_sets: null, target_reps: null })),
      );
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that routine');
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      title={routine ? 'Edit routine' : 'New routine'}
      onClose={onClose}
      width={560}
      footer={
        <>
          <button className="btn btn-glass" onClick={onClose}>
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

      <div className="field">
        <span className="label">Exercises ({picked.length})</span>
        <div className="col" style={{ gap: 4, maxHeight: 320, overflowY: 'auto' }}>
          {exercises.map((exercise) => {
            const on = picked.includes(exercise.id);
            return (
              <label
                key={exercise.id}
                className="row"
                style={{ gap: 'var(--space-md)', padding: '6px 2px', cursor: 'pointer' }}
              >
                <button
                  type="button"
                  className={`check${on ? ' on' : ''}`}
                  onClick={() =>
                    setPicked((current) =>
                      on ? current.filter((id) => id !== exercise.id) : [...current, exercise.id],
                    )
                  }
                  aria-pressed={on}
                >
                  {on ? '✓' : ''}
                </button>
                <span className="grow" style={{ fontSize: 13 }}>
                  {exercise.name}
                </span>
                <span className="faint" style={{ fontSize: 11.5 }}>
                  {exercise.muscle_group ?? 'Other'}
                </span>
              </label>
            );
          })}
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
                  <CartesianGrid stroke="var(--glass-border)" vertical={false} />
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
