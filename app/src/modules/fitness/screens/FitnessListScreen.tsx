/**
 * FitnessListScreen - Log, Plan and Body over one module.
 *
 * Three tabs rather than three destinations, for the same reason as Notes: they
 * are three views of one thing, and none of them is somewhere you navigate TO.
 * Only a session and a routine are real destinations, because both are things
 * you open, work on, and come back from.
 */
import { useState } from 'react';
import { View } from 'react-native';

import { Screen, SwipeTabs } from '../../../core/components';
import { BodyTab } from './home/BodyTab';
import { ExercisesTab } from './home/ExercisesTab';
import { LogTab } from './home/LogTab';
import { RoutinesTab } from './home/RoutinesTab';
import { useHomeStyles } from './home/styles';

/**
 * Four tabs, not three.
 *
 * Routines and exercises were stacked in one "Plan" screen, separated by a
 * heading - so adding an exercise meant scrolling past every routine, and the
 * two things you do here were competing for the same scroll position. They are
 * different jobs: a routine is a template you write occasionally, the library
 * is a list you browse constantly.
 */
type FitnessView = 'log' | 'routines' | 'exercises' | 'body';
const VIEWS: FitnessView[] = ['log', 'routines', 'exercises', 'body'];
const VIEW_LABEL: Record<FitnessView, string> = {
  log: 'Log',
  routines: 'Routines',
  exercises: 'Exercises',
  body: 'Body',
};

export function FitnessListScreen() {
  const styles = useHomeStyles();
  const [view, setView] = useState<FitnessView>('log');

  return (
    <Screen padded={false}>
      <View style={styles.tabsTopSpacer} />

      <SwipeTabs
        options={VIEWS}
        value={view}
        onChange={setView}
        renderLabel={(v) => VIEW_LABEL[v]}
        // Each tab already owns its data, which is what makes them pageable:
        // a pager mounts every page, so a tab that only loaded when selected
        // would swipe onto a blank screen.
        renderPage={(v) =>
          v === 'log' ? (
            <LogTab />
          ) : v === 'routines' ? (
            <RoutinesTab />
          ) : v === 'exercises' ? (
            <ExercisesTab />
          ) : (
            <BodyTab />
          )
        }
      />
    </Screen>
  );
}
