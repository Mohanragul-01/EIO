/**
 * SkillsView - the Exercises tab, as Calisthenics sees it: ladders first.
 *
 * In calisthenics the unit of progress is the ladder (tuck, advanced tuck,
 * straddle), not the single exercise, so that is what this tab opens on: one
 * card per ladder, grouped by family, with the step you are on and how close
 * your last session came to its goal - and beside them, how many steps you
 * have mastered and when. The plain library is one switch away.
 */
import { useMemo, useState } from 'react';

import { formatEventDate } from '@app/core/date';
import { moveTimeline } from '@app/modules/fitness/ladderHistory';
import { stepLabel } from '@app/modules/fitness/progression';

import { Icon } from '../../components/Icon';
import { Empty, ErrorBanner, Segmented, Spinner } from '../../components/ui';
import { ExercisesView } from './ExercisesView';
import { FAMILIES, FAMILY_LABEL, plural } from './format';
import { LadderEditor } from './LadderEditor';
import type { FitnessNav } from './nav';
import { ProgressRing } from './ProgressRing';
import { useLadderCards, type LadderCard } from './useLadderCards';

type View = 'ladders' | 'library';

export function SkillsView({ nav }: { nav: FitnessNav }) {
  const [view, setView] = useState<View>('ladders');
  return (
    <>
      <div className="fx-subtoggle">
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: 'ladders', label: 'Ladders' },
            { value: 'library', label: 'Library' },
          ]}
        />
      </div>
      {view === 'ladders' ? <Ladders nav={nav} /> : <ExercisesView mode="calisthenics" nav={nav} />}
    </>
  );
}

function Ladders({ nav }: { nav: FitnessNav }) {
  const { cards, exercises, exerciseName, loading, error, reload } = useLadderCards();
  const [creating, setCreating] = useState(false);

  const byFamily = useMemo(
    () =>
      FAMILIES.map((family) => ({
        family,
        cards: cards.filter((c) => c.ladder.progression.family === family),
      })).filter((group) => group.cards.length > 0),
    [cards],
  );

  const mastered = cards.reduce(
    (n, c) => n + c.rungs.filter((r) => r.state === 'mastered').length,
    0,
  );
  const timeline = useMemo(
    () =>
      moveTimeline(
        cards.map((c) => c.ladder),
        { limit: 8 },
      ),
    [cards],
  );
  const ladderName = (id: string) =>
    cards.find((c) => c.ladder.progression.id === id)?.ladder.progression.name ?? 'A ladder';

  if (loading) return <Spinner center />;

  return (
    <>
      <ErrorBanner message={error} />

      <div className="row-between fx-section-head">
        <h2 className="fx-h2">
          Ladders <span className="column-count">{cards.length}</span>
        </h2>
        <button type="button" className="btn" onClick={() => setCreating(true)}>
          <Icon name="plus" />
          New ladder
        </button>
      </div>

      {cards.length === 0 ? (
        <div className="card">
          <Empty
            icon="steps"
            title="No ladders yet"
            message="A ladder is the path to a skill, one variation at a time: tuck, advanced tuck, straddle. Each rung has a goal, and you move up when you have met it."
            action={
              <button type="button" className="btn" onClick={() => setCreating(true)}>
                New ladder
              </button>
            }
          />
        </div>
      ) : (
        <div className="split">
          <div className="col fx-stack">
            {byFamily.map((group) => (
              <section key={group.family} aria-labelledby={`fx-fam-${group.family}`}>
                <h3 id={`fx-fam-${group.family}`} className="overline fx-family">
                  {FAMILY_LABEL[group.family]}
                </h3>
                <div className="fx-skill-grid">
                  {group.cards.map((card) => (
                    <SkillCard
                      key={card.ladder.progression.id}
                      card={card}
                      onOpen={() => nav.ladder(card.ladder.progression.id)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>

          <aside className="card card-pad fx-progress" aria-labelledby="fx-progress-title">
            <h3 id="fx-progress-title" className="overline">
              Progress
            </h3>
            <p className="fx-big numeric">{plural(mastered, 'step')} mastered</p>
            {timeline.length === 0 ? (
              <p className="muted fx-small">Moves up appear here, with the day you made them.</p>
            ) : (
              <ol className="fx-timeline">
                {timeline.map((entry) => (
                  <li key={entry.id}>
                    <Icon name="arrowUp" size={14} className="fx-cal-accent" />
                    <span className="numeric fx-small muted fx-timeline-date">
                      {formatEventDate(entry.date)}
                    </span>
                    <span className="fx-small">
                      <span className="secondary">{ladderName(entry.progressionId)}: </span>
                      {entry.fromExerciseId
                        ? exerciseName(entry.fromExerciseId)
                        : 'a removed rung'}{' '}
                      → {entry.toExerciseId ? exerciseName(entry.toExerciseId) : 'a removed rung'}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </aside>
        </div>
      )}

      {creating ? (
        <LadderEditor
          ladder={null}
          exercises={exercises}
          onClose={() => setCreating(false)}
          onSaved={(id) => {
            setCreating(false);
            void reload();
            nav.ladder(id);
          }}
        />
      ) : null}
    </>
  );
}

function SkillCard({ card, onOpen }: { card: LadderCard; onOpen: () => void }) {
  const { progression } = card.ladder;
  const total = card.rungs.length;
  const subtitle = card.current
    ? stepLabel(card.current.number, total, card.currentName ?? '')
    : total === 0
      ? 'No rungs yet'
      : 'Not started';
  return (
    <button
      type="button"
      className="card card-hover fx-skill"
      onClick={onOpen}
      aria-label={`${progression.name}. ${subtitle}. ${Math.round(card.progress * 100)} percent of the goal${
        card.ready ? '. Ready to move up' : ''
      }${progression.paused_at ? '. Paused' : ''}`}
    >
      <ProgressRing progress={card.progress} />
      <span className="grow" style={{ minWidth: 0 }}>
        <span className="fx-row-title">{progression.name}</span>
        <span className="fx-row-sub truncate">{subtitle}</span>
        {card.ready ? (
          <span className="fx-badge ok">
            <Icon name="arrowUp" size={12} />
            Ready to move up
          </span>
        ) : progression.paused_at ? (
          <span className="fx-badge">
            <Icon name="pause" size={11} />
            Paused
          </span>
        ) : null}
      </span>
      <Icon name="chevronRight" size={14} className="faint" />
    </button>
  );
}
