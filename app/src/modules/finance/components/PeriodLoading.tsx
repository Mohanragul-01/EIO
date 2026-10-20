/**
 * PeriodLoading - what stands where a month's figures go while that month
 * loads.
 *
 * Stepping to another month changes the title at once and its figures a
 * moment later. In between, this shows - never the last month's Spent, bars
 * or budgets under the new month's name. If the load failed, it says so here
 * as well as in the banner, since a blank space would read as "nothing spent".
 */
import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { spacing } from '../../../core/theme';
import { periodTitle, type Period } from '../period';

type PeriodLoadingProps = {
  period: Period;
  failed: boolean;
};

export function PeriodLoading({ period, failed }: PeriodLoadingProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const title = periodTitle(period);

  return (
    <View
      style={styles.block}
      accessible
      accessibilityLabel={failed ? `Could not load ${title}` : `Loading ${title}`}
    >
      {failed ? (
        <Text style={styles.text}>Could not load {title}. Pull down to try again.</Text>
      ) : (
        <ActivityIndicator color={colors.primary} />
      )}
    </View>
  );
}

const useStyles = makeStyles(({ typography }) => ({
  block: {
    // About the height of the totals card, so the page does not jump twice.
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  text: {
    ...typography.caption,
    textAlign: 'center',
  },
}));
