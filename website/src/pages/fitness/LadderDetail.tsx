/**
 * LadderDetail - one ladder: where you are on it, how you got there, the way up.
 *
 * Rungs read in order. Mastered ones are ticked with the day you moved up
 * from them; the current one is outlined, with its goal, your best recent
 * attempt and a progress ring; the ones above are locked (a lock and the word,
 * never colour alone). Moving up and stepping back are always your call and
 * always undoable - the app only says when you look ready. Beside them, the
 * rung you were on over time and every move you have made.
 */
import { useState } from 'react';

import { formatEventDate, todayISO } from '@app/core/date';
import * as api from '@app/modules/fitness/api';
import { bestAttempt, ladderPositions } from '@app/modules/fitness/ladderHistory';
import { goalLabel, neighbours, type Rung } from '@app/modules/fitness/progression';

import { Icon } from '../../components/Icon';
import { useToast } from '../../components/Toast';
import { Empty, ErrorBanner, Spinner, useConfirm } from '../../components/ui';
import { TrendChart } from './charts';
import { FAMILY_LABEL } from './format';
import { LadderEditor } from './LadderEditor';
import { Menu, type MenuItem } from './Menu';
import type { FitnessNav } from './nav';
import { ProgressRing } from './ProgressRing';
import { useLadderCards } from './useLadderCards';

