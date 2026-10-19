/**
 * LogView - the Log tab: how the training is going, and every session.
 *
 * Top to bottom, the questions in the order you ask them: am I consistent
 * (a WEEKLY streak and the days since you last trained - a daily streak would
 * break on every planned rest day), how has the year gone (the heatmap), what
 * did this month look like (the calendar, gym and calisthenics days marked),
 * and the sessions themselves. Every session is listed whatever the mode -
 * one log, two lenses - with its mode named beside it.
 */
import { useCallback, useMemo, useState } from 'react';

import { formatEventDate, fromISODate, monthBounds, toISODate, todayISO } from '@app/core/date';
import * as api from '@app/modules/fitness/api';
import { heatmapDays, yearGrid } from '@app/modules/fitness/heatmap';
import { MODE_LABEL } from '@app/modules/fitness/mode';
import { restDays, trainingDays, weeklyStreak } from '@app/modules/fitness/streak';
import type { FitnessMode, Routine, WorkoutSession } from '@app/modules/fitness/types';

import { Icon } from '../../components/Icon';
import {
  Empty,
  ErrorBanner,
  Modal,
  Spinner,
  Stat,
  TextField,
  useConfirm,
} from '../../components/ui';
import { useToast } from '../../components/Toast';
import { useAsync } from '../../lib/useAsync';
import { MODE_COLOR, MODE_ICON, plural } from './format';
import { Menu, type MenuItem } from './Menu';
import { TrainingCalendar } from './TrainingCalendar';
import { YearHeatmap } from './YearHeatmap';
import type { FitnessNav } from './nav';

const PAGE = 40;

/** A day a week either side of a month, so the grid's borrowed days have marks too. */
function shift(iso: string, days: number): string {
  const d = fromISODate(iso);
  return toISODate(new Date(d.getFullYear(), d.getMonth(), d.getDate() + days));
}

/** Days since the last workout, in words: "4 days", "Today", or a dash before the first. */
function restValue(rest: number | null | undefined): string {
  if (rest === null || rest === undefined) return '—';
  return rest === 0 ? 'Today' : plural(rest, 'day');
}

function restSub(rest: number | null | undefined): string {
  if (rest === undefined) return '';
  if (rest === null) return 'no workouts yet';
  return rest === 0 ? 'you trained today' : 'since your last workout';
}

