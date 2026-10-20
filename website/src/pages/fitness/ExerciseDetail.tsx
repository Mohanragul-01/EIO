/**
 * ExerciseDetail - everything about one exercise, on one page.
 *
 * The phone splits this into four tabs; a desktop shows them together. On the
 * left, the chart - its metrics chosen to fit the exercise (exerciseStats.ts:
 * estimated max and volume for a lift, most reps and added weight for a
 * pull-up, longest hold for a plank) - and every session with it. On the
 * right, your bests with their dates, the rep-max table for a lift, and the
 * how-to and settings that decide how a set is logged.
 */
import { useMemo, useState } from 'react';

import { formatEventDate, todayISO } from '@app/core/date';
import * as api from '@app/modules/fitness/api';
import {
  historyBySession,
  METRIC_LABEL,
  METRIC_UNIT,
  metricsFor,
  repMaxTable,
  seriesFor,
  type Metric,
  type Range,
} from '@app/modules/fitness/exerciseStats';
import { formatSetShort, netLoad, setLabels } from '@app/modules/fitness/load';
import { MODE_LABEL } from '@app/modules/fitness/mode';
import {
  estimatedOneRepMax,
  MUSCLE_GROUPS,
  normaliseMuscle,
  type Band,
  type Discipline,
  type Equipment,
  type Exercise,
  type LoadMode,
  type TrackingType,
} from '@app/modules/fitness/types';

import { Icon } from '../../components/Icon';
import { useToast } from '../../components/Toast';
import {
  ChipPicker,
  Empty,
  ErrorBanner,
  Segmented,
  SelectField,
  Spinner,
  TextArea,
  TextField,
} from '../../components/ui';
import { useAsync } from '../../lib/useAsync';
import { TrendChart } from './charts';
import { EQUIPMENT, plural, trim } from './format';
import type { FitnessNav } from './nav';

type SetRow = Awaited<ReturnType<typeof api.listExerciseSets>>[number];

const RANGES: { value: Range; label: string }[] = [
  { value: '1m', label: '1M' },
  { value: '3m', label: '3M' },
  { value: '1y', label: '1Y' },
  { value: 'all', label: 'All' },
];

const HISTORY_PAGE = 12;