export function LadderDetail({ progressionId, nav }: { progressionId: string; nav: FitnessNav }) {
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const { cards, exercises, recent, exerciseName, loading, error, reload } = useLadderCards();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  const card = cards.find((c) => c.ladder.progression.id === progressionId);
  const progression = card?.ladder.progression;

  if (loading) return <Spinner center />;
  if (!card || !progression) {
    return (
      <div className="card">
        <Empty
          icon="steps"
          title="This ladder no longer exists"
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

  const sides = neighbours(card.ladder.steps, progression.current_step_id);
  const moves = [...card.ladder.moves].sort(
    (a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at),
  );
  const positions = ladderPositions(card.ladder.steps, card.ladder.moves);
  const total = card.rungs.length;
  const nameOf = (stepId: string | null) => {
    const step = card.ladder.steps.find((s) => s.id === stepId);
    return step ? exerciseName(step.exercise_id) : 'a removed rung';
  };

  /** Move to a rung, with an Undo that puts you back where you were. */
  const moveTo = async (toStepId: string, kind: 'up' | 'back' | 'start') => {
    const from = progression.current_step_id;
    setBusy(true);
    try {
      await api.moveLadder({ progressionId, fromStepId: from, toStepId, kind });
      await reload();
      const verb = kind === 'up' ? 'Moved up to' : kind === 'back' ? 'Stepped back to' : 'Now on';
      toast.show({
        message: `${verb} ${nameOf(toStepId)}`,
        actionLabel: 'Undo',
        onAction: async () => {
          try {
            await api.undoLadderMove(progressionId, from);
            await reload();
          } catch (e) {
            toast.show({ message: e instanceof Error ? e.message : 'Could not undo that' });
          }
        },
      });
    } catch (e) {
      toast.show({ message: e instanceof Error ? e.message : 'Could not move' });
    } finally {
      setBusy(false);
    }
  };

  /** Start a calisthenics session today with this rung already in it. */
  const train = async (exerciseId: string) => {
    setBusy(true);
    try {
      const session = await api.startSession({
        date: todayISO(),
        mode: 'calisthenics',
        routine_id: null,
      });
      await api.addSessionExercise({
        session_id: session.id,
        exercise_id: exerciseId,
        position: 0,
      });
      nav.session(session.id);
    } catch (e) {
      toast.show({ message: e instanceof Error ? e.message : 'Could not start a workout' });
      setBusy(false);
    }
  };

  const remove = async () => {
    const ok = await confirm(
      `Delete ${progression.name}?`,
      'Deletes the ladder and its history of moves. Every set you logged is kept. This cannot be undone.',
    );
    if (!ok) return;
    try {
      await api.deleteLadder(progressionId);
      toast.show({ message: `${progression.name} deleted` });
      nav.back();
    } catch (e) {
      toast.show({ message: e instanceof Error ? e.message : 'Could not delete that ladder' });
    }
  };

  const togglePause = async () => {
    try {
      await api.setLadderPaused(progressionId, !progression.paused_at);
      await reload();
      toast.show({
        message: progression.paused_at
          ? `${progression.name} resumed`
          : `${progression.name} paused`,
      });
    } catch (e) {
      toast.show({ message: e instanceof Error ? e.message : 'Could not change that' });
    }
  };

  const ladderMenu: MenuItem[] = [
    { key: 'edit', label: 'Edit ladder', icon: 'edit', onSelect: () => setEditing(true) },
    {
      key: 'back',
      label: sides.previous
        ? `Step back to ${exerciseName(sides.previous.exercise_id)}`
        : 'Step back',
      icon: 'arrowDown',
      disabled: !sides.previous || busy,
      onSelect: () => {
        if (sides.previous) void moveTo(sides.previous.id, 'back');
      },
    },
    {
      key: 'pause',
      label: progression.paused_at ? 'Resume' : 'Pause',
      detail: progression.paused_at ? undefined : 'Injury, travel, a deload: no level-up prompts',
      icon: progression.paused_at ? 'play' : 'pause',
      onSelect: () => void togglePause(),
    },
    { kind: 'separator', key: 'sep' },
    {
      key: 'delete',
      label: 'Delete ladder',
      icon: 'trash',
      danger: true,
      onSelect: () => void remove(),
    },
  ];

  const rungMenu = (rung: Rung): MenuItem[] => [
    ...(rung.state !== 'current'
      ? [
          {
            key: 'current',
            label: 'Make this my current rung',
            icon: 'flag' as const,
            disabled: busy,
            onSelect: () => {
              const kind = !card.current
                ? 'start'
                : rung.number > card.current.number
                  ? 'up'
                  : 'back';
              void moveTo(rung.step.id, kind);
            },
          },
        ]
      : []),
    {
      key: 'history',
      label: 'History and records',
      icon: 'trend',
      onSelect: () => nav.exercise(rung.step.exercise_id),
    },
  ];

  return (
    <div className="fx-ladder">
      <header className="card fx-session-head">
        <button type="button" className="icon-btn" onClick={nav.back} aria-label="Back">
          <Icon name="chevronLeft" />
        </button>
        <div className="fx-session-title">
          <h2 className="fx-h2">{progression.name}</h2>
          <span className="fx-row-sub">
            {FAMILY_LABEL[progression.family]} ·{' '}
            {card.current
              ? `Step ${card.current.number} of ${total}`
              : total
                ? 'Not started'
                : 'No rungs yet'}
            {' · '}
            {progression.level_up_rule === 'one'
              ? 'asks after 1 session meets the goal'
              : 'asks after 2 of the last 3 meet the goal'}
          </span>
        </div>
        <Menu label={`Options for ${progression.name}`} items={ladderMenu} />
      </header>

      <ErrorBanner message={error} />

      {progression.paused_at ? (
        <p className="fx-notice">
          <Icon name="pause" size={13} />
          Paused: no level-up prompts until you resume it.
        </p>
      ) : null}

      <div className="split fx-ladder-split">
        <section className="col fx-stack" aria-label="Rungs">
          <div className="fx-segments" aria-hidden="true">
            {card.rungs.map((r) => (
              <span key={r.step.id} className={`fx-segment ${r.state}`} />
            ))}
          </div>

          {total === 0 ? (
            <div className="card">
              <Empty
                icon="steps"
                title="No rungs yet"
                message="Add the variations in order, each with a goal."
                action={
                  <button type="button" className="btn" onClick={() => setEditing(true)}>
                    Add rungs
                  </button>
                }
              />
            </div>
          ) : (
            <ol className="fx-rungs">
              {card.rungs.map((rung) => {
                const name = exerciseName(rung.step.exercise_id);
                const best = bestAttempt(rung.step, recent[rung.step.exercise_id] ?? []);
                const current = rung.state === 'current';
                const status =
                  rung.state === 'mastered'
                    ? rung.masteredOn
                      ? `Mastered ${formatEventDate(rung.masteredOn)}`
                      : 'Behind you'
                    : current
                      ? 'Current'
                      : 'Locked';
                return (
                  <li
                    key={rung.step.id}
                    className={`card fx-rung ${rung.state}`}
                    aria-current={current ? 'step' : undefined}
                  >
                    <span className={`fx-rung-number ${rung.state}`} aria-hidden="true">
                      {rung.state === 'mastered' ? (
                        <Icon name="check" size={14} strokeWidth={2.2} />
                      ) : rung.state === 'locked' ? (
                        <Icon name="lock" size={13} />
                      ) : (
                        rung.number
                      )}
                    </span>
                    <div className="grow fx-rung-body">
                      <div className="fx-row-title">
                        <span className="sr-only">Step {rung.number}: </span>
                        {name}
                      </div>
                      <div className="fx-row-sub numeric">
                        {status} · Goal {goalLabel(rung.step)}
                        {best ? ` · Best recently ${best}` : ''}
                      </div>
                      {rung.step.cue ? <div className="fx-cue">{rung.step.cue}</div> : null}
                      {current ? (
                        <>
                          {card.ready ? (
                            <p className="fx-notice ok">
                              <Icon name="arrowUp" size={13} />
                              You have met the goal. Ready when you are.
                            </p>
                          ) : null}
                          <div className="row wrap fx-rung-actions">
                            <button
                              type="button"
                              className="btn"
                              onClick={() => void train(rung.step.exercise_id)}
                              disabled={busy}
                            >
                              <Icon name="play" size={12} />
                              Train today
                            </button>
                            {sides.next ? (
                              <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => void moveTo(sides.next!.id, 'up')}
                                disabled={busy}
                              >
                                <Icon name="arrowUp" size={14} />
                                Move up to {exerciseName(sides.next.exercise_id)}
                              </button>
                            ) : null}
                          </div>
                        </>
                      ) : null}
                    </div>
                    {current ? <ProgressRing progress={card.progress} size={52} /> : null}
                    <Menu label={`Options for ${name}`} items={rungMenu(rung)} />
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <aside className="col fx-stack" aria-label="History">
          <section className="card card-pad" aria-labelledby="fx-ladder-chart">
            <h3 id="fx-ladder-chart" className="overline">
              Your rung over time
            </h3>
            <TrendChart
              points={positions.map((p) => ({ date: p.date, value: p.number }))}
              unit=""
              label="Rung"
              color="var(--accent-cyan)"
              step
              height={200}
              formatValue={(v) =>
                `Step ${v} · ${card.rungs[v - 1] ? exerciseName(card.rungs[v - 1].step.exercise_id) : ''}`
              }
            />
          </section>

          <section className="card card-pad" aria-labelledby="fx-ladder-moves">
            <h3 id="fx-ladder-moves" className="overline">
              Moves
            </h3>
            {moves.length === 0 ? (
              <p className="muted fx-small">No moves yet.</p>
            ) : (
              <ol className="fx-timeline">
                {moves.map((m) => (
                  <li key={m.id}>
                    <Icon
                      name={m.kind === 'up' ? 'arrowUp' : m.kind === 'back' ? 'arrowDown' : 'flag'}
                      size={14}
                      className={m.kind === 'up' ? 'fx-cal-accent' : 'muted'}
                    />
                    <span className="numeric fx-small muted fx-timeline-date">
                      {formatEventDate(m.date)}
                    </span>
                    <span className="fx-small">
                      {m.kind === 'start'
                        ? `Started on ${nameOf(m.to_step_id)}`
                        : `${m.kind === 'up' ? 'Up' : 'Back'}: ${nameOf(m.from_step_id)} → ${nameOf(m.to_step_id)}`}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {progression.notes ? (
            <section className="card card-pad">
              <h3 className="overline">Notes</h3>
              <p className="secondary fx-small fx-prewrap">{progression.notes}</p>
            </section>
          ) : null}
        </aside>
      </div>

      {editing ? (
        <LadderEditor
          ladder={card.ladder}
          exercises={exercises}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            toast.show({ message: 'Ladder saved' });
            void reload();
          }}
        />
      ) : null}

      {dialog}
    </div>
  );
}
