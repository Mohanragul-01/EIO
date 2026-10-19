/**
 * FitnessListScreen - Fitness's home: a Gym | Calisthenics switch over four tabs.
 *
 * Four tabs rather than four destinations, for the same reason as Notes: they
 * are views of one thing, and none of them is somewhere you navigate TO. Only
 * a session, a routine and a ladder are destinations, because those are things
 * you open, work on, and come back from.
 *
 * THE MODE IS A LENS, not a second module: one library, one log, one record
 * system underneath. It decides what each tab shows first and what new things
 * default to, and in Calisthenics the Exercises tab becomes Skills (ladders
 * first, the library after). The Log tab shows every session either way, each
 * marked with its mode, because your training history is one history.
 */
import { useState } from 'react';
import { View } from 'react-native';

import { Screen, SegmentedControl, SwipeTabs } from '../../../core/components';
import { useTheme } from '../../../core/ThemeContext';
import { MODE_LABEL } from '../mode';
import type { FitnessMode } from '../types';
import { FitnessModeProvider, useFitnessMode } from '../useFitnessMode';
import { BodyTab } from './home/BodyTab';
import { ExercisesTab } from './home/ExercisesTab';
import { LogTab } from './home/LogTab';
import { RoutinesTab } from './home/RoutinesTab';
import { SkillsTab } from './home/SkillsTab';
import { useHomeStyles } from './home/styles';

/**
 * Routines and exercises are separate tabs because they are different jobs: a
 * routine is a template you write occasionally, the library is a list you
 * browse constantly, and stacking them made the two compete for one scroll.
 */
type FitnessView = 'log' | 'routines' | 'exercises' | 'body';
const VIEWS: FitnessView[] = ['log', 'routines', 'exercises', 'body'];

const MODES: FitnessMode[] = ['gym', 'calisthenics'];

export function FitnessListScreen() {
  return (
    <FitnessModeProvider>
      <FitnessHome />
    </FitnessModeProvider>
  );
}

function FitnessHome() {
  const styles = useHomeStyles();
  const { colors } = useTheme();
  const { mode, setMode } = useFitnessMode();
  const [view, setView] = useState<FitnessView>('log');

  const label = (v: FitnessView) =>
    v === 'log'
      ? 'Log'
      : v === 'routines'
        ? 'Routines'
        : v === 'exercises'
          ? mode === 'calisthenics'
            ? 'Skills'
            : 'Exercises'
          : 'Body';

  return (
    <Screen padded={false}>
      <View style={styles.tabsTopSpacer} />

      <View style={styles.modeRow}>
        <SegmentedControl
          options={MODES}
          value={mode}
          onChange={setMode}
          renderLabel={(m) => MODE_LABEL[m]}
          // Calisthenics wears its own accent, so the lens is recognisable
          // at a glance; the label says which it is, too.
          accentFor={(m) => (m === 'calisthenics' ? colors.accentCyan : colors.primary)}
        />
      </View>

      <SwipeTabs
        options={VIEWS}
        value={view}
        onChange={setView}
        renderLabel={label}
        // Each tab already owns its data, which is what makes them pageable:
        // a pager mounts every page, so a tab that only loaded when selected
        // would swipe onto a blank screen.
        renderPage={(v) =>
          v === 'log' ? (
            <LogTab />
          ) : v === 'routines' ? (
            <RoutinesTab />
          ) : v === 'exercises' ? (
            mode === 'calisthenics' ? (
              <SkillsTab />
            ) : (
              <ExercisesTab />
            )
          ) : (
            <BodyTab />
          )
        }
      />
    </Screen>
  );
}