export function ExerciseDetail({ exerciseId, nav }: { exerciseId: string; nav: FitnessNav }) {
  const toast = useToast();
  const { data, loading, error, set } = useAsync(async () => {
    const [exercise, sets, bands] = await Promise.all([
      api.getExercise(exerciseId),
      api.listExerciseSets(exerciseId),
      api.listBands(),
    ]);
    return { exercise, sets, bands };
  }, `exercise-${exerciseId}`);

  const [metric, setMetric] = useState<Metric | null>(null);
  const [range, setRange] = useState<Range>('3m');
  const [picked, setPicked] = useState<number | null>(null);
  const [shown, setShown] = useState(HISTORY_PAGE);

  const exercise = data?.exercise ?? null;
  const sets = useMemo(() => data?.sets ?? [], [data]);
  const bandLabel = useMemo(() => {
    const byId = new Map((data?.bands ?? []).map((b: Band) => [b.id, b.label]));
    return (id: string | null) => (id ? (byId.get(id) ?? null) : null);
  }, [data]);

  const metrics = useMemo(() => (exercise ? metricsFor(exercise) : []), [exercise]);
  const activeMetric = metric && metrics.includes(metric) ? metric : (metrics[0] ?? null);
  const series = useMemo(
    () =>
      exercise && activeMetric ? seriesFor(activeMetric, sets, exercise, range, todayISO()) : [],
    [exercise, activeMetric, sets, range],
  );
  const history = useMemo(() => historyBySession(sets), [sets]);

  if (loading && !data) return <Spinner center />;
  if (!exercise) {
    return (
      <div className="card">
        <Empty
          icon="fitness"
          title="This exercise no longer exists"
          message={error ?? undefined}
          action={
            <button type="button" className="btn btn-secondary" onClick={nav.back}>
              Back
            </button>
          }
        />
      </div>
    );
  }

  const unit = activeMetric ? METRIC_UNIT[activeMetric] : '';
  const latest = series[series.length - 1];
  const best = series.length ? Math.max(...series.map((p) => p.value)) : null;
  const pickedPoint = picked !== null ? series[picked] : null;
  const pickedSets = pickedPoint ? sets.filter((s) => s.session_id === pickedPoint.sessionId) : [];
  const short = (s: SetRow) => formatSetShort(s, exercise, bandLabel(s.band_id));

  return (
    <div className="fx-exercise">
      <header className="card fx-session-head">
        <button type="button" className="icon-btn" onClick={nav.back} aria-label="Back">
          <Icon name="chevronLeft" />
        </button>
        <div className="fx-session-title">
          <h2 className="fx-h2">{exercise.name}</h2>
          <span className="fx-row-sub">
            {normaliseMuscle(exercise.muscle_group) ?? 'No muscle set'} ·{' '}
            {exercise.load_mode === 'bodyweight' ? 'Bodyweight' : 'Weights'} ·{' '}
            {exercise.tracking_type === 'time' ? 'held, in seconds' : 'reps'}
            {exercise.is_unilateral ? ' · one side at a time' : ''} ·{' '}
            {exercise.discipline === 'both' ? 'both modes' : MODE_LABEL[exercise.discipline]}
          </span>
        </div>
        <span className="muted fx-small numeric">{plural(history.length, 'session')}</span>
      </header>

      <ErrorBanner message={error} />

      <div className="split fx-exercise-split">
        <div className="col fx-stack">
          {activeMetric ? (
            <section className="card card-pad" aria-labelledby="fx-ex-chart">
              <div className="row-between wrap">
                <div>
                  <h3 id="fx-ex-chart" className="overline">
                    {METRIC_LABEL[activeMetric]}
                  </h3>
                  <p className="fx-display numeric">
                    {latest ? `${trim(latest.value)} ${unit}` : '—'}
                  </p>
                  {best !== null && latest && best > latest.value ? (
                    <p className="muted fx-small numeric">
                      Best in range {trim(best)} {unit}
                    </p>
                  ) : null}
                </div>
                <div className="chip-row" role="radiogroup" aria-label="Range">
                  {RANGES.map((r) => (
                    <button
                      key={r.value}
                      type="button"
                      role="radio"
                      aria-checked={range === r.value}
                      className={`chip${range === r.value ? ' selected' : ''}`}
                      onClick={() => {
                        setRange(r.value);
                        setPicked(null);
                      }}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="chip-row fx-metrics" role="radiogroup" aria-label="Measure">
                {metrics.map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={activeMetric === m}
                    className={`chip${activeMetric === m ? ' selected' : ''}`}
                    onClick={() => {
                      setMetric(m);
                      setPicked(null);
                    }}
                  >
                    {METRIC_LABEL[m]}
                  </button>
                ))}
              </div>

              <TrendChart
                points={series}
                unit={unit}
                label={METRIC_LABEL[activeMetric]}
                color={
                  exercise.load_mode === 'bodyweight' ? 'var(--accent-cyan)' : 'var(--primary)'
                }
                selectedIndex={picked}
                onSelect={setPicked}
              />
              <p className="muted fx-small">
                One point per session, warm-ups left out. Click a point for that day&rsquo;s sets.
              </p>

              {pickedPoint ? (
                <div className="fx-picked" aria-live="polite">
                  <div className="row-between">
                    <strong>
                      {formatEventDate(pickedPoint.date)} · {trim(pickedPoint.value)} {unit}
                    </strong>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label="Close that day's sets"
                      onClick={() => setPicked(null)}
                    >
                      <Icon name="close" />
                    </button>
                  </div>
                  <SetLines sets={pickedSets} short={short} />
                </div>
              ) : null}
            </section>
          ) : null}

          <section className="card card-pad" aria-labelledby="fx-ex-history">
            <h3 id="fx-ex-history" className="overline">
              History
            </h3>
            {history.length === 0 ? (
              <p className="muted fx-small">No sets logged yet. Log one and it shows here.</p>
            ) : (
              <ol className="fx-history">
                {history.slice(0, shown).map((group) => (
                  <li key={group.sessionId}>
                    <button
                      type="button"
                      className="fx-link fx-history-date"
                      onClick={() => nav.session(group.sessionId)}
                      title="Open this workout"
                    >
                      {formatEventDate(group.date)}
                    </button>
                    <SetLines sets={group.sets as SetRow[]} short={short} />
                  </li>
                ))}
              </ol>
            )}
            {history.length > shown ? (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShown((n) => n + HISTORY_PAGE)}
              >
                Show older sessions
              </button>
            ) : null}
          </section>
        </div>

        <div className="col fx-stack">
          <Records exercise={exercise} sets={sets} />
          <HowTo
            key={exercise.id}
            exercise={exercise}
            onSaved={(next) => {
              set((current) => ({ ...current, exercise: next }));
              toast.show({ message: `${next.name} saved` });
            }}
          />
        </div>
      </div>
    </div>
  );
}

