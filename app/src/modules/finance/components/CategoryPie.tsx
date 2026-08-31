/**
 * CategoryPie - this month's expenses, by share.
 *
 * Sits above the ranked category bars rather than replacing them, because the
 * two answer different questions. The pie shows proportion at a glance ("most
 * of it went on rent"); the bars give the actual amounts, ordered. The bars
 * also serve as the legend, which is why the chart renders without one: a
 * second list of the same category names would be noise.
 *
 * A PIE, NOT A DONUT, and that was a correction. chart-kit has no donut mode,
 * so the first attempt faked the hole by overlaying a disc in the card colour.
 * That cannot work here: the card is translucent glass over the aurora, so an
 * opaque disc reads as a solid blob rather than a hole cut through the chart.
 * There is no single colour to paint it, because what is behind the ring is a
 * gradient that moves.
 */
import React from 'react';
import { Dimensions, View } from 'react-native';
import { PieChart } from 'react-native-chart-kit';

import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { spacing } from '../../../core/theme';
import type { CategoryTotal } from '../useTransactions';

type CategoryPieProps = {
  categoryTotals: CategoryTotal[];
};

export function CategoryPie({ categoryTotals }: CategoryPieProps) {
  const styles = useStyles();
  const { colors } = useTheme();

  // Nothing to divide up. An empty chart would just be a grey circle implying
  // something is still loading.
  if (categoryTotals.length === 0) return null;

  // Card gutters either side, so the chart never overflows on a narrow phone.
  // Read at render rather than module scope so a rotation is picked up.
  const width = Dimensions.get('window').width - spacing.xl * 2 - 36;

  const data = categoryTotals.map((category) => ({
    name: category.label,
    amount: category.totalMinor,
    color: category.color,
    // Required by the built-in legend, which is disabled below. The props still
    // have to type-check, hence the values.
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
        // chart-kit draws the pie offset from the left to leave room for its
        // legend. With the legend off, a quarter of the width brings it back
        // to the middle.
        paddingLeft={`${width / 4}`}
        hasLegend={false}
        chartConfig={{
          // Unused, since every slice carries an explicit colour, but the prop
          // is required.
          color: () => colors.text,
        }}
      />
    </View>
  );
}

const useStyles = makeStyles(() => ({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
}));
