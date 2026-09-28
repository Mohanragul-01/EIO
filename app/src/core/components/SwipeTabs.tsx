/**
 * SwipeTabs - the Tabs row, plus swiping between the tabs it labels.
 *
 * Tapping a tab and swiping to it are the same action, so they have to stay in
 * step in both directions: tapping moves the pager, and swiping moves the
 * underline. The pager is the thing that actually holds position, so `value` is
 * pushed INTO it on tap and read back OUT of it on swipe - one owner, no
 * feedback loop.
 *
 * WHY A PAGER RATHER THAN A GESTURE ON THE LIST. react-native-pager-view is a
 * native pager on both platforms: the page follows your finger, snaps like the
 * rest of the OS, and - the part that matters - correctly arbitrates between a
 * horizontal swipe and the vertical scroll of the list inside it. A PanResponder
 * layered over a FlatList has to guess at that, and guesses wrong exactly when
 * you flick diagonally, which is most of the time.
 *
 * EVERY PAGE IS MOUNTED. That is the trade a pager makes: you cannot swipe to
 * something that has not rendered. So `renderPage` is called once per option at
 * mount, and each page loads its own data. For four small lists that is four
 * parallel queries instead of one - the cost of the tab you are about to reach
 * already being there when you get to it.
 */
import PagerView from 'react-native-pager-view';
import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { Tabs } from './Tabs';
import { makeStyles } from '../ThemeContext';
import { spacing } from '../theme';

type SwipeTabsProps<T extends string> = {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  renderLabel?: (option: T) => string;
  renderBadge?: (option: T) => number | null;
  /** The content for one tab. Called once per option, at mount. */
  renderPage: (option: T) => React.ReactNode;
};

export function SwipeTabs<T extends string>({
  options,
  value,
  onChange,
  renderLabel,
  renderBadge,
  renderPage,
}: SwipeTabsProps<T>) {
  const styles = useStyles();
  const pager = useRef<PagerView>(null);

  const index = Math.max(0, options.indexOf(value));

  /**
   * Drive the pager from `value`, for taps and for anything else that sets it.
   *
   * This also fires after a swipe, when `value` has just been set FROM the
   * pager - and setPage to the page it is already on is a no-op, so the loop
   * ends there rather than fighting the gesture.
   */
  useEffect(() => {
    pager.current?.setPage(index);
  }, [index]);

  return (
    <View style={styles.root}>
      <View style={styles.tabsWrap}>
        <Tabs
          options={options}
          value={value}
          onChange={onChange}
          renderLabel={renderLabel}
          renderBadge={renderBadge}
        />
      </View>

      <PagerView
        ref={pager}
        style={styles.pager}
        initialPage={index}
        // Fires when a swipe settles, not while it moves: the underline should
        // land with the page rather than smear across during the drag.
        onPageSelected={(event) => {
          const next = options[event.nativeEvent.position];
          if (next !== undefined && next !== value) onChange(next);
        }}
      >
        {options.map((option) => (
          // PagerView requires a plain View per page and reads `key` as the
          // page identity, so each page is wrapped rather than returned bare.
          <View key={option} style={StyleSheet.absoluteFill} collapsable={false}>
            {renderPage(option)}
          </View>
        ))}
      </PagerView>
    </View>
  );
}

const useStyles = makeStyles(() => ({
  root: { flex: 1 },
  tabsWrap: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.sm,
  },
  pager: { flex: 1 },
}));