export function LogView({ mode, nav }: { mode: FitnessMode; nav: FitnessNav }) {
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const [limit, setLimit] = useState(PAGE);
  const [starting, setStarting] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [saveAs, setSaveAs] = useState<WorkoutSession | null>(null);
  const [{ year, month }, setMonth] = useState(() => {
    const t = fromISODate(todayISO());
    return { year: t.getFullYear(), month: t.getMonth() + 1 };
  });

  const today = todayISO();

  const load = useCallback(async () => {
    const grid = yearGrid(todayISO());
    const start = grid[0][0];
    const end = grid[6][grid[6].length - 1];
    const [sessions, yearSessions, setRows, routines] = await Promise.all([
      api.listSessions(limit),
      api.listSessionsBetween(start, end),
      api.listSetDaysBetween(start, end),
      api.listRoutines(),
      // A first visit gets the starter library rather than a page with no
      // way to begin.
      api.seedDefaultExercisesIfEmpty(),
    ]);
    return { sessions, yearSessions, setRows, routines, grid };
  }, [limit]);

  const { data, loading, error, reload } = useAsync(load, `fitness-log-${limit}`);

  const loadMonth = useCallback(async () => {
    const { start, end } = monthBounds(year, month);
    return trainingDays(await api.listSessionsBetween(shift(start, -7), shift(end, 7)));
  }, [year, month]);
  // Keyed on the log's data too, so a session started or deleted marks the month.
  const monthData = useAsync(
    loadMonth,
    `fitness-month-${year}-${month}-${data ? data.sessions.length : 0}`,
  );

  const routines = useMemo(
    () => (data?.routines ?? []).filter((r) => r.mode === mode),
    [data, mode],
  );
  const routineName = useMemo(
    () => new Map((data?.routines ?? []).map((r) => [r.id, r.name])),
    [data],
  );

  const summary = useMemo(() => {
    if (!data) return null;
    const dates = [...new Set([...data.sessions, ...data.yearSessions].map((s) => s.date))];
    const thisWeek = new Set(data.grid.map((row) => row[row.length - 1]));
    const workingBySession = new Map<string, number>();
    for (const row of data.setRows) {
      if ((row.set_type ?? 'normal') === 'warmup') continue;
      workingBySession.set(row.session_id, (workingBySession.get(row.session_id) ?? 0) + 1);
    }
    return {
      streak: weeklyStreak(dates, today),
      rest: restDays(dates, today),
      week: data.yearSessions.filter((s) => thisWeek.has(s.date) && s.date <= today).length,
      year: data.yearSessions.filter((s) => s.date <= today).length,
      heat: heatmapDays(data.yearSessions, data.setRows),
      workingBySession,
    };
  }, [data, today]);

  const start = async (routine: Routine | null, date: string) => {
    setStarting(true);
    try {
      // The session row exists before logging opens, so every set has a
      // parent; a routine lays out its blocks and a bodyweight is snapshotted.
      const session = await api.startSession({
        date,
        // A routine carries its own mode; a freestyle session takes the lens.
        mode: routine?.mode ?? mode,
        routine_id: routine?.id ?? null,
      });
      nav.session(session.id);
    } catch (e) {
      toast.show({ message: e instanceof Error ? e.message : 'Could not start a workout' });
      setStarting(false);
    }
  };

  const startItems = (date: string): MenuItem[] => [
    {
      key: 'freestyle',
      label: 'Freestyle',
      detail: 'Pick exercises as you go',
      icon: 'plus',
      onSelect: () => void start(null, date),
    },
    { kind: 'separator', key: 'sep' },
    { kind: 'heading', key: 'h', label: `${MODE_LABEL[mode]} routines` },
    ...(routines.length === 0
      ? [
          {
            key: 'none',
            label: 'None yet',
            detail: 'Build one in Routines',
            disabled: true,
            onSelect: () => {},
          },
        ]
      : routines.map((routine) => ({
          key: routine.id,
          label: routine.name,
          icon: 'play' as const,
          onSelect: () => void start(routine, date),
        }))),
  ];

  const remove = async (session: WorkoutSession) => {
    const ok = await confirm(
      'Delete this workout',
      'Every set in it is deleted too. This cannot be undone.',
    );
    if (!ok) return;
    try {
      await api.deleteSession(session.id);
      await reload();
      toast.show({ message: `Workout on ${formatEventDate(session.date)} deleted` });
    } catch (e) {
      toast.show({ message: e instanceof Error ? e.message : 'Could not delete that workout' });
    }
  };

  const repeat = async (session: WorkoutSession) => {
    try {
      const fresh = await api.repeatSession(session.id);
      nav.session(fresh.id);
    } catch (e) {
      toast.show({ message: e instanceof Error ? e.message : 'Could not repeat it' });
    }
  };

  const selectDay = (iso: string) => {
    setSelected(iso);
    const d = fromISODate(iso);
    setMonth({ year: d.getFullYear(), month: d.getMonth() + 1 });
  };

  if (loading && !data) return <Spinner center />;

  const sessions = data?.sessions ?? [];
  const daySessions = selected
    ? [...(data?.yearSessions ?? []), ...sessions].filter(
        (s, i, all) => s.date === selected && all.findIndex((x) => x.id === s.id) === i,
      )
    : [];

  return (
    <>
      <ErrorBanner message={error} />

      <div className="row-between wrap fx-log-head">
        <div className="stat-row fx-log-stats">
          <Stat
            label="Streak"
            value={summary ? plural(summary.streak, 'week') : '—'}
            sub="in a row with training"
          />
          <Stat label="Rest" value={restValue(summary?.rest)} sub={restSub(summary?.rest)} />
          <Stat label="This week" value={summary ? summary.week : '—'} sub="workouts" />
          <Stat label="Last 12 months" value={summary ? summary.year : '—'} sub="workouts" />
        </div>
        <Menu
          label="Start workout"
          title="Start a workout today, freestyle or from a routine"
          className="btn"
          align="end"
          disabled={starting}
          content={
            <>
              {starting ? <span className="spinner" /> : <Icon name="plus" />}
              Start workout
            </>
          }
          items={startItems(today)}
        />
      </div>

      <section className="card card-pad fx-section" aria-labelledby="fx-year-title">
        <div className="row-between">
          <h2 id="fx-year-title" className="fx-h2">
            The year
          </h2>
          <span className="muted fx-small">Working sets per day · warm-ups not counted</span>
        </div>
        {data && summary ? (
          <YearHeatmap
            grid={data.grid}
            days={summary.heat}
            today={today}
            selected={selected}
            onSelect={selectDay}
          />
        ) : null}
      </section>

      <div className="split fx-log-split">
        <section aria-labelledby="fx-history-title" className="col fx-stack">
          <div className="row-between">
            <h2 id="fx-history-title" className="fx-h2">
              History
            </h2>
            <span className="column-count">{sessions.length}</span>
          </div>

          {sessions.length === 0 ? (
            <div className="card">
              <Empty
                icon="fitness"
                title="No workouts yet"
                message="Start a session and log sets as you go. Personal records are worked out from what you log."
              />
            </div>
          ) : (
            <ul className="fx-list" aria-label="Workouts, newest first">
              {sessions.map((session) => (
                <SessionRow
                  key={session.id}
                  session={session}
                  routineName={session.routine_id ? routineName.get(session.routine_id) : undefined}
                  workingSets={summary?.workingBySession.get(session.id)}
                  onOpen={() => nav.session(session.id)}
                  onSummary={() => nav.summary(session.id)}
                  onRepeat={() => void repeat(session)}
                  onSaveAs={() => setSaveAs(session)}
                  onDelete={() => void remove(session)}
                />
              ))}
            </ul>
          )}

          {sessions.length >= limit ? (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setLimit((n) => n + PAGE)}
            >
              Show older workouts
            </button>
          ) : null}
        </section>

        <aside className="col fx-stack" aria-label="Calendar">
          <div className="card card-pad">
            <TrainingCalendar
              year={year}
              month={month}
              onChangeMonth={(y, m) => setMonth({ year: y, month: m })}
              days={monthData.data ?? {}}
              selected={selected}
              onSelect={selectDay}
            />
          </div>

          {selected ? (
            <div className="card card-pad fx-day" aria-live="polite">
              <div className="row-between">
                <h3 className="fx-h3">{formatEventDate(selected)}</h3>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="Close this day"
                  onClick={() => setSelected(null)}
                >
                  <Icon name="close" />
                </button>
              </div>
              {daySessions.length === 0 ? (
                <p className="muted fx-small">Nothing logged on this day.</p>
              ) : (
                daySessions.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="fx-day-row"
                    onClick={() => nav.session(s.id)}
                  >
                    <Icon
                      name={MODE_ICON[s.mode]}
                      size={14}
                      style={{ color: MODE_COLOR[s.mode] }}
                    />
                    <span className="grow">
                      {MODE_LABEL[s.mode]}
                      {s.routine_id && routineName.get(s.routine_id)
                        ? ` · ${routineName.get(s.routine_id)}`
                        : ''}
                    </span>
                    <span className="muted fx-small numeric">
                      {summary?.workingBySession.has(s.id)
                        ? plural(summary.workingBySession.get(s.id) ?? 0, 'set')
                        : ''}
                    </span>
                    <Icon name="chevronRight" size={14} className="faint" />
                  </button>
                ))
              )}
              {selected <= today ? (
                <Menu
                  label={`Log a workout for ${formatEventDate(selected)}`}
                  className="btn btn-secondary btn-sm"
                  align="start"
                  disabled={starting}
                  content={
                    <>
                      <Icon name="plus" size={14} />
                      Log a workout for {formatEventDate(selected)}
                    </>
                  }
                  items={startItems(selected)}
                />
              ) : null}
            </div>
          ) : (
            <p className="muted fx-small fx-pad-x">
              Pick a day on the calendar or the year to see it, or to log a workout you forgot.
            </p>
          )}
        </aside>
      </div>

      {saveAs ? (
        <SaveAsRoutineDialog
          session={saveAs}
          onClose={() => setSaveAs(null)}
          onSaved={(name) => {
            setSaveAs(null);
            toast.show({ message: `Saved "${name}" to Routines` });
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
  workingSets,
  onOpen,
  onSummary,
  onRepeat,
  onSaveAs,
  onDelete,
}: {
  session: WorkoutSession;
  routineName?: string;
  workingSets?: number;
  onOpen: () => void;
  onSummary: () => void;
  onRepeat: () => void;
  onSaveAs: () => void;
  onDelete: () => void;
}) {
  const label = formatEventDate(session.date);
  return (
    <li className="list-row bordered fx-session-row">
      <button type="button" className="fx-session-open grow" onClick={onOpen}>
        <span
          className="fx-mode-mark"
          style={{ color: MODE_COLOR[session.mode] }}
          aria-hidden="true"
        >
          <Icon name={MODE_ICON[session.mode]} size={15} />
        </span>
        <span className="grow" style={{ minWidth: 0 }}>
          <span className="fx-row-title">
            {label}
            {routineName ? <span className="muted"> · {routineName}</span> : null}
          </span>
          <span className="fx-row-sub">
            {MODE_LABEL[session.mode]}
            {workingSets !== undefined ? ` · ${plural(workingSets, 'working set')}` : ''}
            {session.ended_at ? ' · Finished' : ''}
            {session.notes ? ` · ${session.notes}` : ''}
          </span>
        </span>
      </button>
      <Menu
        label={`More for the workout on ${label}`}
        items={[
          {
            key: 'summary',
            label: 'Summary',
            icon: 'sparkline',
            onSelect: onSummary,
          },
          { key: 'repeat', label: 'Repeat it today', icon: 'repeat', onSelect: onRepeat },
          { key: 'routine', label: 'Save as a routine', icon: 'checklist', onSelect: onSaveAs },
          { kind: 'separator', key: 'sep' },
          {
            key: 'delete',
            label: 'Delete workout',
            icon: 'trash',
            danger: true,
            onSelect: onDelete,
          },
        ]}
      />
    </li>
  );
}

function SaveAsRoutineDialog({
  session,
  onClose,
  onSaved,
}: {
  session: WorkoutSession;
  onClose: () => void;
  onSaved: (name: string) => void;
}) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) return setError('Give the routine a name');
    setSaving(true);
    setError(null);
    try {
      await api.saveSessionAsRoutine(session.id, trimmed);
      onSaved(trimmed);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save it');
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      title="Save as a routine"
      onClose={onClose}
      width={440}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn" onClick={() => void save()} disabled={saving}>
            {saving ? <span className="spinner" /> : 'Save routine'}
          </button>
        </>
      }
    >
      <p className="secondary fx-small">
        From {formatEventDate(session.date)}: its exercises in order, with the sets you did and the
        range of reps as targets.
      </p>
      <TextField
        label="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Push day, Day A"
        maxLength={60}
        autoFocus
        error={error}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void save();
        }}
      />
    </Modal>
  );
}