function SetLines({ sets, short }: { sets: SetRow[]; short: (s: SetRow) => string }) {
  const labels = setLabels(sets);
  return (
    <ul className="fx-set-lines">
      {sets.map((s, i) => (
        <li key={s.id} className="numeric">
          <span className="fx-set-label" aria-label={`Set ${labels[i]}`}>
            {labels[i]}
          </span>
          {short(s)}
          {s.rpe ? <span className="muted"> · RPE {s.rpe}</span> : null}
        </li>
      ))}
    </ul>
  );
}

function Records({ exercise, sets }: { exercise: Exercise; sets: SetRow[] }) {
  const working = sets.filter((s) => s.set_type !== 'warmup');
  const table =
    exercise.load_mode === 'external' && exercise.tracking_type === 'reps'
      ? repMaxTable(sets)
      : null;

  /** The best working set by a measure, with its day. */
  const bestBy = (value: (s: SetRow) => number | null): { value: number; date: string } | null => {
    let best: { value: number; date: string } | null = null;
    for (const s of working) {
      const v = value(s);
      if (v !== null && v > 0 && (!best || v > best.value)) best = { value: v, date: s.date };
    }
    return best;
  };

  const lines: { label: string; best: { value: number; date: string } | null; unit: string }[] =
    exercise.tracking_type === 'time'
      ? [{ label: 'Longest hold', best: bestBy((s) => s.duration_seconds), unit: 's' }]
      : exercise.load_mode === 'bodyweight'
        ? [
            {
              label: 'Most reps (bodyweight or harder)',
              best: bestBy((s) => (netLoad(s) >= 0 ? s.reps : null)),
              unit: 'reps',
            },
            {
              label: 'Most added weight',
              best: bestBy((s) => (s.reps ? netLoad(s) : null)),
              unit: 'kg',
            },
          ]
        : [
            { label: 'Heaviest', best: bestBy((s) => (s.reps ? s.weight_kg : null)), unit: 'kg' },
            {
              label: 'Best est. 1RM',
              best: bestBy((s) =>
                s.reps && s.reps <= 12 && s.weight_kg > 0
                  ? estimatedOneRepMax(s.weight_kg, s.reps)
                  : null,
              ),
              unit: 'kg',
            },
            {
              label: 'Best set volume',
              best: bestBy((s) => (s.reps ? s.weight_kg * s.reps : null)),
              unit: 'kg',
            },
          ];

  return (
    <>
      <section className="card card-pad" aria-labelledby="fx-ex-records">
        <h3 id="fx-ex-records" className="overline">
          Records
        </h3>
        <dl className="fx-records">
          {lines.map((line) => (
            <div key={line.label}>
              <dt>{line.label}</dt>
              <dd className="numeric">
                {line.best ? `${trim(line.best.value)} ${line.unit}` : '—'}
                {line.best ? (
                  <span className="muted fx-small"> · {formatEventDate(line.best.date)}</span>
                ) : null}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {table ? (
        <section className="card fx-repmax" aria-labelledby="fx-ex-repmax">
          <h3 id="fx-ex-repmax" className="overline card-pad fx-repmax-title">
            Rep maxes
          </h3>
          <table className="data">
            <thead>
              <tr>
                <th scope="col" className="num">
                  Reps
                </th>
                <th scope="col">Your best</th>
                <th scope="col" className="num">
                  Est.
                </th>
              </tr>
            </thead>
            <tbody>
              {table.map((row) => (
                <tr key={row.reps}>
                  <td className="num">{row.reps}</td>
                  <td className="numeric">
                    {row.actual ? (
                      <>
                        {trim(row.actual.weight)} kg
                        <span className="muted"> · {formatEventDate(row.actual.date)}</span>
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="num muted">
                    {row.predicted !== null ? `${trim(row.predicted)} kg` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted fx-small card-pad">
            Est. comes from your best estimated max (Epley, 12 reps or fewer). Where it beats your
            best, a record is waiting.
          </p>
        </section>
      ) : null}
    </>
  );
}

function HowTo({ exercise, onSaved }: { exercise: Exercise; onSaved: (next: Exercise) => void }) {
  const [name, setName] = useState(exercise.name);
  const [muscle, setMuscle] = useState(normaliseMuscle(exercise.muscle_group) ?? '');
  const [instructions, setInstructions] = useState(exercise.instructions);
  const [pinned, setPinned] = useState(exercise.pinned_note);
  const [equipment, setEquipment] = useState<Equipment>(exercise.equipment ?? 'none');
  const [tracking, setTracking] = useState<TrackingType>(exercise.tracking_type);
  const [loadMode, setLoadMode] = useState<LoadMode>(exercise.load_mode);
  const [factor, setFactor] = useState(String(exercise.bodyweight_factor));
  const [unilateral, setUnilateral] = useState(exercise.is_unilateral);
  const [discipline, setDiscipline] = useState<Discipline>(exercise.discipline);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const factorValue = Number(factor.replace(',', '.'));
  // The database allows more than 0 and at most 1.5 of your bodyweight.
  const factorOk = Number.isFinite(factorValue) && factorValue > 0 && factorValue <= 1.5;

  const save = async () => {
    if (!name.trim()) return setError('Give it a name');
    if (!factorOk) return setError('The bodyweight share is between 0.1 and 1.5');
    setSaving(true);
    setError(null);
    const patch = {
      name: name.trim(),
      muscle_group: muscle || null,
      instructions: instructions.trim(),
      pinned_note: pinned.trim(),
      equipment,
      tracking_type: tracking,
      load_mode: loadMode,
      bodyweight_factor: factorValue,
      is_unilateral: unilateral,
      discipline,
    };
    try {
      await api.updateExercise(exercise.id, patch);
      onSaved({ ...exercise, ...patch });
    } catch (e) {
      setError(
        e instanceof Error && e.message.includes('duplicate')
          ? 'You already have an exercise with that name.'
          : e instanceof Error
            ? e.message
            : 'Could not save',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="card card-pad fx-howto" aria-labelledby="fx-ex-howto">
      <h3 id="fx-ex-howto" className="overline">
        How-to and settings
      </h3>
      <div className="fx-field-row">
        <TextField
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
        />
        <SelectField label="Muscle" value={muscle} onChange={(e) => setMuscle(e.target.value)}>
          <option value="">None</option>
          {[...new Set([...MUSCLE_GROUPS, ...(muscle ? [muscle] : [])])].map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </SelectField>
      </div>
      <p className="faint fx-small">
        Renaming is safe: sets point at the exercise, not its name, so history and records stay.
      </p>
      <TextArea
        label="How to do it"
        value={instructions}
        onChange={(e) => setInstructions(e.target.value)}
        placeholder="Your own notes on form: setup, cues, what to feel"
        rows={4}
      />
      <TextField
        label="Pinned note"
        value={pinned}
        onChange={(e) => setPinned(e.target.value)}
        placeholder="Shown every time you log it, e.g. seat on 4"
        maxLength={200}
      />

      <div className="field">
        <span className="label">Measured in</span>
        <Segmented
          value={tracking}
          onChange={setTracking}
          options={[
            { value: 'reps', label: 'Reps' },
            { value: 'time', label: 'Held, in seconds' },
          ]}
        />
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
      </div>
      {loadMode === 'bodyweight' ? (
        <TextField
          label="Bodyweight share"
          value={factor}
          onChange={(e) => setFactor(e.target.value)}
          inputMode="decimal"
          error={factorOk ? null : 'Between 0.1 and 1.5'}
          hint="The share of your bodyweight one rep moves (a push-up is about 0.65). Only used for volume and estimated maxes."
        />
      ) : null}
      <label className="fx-switch-row">
        <input
          type="checkbox"
          checked={unilateral}
          onChange={(e) => setUnilateral(e.target.checked)}
        />
        <span>
          <span className="fx-option-title">One side at a time</span>
          <span className="fx-option-detail">Each set is logged as a left and a right</span>
        </span>
      </label>
      <div className="field">
        <span className="label">Shows in</span>
        <Segmented
          value={discipline}
          onChange={setDiscipline}
          options={[
            { value: 'gym', label: 'Gym' },
            { value: 'calisthenics', label: 'Calisthenics' },
            { value: 'both', label: 'Both' },
          ]}
        />
      </div>
      <ChipPicker
        label="Equipment"
        value={equipment}
        onChange={setEquipment}
        options={EQUIPMENT.map((e) => ({ value: e.key, label: e.label }))}
      />

      <ErrorBanner message={error} />
      <div>
        <button type="button" className="btn" onClick={() => void save()} disabled={saving}>
          {saving ? <span className="spinner" /> : 'Save'}
        </button>
      </div>
    </section>
  );
}
