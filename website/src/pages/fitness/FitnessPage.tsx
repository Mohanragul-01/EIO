/**
 * FitnessPage - the desktop half of Fitness: planning, analysis and logging.
 *
 * One data model, two lenses. The Gym | Calisthenics switch is the lens: it
 * decides which routines and which exercises are listed and what new things
 * start as, and in Calisthenics the Exercises tab becomes Skills, ladders
 * first. The log is one log either way.
 *
 * Every training rule on this page is the app's own code from
 * app/src/modules/fitness - records, ghosts, targets, ladders, streaks,
 * summaries. The website only lays them out; the phone and the site cannot
 * disagree about what counts as a record because there is one definition.
 *
 * A session, its summary, an exercise and a ladder each open in place of the
 * tabs, and live in the URL (see nav.ts).
 */
import { useMemo, type KeyboardEvent } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { MODE_LABEL } from '@app/modules/fitness/mode';
import type { FitnessMode } from '@app/modules/fitness/types';

import { Icon } from '../../components/Icon';
import { Shell } from '../../components/Shell';
import { Segmented } from '../../components/ui';
import { BodyView } from './BodyView';
import { ExerciseDetail } from './ExerciseDetail';
import { ExercisesView } from './ExercisesView';
import { MODE_ICON } from './format';
import { LadderDetail } from './LadderDetail';
import { LogView } from './LogView';
import { parseTab, type FitnessNav, type FitnessTab } from './nav';
import { RoutinesView } from './RoutinesView';
import { SessionView } from './SessionView';
import { SkillsView } from './SkillsView';
import { SummaryView } from './SummaryView';
import { useFitnessMode } from './useFitnessMode';
import './fitness.css';

const MODES: FitnessMode[] = ['gym', 'calisthenics'];

export function FitnessPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useFitnessMode();

  const tab = parseTab(params.get('tab'));
  const sessionId = params.get('session');
  const summaryId = params.get('summary');
  const exerciseId = params.get('exercise');
  const ladderId = params.get('ladder');
  // The first entry of the history has the key 'default': arriving by link,
  // there is nowhere inside the site to go back to.
  const canGoBack = location.key !== 'default';

  const nav = useMemo<FitnessNav>(() => {
    const go = (next: Record<string, string>) => setParams(next);
    const withTab = (next: Record<string, string>) => go(tab === 'log' ? next : { tab, ...next });
    return {
      tab: (t: FitnessTab) => go(t === 'log' ? {} : { tab: t }),
      session: (id) => go({ session: id }),
      summary: (id) => go({ summary: id }),
      exercise: (id) => withTab({ exercise: id }),
      ladder: (id) => go({ tab: 'exercises', ladder: id }),
      back: () => (canGoBack ? navigate(-1) : go(tab === 'log' ? {} : { tab })),
    };
  }, [setParams, navigate, tab, canGoBack]);

  const subView = sessionId ? (
    <SessionView key={sessionId} sessionId={sessionId} nav={nav} />
  ) : summaryId ? (
    <SummaryView key={summaryId} sessionId={summaryId} nav={nav} />
  ) : exerciseId ? (
    <ExerciseDetail key={exerciseId} exerciseId={exerciseId} nav={nav} />
  ) : ladderId ? (
    <LadderDetail key={ladderId} progressionId={ladderId} nav={nav} />
  ) : null;

  const exercisesLabel = mode === 'calisthenics' ? 'Skills' : 'Exercises';

  return (
    <Shell
      title="Fitness"
      subtitle={
        mode === 'calisthenics'
          ? 'Calisthenics: skills, ladders and sessions'
          : 'Gym: sessions, routines and records'
      }
      actions={
        <div className="row wrap fx-top-actions">
          <ModeSwitch mode={mode} onChange={setMode} />
          <Segmented
            value={tab}
            onChange={nav.tab}
            options={[
              { value: 'log', label: 'Log' },
              { value: 'routines', label: 'Routines' },
              { value: 'exercises', label: exercisesLabel },
              { value: 'body', label: 'Body' },
            ]}
          />
        </div>
      }
    >
      <div className="fx-page">
        {subView ??
          (tab === 'log' ? (
            <LogView mode={mode} nav={nav} />
          ) : tab === 'routines' ? (
            <RoutinesView mode={mode} nav={nav} />
          ) : tab === 'exercises' ? (
            mode === 'calisthenics' ? (
              <SkillsView nav={nav} />
            ) : (
              <ExercisesView mode={mode} nav={nav} />
            )
          ) : (
            <BodyView />
          ))}
      </div>
    </Shell>
  );
}

/**
 * Gym | Calisthenics. A radio group rather than tabs: it is a setting that
 * changes every tab, not a place. Arrow keys move between the two, as in any
 * radio group; the mode's icon and name are both shown.
 */
function ModeSwitch({ mode, onChange }: { mode: FitnessMode; onChange: (m: FitnessMode) => void }) {
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const next = mode === 'gym' ? 'calisthenics' : 'gym';
    onChange(next);
    event.currentTarget.querySelector<HTMLButtonElement>(`[data-mode="${next}"]`)?.focus();
  };

  return (
    <div className="segmented fx-mode" role="radiogroup" aria-label="Mode" onKeyDown={onKeyDown}>
      {MODES.map((m) => (
        <button
          key={m}
          type="button"
          role="radio"
          data-mode={m}
          aria-checked={mode === m}
          tabIndex={mode === m ? 0 : -1}
          className={`segmented-item fx-mode-item ${m}${mode === m ? ' active' : ''}`}
          onClick={() => onChange(m)}
        >
          <Icon name={MODE_ICON[m]} size={13} />
          {MODE_LABEL[m]}
        </button>
      ))}
    </div>
  );
}
