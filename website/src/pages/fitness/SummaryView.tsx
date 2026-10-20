/**
 * SummaryView - what a session added up to.
 *
 * The phone's summary, in the order you want to know it: the numbers, the
 * records, any ladder you are ready to move up, how it compares with the last
 * time you ran this routine, and - when you strayed from the routine - the
 * change spelled out, with the choice to make the routine match. Nothing
 * changes without that click; moving up a ladder is always your call.
 */
import { useMemo, useState } from 'react';

import { formatEventDate } from '@app/core/date';
import * as api from '@app/modules/fitness/api';
import type { SetFact } from '@app/modules/fitness/load';
import { levelUpCandidates } from '@app/modules/fitness/progression';
import {
  compareToLast,
  describeDeviation,
  routineDeviation,
  sessionSummary,
  type Comparison,
} from '@app/modules/fitness/summary';

import { Icon, type IconName } from '../../components/Icon';
import { useToast } from '../../components/Toast';
import { Empty, ErrorBanner, Spinner, Stat } from '../../components/ui';
import { useAsync } from '../../lib/useAsync';
import { durationLabel, plural, recordValue, volumeText } from './format';
import type { FitnessNav } from './nav';
import { useSessionLog } from './useSessionLog';

type Extras = {
  ordinal: number | null;
  lastSets: SetFact[] | null;
  slots: Awaited<ReturnType<typeof api.listRoutineExercises>>;
  routineName: string | null;
  ladders: api.Ladder[];
  /** Each rung exercise's EARLIER sessions, newest first, for the level-up rule. */
  ladderHistory: Record<string, SetFact[][]>;
};

