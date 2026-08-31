/**
 * TrendChart - income against expense, one point per month.
 *
 * A line rather than bars: the question here is direction over time, and a
 * line answers that at a glance. Bars would be better for comparing two months
 * side by side, which is what the month switcher already does.
 *
 * Values are converted from paise to rupees only for the chart, because the
 * axis labels have to read as money. The underlying totals stay integer.
 */
import React from 'react';
import { Dimensions, Text, View } from 'react-native';
import { LineChart } from 'react-native-chart-kit';

import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { fonts, radius, spacing } from '../../../core/theme';
import type { MonthTotal } from '../analytics';

type TrendChartProps = {
  months: MonthTotal[];
};

export function TrendChart({ months }: TrendChartProps) {
  const styles = useStyles();
  const { colors, isDark } = useTheme();

  // One point is not a trend. Below two months there is nothing to show that
  // the headline figures do not already say.
  const hasData = months.some((m) => m.incomeMinor > 0 || m.expenseMinor > 0);
  if (months.length < 2 || !hasData) return null;

  const width = Dimensions.get('window').width - spacing.xl * 2;

  // Rupees, not paise: a y-axis reading 1250000 is unreadable.
  const toRupees = (minor: number) => Math.round(minor / 100);

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.label}>Last {months.length} months</Text>
        <View style={styles.keyRow}>
          <View style={styles.keyItem}>
            <View style={[styles.dot, { backgroundColor: colors.success }]} />
            <Text style={styles.keyText}>In</Text>
          </View>
          <View style={styles.keyItem}>
            <View style={[styles.dot, { backgroundColor: colors.accentRose }]} />
            <Text style={styles.keyText}>Out</Text>
          </View>
        </View>
      </View>

      <LineChart
        data={{
          labels: months.map((m) => m.label),
          datasets: [
            {
              data: months.map((m) => toRupees(m.incomeMinor)),
              color: () => colors.success,
              strokeWidth: 2,
            },
            {
              data: months.map((m) => toRupees(m.expenseMinor)),
              color: () => colors.accentRose,
              strokeWidth: 2,
            },
          ],
        }}
        width={width}
        height={190}
        // Rupee amounts are whole numbers here, so decimals on the axis would
        // be noise.
        yAxisLabel="₹"
        yAxisInterval={1}
        fromZero
        withInnerLines
        withOuterLines={false}
        withShadow={false}
        chartConfig={{
          backgroundGradientFrom: 'transparent',
          backgroundGradientTo: 'transparent',
          backgroundGradientFromOpacity: 0,
          backgroundGradientToOpacity: 0,
          decimalPlaces: 0,
          // chart-kit passes an opacity so lines and labels can share a colour
          // function. Both palettes need their own base, hence the theme read.
          color: (opacity = 1) =>
            isDark ? `rgba(255,255,255,${opacity * 0.25})` : `rgba(17,24,39,${opacity * 0.18})`,
          labelColor: () => colors.textMuted,
          propsForBackgroundLines: {
            strokeDasharray: '4 6', // dashed: grid should sit behind the data
            stroke: colors.glassBorder,
          },
          propsForDots: { r: '3' },
          propsForLabels: { fontFamily: fonts.regular, fontSize: 10 },
        }}
        bezier
        style={styles.chart}
      />
    </View>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  wrap: {
    marginTop: spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  label: {
    ...typography.overline,
  },
  keyRow: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  keyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: radius.pill,
  },
  keyText: {
    ...typography.caption,
    fontSize: 11.5,
  },
  chart: {
    // chart-kit adds its own left padding for the y-axis; pulling back keeps
    // the plot aligned with the cards above it.
    marginLeft: -spacing.lg,
    borderRadius: radius.md,
  },
}));
