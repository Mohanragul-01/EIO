/**
 * ExercisesView - the library, filtered by the mode and browsed by region.
 *
 * Only this mode's exercises are listed ('both' shows in either), grouped by
 * the specific muscle within the region you pick - the granularity without
 * twenty-two filters. A new exercise starts as the mode's default (weights in
 * the gym, bodyweight in calisthenics), and every one of those choices can be
 * changed on the exercise's own page.
 */
import { useCallback, useMemo, useState } from 'react';

import * as api from '@app/modules/fitness/api';
import { defaultsForMode, MODE_LABEL, visibleInMode } from '@app/modules/fitness/mode';
import {
  MUSCLE_GROUPS,
  MUSCLE_REGIONS,
  TRACKING_LABEL,
  normaliseMuscle,
  regionOf,
  type Exercise,
  type FitnessMode,
  type LoadMode,
  type MuscleRegion,
  type TrackingType,
} from '@app/modules/fitness/types';

import { Icon } from '../../components/Icon';
import { useToast } from '../../components/Toast';
import { ChipPicker, ErrorBanner, Segmented, Spinner, useConfirm } from '../../components/ui';
import { useAsync } from '../../lib/useAsync';
import type { FitnessNav } from './nav';

export function ExercisesView({ mode, nav }: { mode: FitnessMode; nav: FitnessNav }) {
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const load = useCallback(() => api.seedDefaultExercisesIfEmpty(), []);
  const { data, loading, error, reload } = useAsync(load, 'fitness-exercises');
  const [region, setRegion] = useState<MuscleRegion | 'All'>('All');

  const exercises = useMemo(() => (data ?? []).filter((e) => visibleInMode(e, mode)), [data, mode]);

  const grouped = useMemo(() => {
    const visible =
      region === 'All' ? exercises : exercises.filter((e) => regionOf(e.muscle_group) === region);
    const byMuscle = new Map<string, Exercise[]>();
    visible.forEach((exercise) => {
      // Normalised, so a pre-0018 tag groups under its current name.
      const key = normaliseMuscle(exercise.muscle_group)?.trim() || 'Unsorted';
      const bucket = byMuscle.get(key);
      if (bucket) bucket.push(exercise);
      else byMuscle.set(key, [exercise]);
    });
    return [...byMuscle.entries()].sort(([a], [b]) =>
      a === 'Unsorted' ? 1 : b === 'Unsorted' ? -1 : a.localeCompare(b),
    );
  }, [exercises, region]);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    exercises.forEach((e) => {
      const r = regionOf(e.muscle_group);
      map.set(r, (map.get(r) ?? 0) + 1);
    });
    return map;
  }, [exercises]);

  const remove = async (exercise: Exercise) => {
    const ok = await confirm(
      `Delete ${exercise.name}?`,
      'Only an exercise with nothing logged can be deleted: its history is what every record is measured against. This cannot be undone.',
    );
    if (!ok) return;
    try {
      await api.deleteExercise(exercise.id);
      await reload();
      toast.show({ message: `${exercise.name} deleted` });
    } catch (e) {
      // The api already says it in plain words when sets exist.
      toast.show({ message: e instanceof Error ? e.message : 'Could not delete that exercise' });
    }
  };

  if (loading && !data) return <Spinner center />;

  return (
    <>
      <ErrorBanner message={error} />

      <div className="split">
        <div className="col fx-stack">
          <div className="chip-row" role="group" aria-label="Region">
            {(['All', ...MUSCLE_REGIONS] as const).map((option) => {
              const count = option === 'All' ? exercises.length : (counts.get(option) ?? 0);
              return (
                <button
                  key={option}
                  type="button"
                  className={`chip${region === option ? ' selected' : ''}`}
                  aria-pressed={region === option}
                  onClick={() => setRegion(option)}
                >
                  {option}
                  <span className={region === option ? undefined : 'muted'}> {count}</span>
                </button>
              );
            })}
          </div>

          <h2 className="fx-h2">
            {MODE_LABEL[mode]} library <span className="column-count">{exercises.length}</span>
          </h2>

          {grouped.length === 0 ? (
            <p className="muted fx-small">Nothing here yet. Add one with the form beside this.</p>
          ) : (
            grouped.map(([group, items]) => (
              <section key={group} aria-label={group}>
                <h3 className="overline fx-family">{group}</h3>
                <ul className="fx-list">
                  {items.map((exercise) => (
                    <li key={exercise.id} className="list-row bordered">
                      <button
                        type="button"
                        className="fx-session-open grow"
                        onClick={() => nav.exercise(exercise.id)}
                      >
                        <span className="fx-row-title">{exercise.name}</span>
                        <span className="row" style={{ gap: 4 }}>
                          {exercise.load_mode === 'bodyweight' ? (
                            <span className="pill">bodyweight</span>
                          ) : null}
                          {exercise.tracking_type === 'time' ? (
                            <span className="pill">held</span>
                          ) : null}
                          {exercise.is_unilateral ? <span className="pill">one side</span> : null}
                          {exercise.discipline === 'both' ? (
                            <span className="pill">both modes</span>
                          ) : null}
                        </span>
                      </button>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => nav.exercise(exercise.id)}
                          aria-label={`${exercise.name}: history and records`}
                          title="History and records"
                        >
                          <Icon name="trend" />
                        </button>
                        <button
                          type="button"
                          className="icon-btn danger"
                          onClick={() => void remove(exercise)}
                          aria-label={`Delete ${exercise.name}`}
                          title="Delete"
                        >
                          <Icon name="trash" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>

        <AddExerciseCard
          key={mode}
          mode={mode}
          onAdded={(exercise) => {
            toast.show({ message: `${exercise.name} added` });
            void reload();
          }}
        />
      </div>

      {dialog}
    </>
  );
}

function AddExerciseCard({ mode, onAdded }: { mode: FitnessMode; onAdded: (e: Exercise) => void }) {
  const defaults = defaultsForMode(mode);
  const [name, setName] = useState('');
  const [muscle, setMuscle] = useState<string>(MUSCLE_GROUPS[0]);
  const [tracking, setTracking] = useState<TrackingType>(defaults.tracking_type);
  const [loadMode, setLoadMode] = useState<LoadMode>(defaults.load_mode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = async () => {
    const trimmed = name.trim();
    if (!trimmed) return setError('Give it a name');
    setSaving(true);
    setError(null);
    try {
      const exercise = await api.createExercise({
        name: trimmed,
        muscle_group: muscle,
        tracking_type: tracking,
        load_mode: loadMode,
        // As on the phone: a bodyweight movement belongs to both days; a lift
        // belongs to the mode it was made in.
        discipline: loadMode === 'bodyweight' ? 'both' : defaults.discipline,
      });
      setName('');
      onAdded(exercise);
    } catch (e) {
      setError(
        e instanceof Error && e.message.includes('duplicate')
          ? 'You already have an exercise with that name.'
          : e instanceof Error
            ? e.message
            : 'Could not add the exercise',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="card card-pad fx-add-card" aria-labelledby="fx-add-exercise">
      <h3 id="fx-add-exercise" className="fx-h3">
        Add an exercise
      </h3>
      <div className="row">
        <input
          className="input grow"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          aria-label="Exercise name"
          maxLength={80}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void add();
          }}
        />
        <button
          type="button"
          className="btn"
          onClick={() => void add()}
          disabled={saving || !name.trim()}
        >
          {saving ? <span className="spinner" /> : 'Add'}
        </button>
      </div>

      <div className="field">
        <span className="label">Load</span>
        <Segmented
          value={loadMode}
          onChange={setLoadMode}
          options={[
            { value: 'external', label: 'Weights' },
            { value: 'bodyweight', label: 'Bodyweight' },
          ]}
        />
        <span className="muted fx-small">
          {loadMode === 'bodyweight'
            ? 'Your body is the load: sets record added weight or assistance, and it shows in both modes.'
            : 'A barbell, dumbbell or machine is the load.'}
        </span>
      </div>

      <div className="field">
        <span className="label">Measured in</span>
        <Segmented
          value={tracking}
          onChange={setTracking}
          options={[
            { value: 'reps', label: TRACKING_LABEL.reps },
            { value: 'time', label: TRACKING_LABEL.time },
          ]}
        />
        <span className="muted fx-small">
          {tracking === 'time'
            ? 'Sets are logged as seconds held: planks, dead hangs, L-sits.'
            : 'Sets are logged as reps.'}
        </span>
      </div>

      <ChipPicker
        label="Muscle"
        value={muscle}
        onChange={setMuscle}
        options={MUSCLE_GROUPS.map((g) => ({ value: g, label: g }))}
      />

      <ErrorBanner message={error} />
    </section>
  );
}
