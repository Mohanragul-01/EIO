/**
 * CategoryDonut - this month's expenses, by share.
 *
 * Sits above the existing category bars rather than replacing them, because
 * the two answer different questions. The donut shows proportion at a glance
 * ("most of it went on rent"); the bars give you the actual amounts, ranked.
 * A pie alone would force you to compare slice angles, which people do badly.
 *
 * The bars below double as the legend, which is why the chart itself renders
 * without one: a second list of the same category names would be noise.
 */
import React from 'react';
import { Dimensions, View } from 'react-native';
import { PieChart } from 'react-native-chart-kit';

import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { spacing } from '../../../core/theme';
import type { CategoryTotal } from '../useTransactions';

type CategoryDonutProps = {
  categoryTotals: CategoryTotal[];
};

export function CategoryDonut({ categoryTotals }: CategoryDonutProps) {
  const styles = useStyles();
  const { colors } = useTheme();

  // Nothing to divide up. Rendering an empty ring would just be a grey circle
  // implying something is loading.
  if (categoryTotals.length === 0) return null;

  // The card gutters either side, so the chart never overflows on a narrow
  // phone. Read at render rather than module scope so a rotation is picked up.
  const width = Dimensions.get('window').width - spacing.xl * 2 - 36;

  const data = categoryTotals.map((category) => ({
    name: category.label,
    amount: category.totalMinor,
    color: category.color,
    // Required by the library's built-in legend, which is disabled below. The
    // values are still needed for the props to type-check.
    legendFontColor: colors.textSecondary,
    legendFontSize: 12,
  }));

  return (
    <View style={styles.wrap}>
      <PieChart
        data={data}
        width={width}
        height={168}
        accessor="amount"
        backgroundColor="transparent"
        paddingLeft={`${width / 4}`}
        hasLegend={false}
        // The hole that makes it a donut rather than a pie. A ring reads as a
        // composition of one whole; a filled circle invites reading the middle
        // as meaningful.
        center={[0, 0]}
        chartConfig={{
          // Unused with an explicit per-slice colour, but the prop is required.
          color: () => colors.text,
        }}
        absolute={false}
      />
      {/* Punched over the middle rather than drawn: chart-kit has no donut
          mode, and overlaying a disc in the card's own colour is both simpler
          and guaranteed to match whatever the theme is. */}
      <View style={styles.hole} pointerEvents="none" />
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  hole: {
    position: 'absolute',
    width: 84,
    height: 84,
    borderRadius: 42,
    // Matches the glass card it sits on, so the ring reads as cut out of the
    // chart rather than as a disc placed on top of it.
    backgroundColor: colors.backgroundElevated,
  },
}));