export function SummaryView({ sessionId, nav }: { sessionId: string; nav: FitnessNav }) {
  const w = useSessionLog(sessionId);
  const toast = useToast();
  const session = w.session;
  const [routineDecided, setRoutineDecided] = useState(false);
  const [updating, setUpdating] = useState(false);
  /** Ladders answered here, by Move up or Not yet. */
  const [answered, setAnswered] = useState<string[]>([]);

  const extras = useAsync(
    async (): Promise<Extras | null> => {
      if (!session) return null;
      const [ordinal, lastSets, slots, routines] = await Promise.all([
        api.sessionOrdinal(session.id),
        session.routine_id
          ? api.lastRoutineSessionSets({
              routineId: session.routine_id,
              excludeSessionId: session.id,
              date: session.date,
            })
          : Promise.resolve(null),
        session.routine_id ? api.listRoutineExercises(session.routine_id) : Promise.resolve([]),
        session.routine_id ? api.listRoutines() : Promise.resolve([]),
      ]);
      // Ladders whose current rung might have been trained today.
      const ladders = await api.listLadders().catch(() => [] as api.Ladder[]);
      const rungExercises = ladders.flatMap((l) => {
        const rung = l.steps.find((st) => st.id === l.progression.current_step_id);
        return rung ? [rung.exercise_id] : [];
      });
      const recent = await api.recentSessionSets(rungExercises, 4).catch(() => ({}));
      const ladderHistory = Object.fromEntries(
        Object.entries(recent as Record<string, SetFact[][]>).map(([id, sessions]) => [
          id,
          sessions.filter((sets) => sets[0]?.session_id !== session.id),
        ]),
      );
      return {
        ordinal,
        lastSets,
        slots,
        routineName: routines.find((r) => r.id === session.routine_id)?.name ?? null,
        ladders,
        ladderHistory,
      };
    },
    `summary-${session?.id ?? 'none'}-${session?.date ?? ''}`,
  );

  const sets = w.savedFacts;
  const summary = useMemo(
    () =>
      sessionSummary({
        sets,
        exercisesById: w.exercisesById,
        bodyweightKg: session?.bodyweight_kg ?? null,
        records: w.records,
        startedAt: session?.started_at ?? sets[0]?.created_at ?? null,
        endedAt: session?.ended_at ?? sets[sets.length - 1]?.created_at ?? null,
      }),
    [sets, w.exercisesById, w.records, session],
  );

  const data = extras.data;
  const comparisons = useMemo(
    () =>
      compareToLast(sets, data?.lastSets ?? null, w.exercisesById, session?.bodyweight_kg ?? null),
    [sets, data, w.exercisesById, session],
  );
  const deviation = useMemo(
    () =>
      routineDeviation(
        data?.slots ?? [],
        w.blocks.map((b) => ({
          exerciseId: b.exerciseId,
          workingSets: b.rows.filter((r) => r.kind === 'saved' && r.set.set_type !== 'warmup')
            .length,
        })),
      ),
    [data, w.blocks],
  );
  const names = useMemo(
    () => Object.fromEntries(Object.values(w.exercisesById).map((e) => [e.id, e.name])),
    [w.exercisesById],
  );
  const levelUps = useMemo(
    () =>
      levelUpCandidates(data?.ladders ?? [], sets, data?.ladderHistory ?? {}).filter(
        (c) => !answered.includes(c.progressionId),
      ),
    [data, sets, answered],
  );

  if (w.loading) return <Spinner center />;
  if (!session) {
    return (
      <div className="card">
        <Empty
          icon="fitness"
          title="This workout no longer exists"
          action={
            <button type="button" className="btn btn-secondary" onClick={nav.back}>
              Back
            </button>
          }
        />
      </div>
    );
  }

  const routineName = data?.routineName ?? null;
  const deviationLines = session.routine_id ? describeDeviation(deviation, names) : [];
  const canUpdate = deviation.added.length > 0 || deviation.setCounts.length > 0;

  const updateRoutine = async () => {
    if (!session.routine_id) return;
    setUpdating(true);
    try {
      const counts = (id: string) =>
        w.blocks
          .find((b) => b.exerciseId === id)
          ?.rows.filter((r) => r.kind === 'saved' && r.set.set_type !== 'warmup').length ?? 1;
      await api.updateRoutineFromSession(session.routine_id, {
        setCounts: deviation.setCounts.map((c) => ({
          exercise_id: c.exerciseId,
          target_sets: c.to,
        })),
        added: deviation.added.map((id) => ({ exercise_id: id, target_sets: counts(id) })),
      });
      setRoutineDecided(true);
      toast.show({ message: `${routineName ?? 'Routine'} updated` });
    } catch (e) {
      toast.show({ message: e instanceof Error ? e.message : 'Could not update the routine' });
    } finally {
      setUpdating(false);
    }
  };

  const moveUp = async (candidate: (typeof levelUps)[number]) => {
    const to = names[candidate.to.exercise_id] ?? 'the next rung';
    try {
      await api.moveLadder({
        progressionId: candidate.progressionId,
        fromStepId: candidate.from.id,
        toStepId: candidate.to.id,
        kind: 'up',
        sessionId: session.id,
      });
      setAnswered((a) => [...a, candidate.progressionId]);
      toast.show({
        message: `${candidate.name}: moved up to ${to}`,
        actionLabel: 'Undo',
        onAction: () =>
          void api
            .undoLadderMove(candidate.progressionId, candidate.from.id)
            .then(() => setAnswered((a) => a.filter((id) => id !== candidate.progressionId)))
            .catch(() => toast.show({ message: 'Could not undo that' })),
      });
    } catch (e) {
      toast.show({ message: e instanceof Error ? e.message : 'Could not move up' });
    }
  };

  return (
    <div className="fx-summary">
      <div className="row-between wrap">
        <div>
          <p className="overline">
            {formatEventDate(session.date)}
            {routineName ? ` · ${routineName}` : ''}
          </p>
          <h2 className="fx-display">{data?.ordinal ? `Workout #${data.ordinal}` : 'Workout'}</h2>
        </div>
        <div className="row wrap">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => nav.session(session.id)}
          >
            <Icon name="edit" size={14} />
            Open the workout
          </button>
          {session.ended_at ? (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={async () => {
                if (await w.reopen()) nav.session(session.id);
              }}
            >
              <Icon name="reset" size={14} />
              Reopen
            </button>
          ) : null}
          <button type="button" className="btn" onClick={() => nav.tab('log')}>
            Done
          </button>
        </div>
      </div>

      <ErrorBanner message={w.error ?? extras.error} />

      <div className="card card-pad stat-row fx-summary-stats">
        <Stat
          label="Duration"
          value={durationLabel(summary.durationMs)}
          sub={session.ended_at ? 'start to finish' : 'start to last set'}
        />
        <Stat label="Volume" value={volumeText(summary.volume)} sub="working sets" />
        <Stat label="Sets" value={summary.workingSets} sub="warm-ups not counted" />
        <Stat
          label="Records"
          value={summary.records.length}
          sub={summary.records.length ? 'new bests' : 'none this time'}
        />
      </div>

      {summary.records.length > 0 ? (
        <section className="card card-pad" aria-labelledby="fx-sum-records">
          <h3 id="fx-sum-records" className="fx-h3">
            Records
          </h3>
          <ul className="fx-lines">
            {summary.records.map(({ setId, exerciseId, hit }) => (
              <li key={setId} className="fx-line">
                <Icon name="trophy" size={16} className="fx-medal" />
                <span>
                  <span className="fx-line-title">{names[exerciseId] ?? 'Exercise'}</span>
                  <span className="fx-line-detail numeric">
                    {hit.label} · {recordValue(hit)} (was{' '}
                    {recordValue({ ...hit, value: hit.previous })})
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {levelUps.map((candidate) => (
        <section
          key={candidate.progressionId}
          className="card card-pad fx-levelup"
          aria-label={`${candidate.name}: ready to move up`}
        >
          <div className="fx-line">
            <Icon name="arrowUp" size={18} className="fx-cal-accent" />
            <span>
              <span className="fx-line-title">
                {candidate.name}: ready for {names[candidate.to.exercise_id] ?? 'the next rung'}?
              </span>
              <span className="fx-line-detail">
                You met the goal for {names[candidate.from.exercise_id] ?? 'this rung'}. Moving up
                is your call.
              </span>
            </span>
          </div>
          <div className="row">
            <button type="button" className="btn" onClick={() => void moveUp(candidate)}>
              <Icon name="arrowUp" size={14} />
              Move up
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setAnswered((a) => [...a, candidate.progressionId])}
            >
              Not yet
            </button>
          </div>
        </section>
      ))}

      {comparisons.length > 0 ? (
        <section className="card card-pad" aria-labelledby="fx-sum-vs">
          <h3 id="fx-sum-vs" className="fx-h3">
            vs last time{routineName ? ` you did ${routineName}` : ''}
          </h3>
          <ul className="fx-lines">
            {comparisons.map((c) => (
              <ComparisonLine key={c.exerciseId} comparison={c} />
            ))}
          </ul>
        </section>
      ) : session.routine_id && data && data.lastSets === null ? (
        <p className="muted fx-small">
          The first time you have done {routineName ?? 'this routine'}: next time is compared with
          this one.
        </p>
      ) : null}

      {deviationLines.length > 0 && !routineDecided ? (
        <section className="card card-pad" aria-labelledby="fx-sum-dev">
          <h3 id="fx-sum-dev" className="fx-h3">
            Update {routineName ?? 'the routine'}?
          </h3>
          <ul className="fx-bullets">
            {deviationLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          {deviation.skipped.length > 0 ? (
            <p className="muted fx-small">Skipped exercises stay in the routine.</p>
          ) : null}
          <div className="row">
            {canUpdate ? (
              <button
                type="button"
                className="btn"
                onClick={() => void updateRoutine()}
                disabled={updating}
              >
                {updating ? <span className="spinner" /> : 'Update routine'}
              </button>
            ) : null}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setRoutineDecided(true)}
            >
              Keep it
            </button>
          </div>
        </section>
      ) : null}

      {sets.length === 0 ? (
        <p className="muted fx-small">
          Nothing logged in this workout yet
          {w.blocks.length > 0 ? ` (${plural(w.blocks.length, 'exercise')} planned)` : ''}, so there
          is nothing to add up.
        </p>
      ) : null}
    </div>
  );
}

const LOOK: Record<Comparison['change'], { icon: IconName; color: string; word: string }> = {
  up: { icon: 'arrowUp', color: 'var(--success)', word: 'Better' },
  down: { icon: 'arrowDown', color: 'var(--warning)', word: 'Lower' },
  same: { icon: 'minus', color: 'var(--text-muted)', word: 'Same' },
  new: { icon: 'plus', color: 'var(--info)', word: 'New' },
};

function ComparisonLine({ comparison: c }: { comparison: Comparison }) {
  const look = LOOK[c.change];
  const delta =
    c.volumeDelta === null || c.volumeDelta === 0
      ? ''
      : ` · volume ${c.volumeDelta > 0 ? '+' : '−'}${volumeText(Math.abs(c.volumeDelta))}`;
  return (
    <li className="fx-line">
      <Icon name={look.icon} size={16} style={{ color: look.color }} />
      <span>
        <span className="fx-line-title">
          {c.name} <span style={{ color: look.color }}>{look.word}</span>
        </span>
        <span className="fx-line-detail numeric">
          Best {c.best}
          {c.lastBest ? ` (last time ${c.lastBest})` : ''}
          {delta}
        </span>
      </span>
    </li>
  );
}
