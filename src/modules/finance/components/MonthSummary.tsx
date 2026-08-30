/**
 * MonthSummary - the month switcher, the headline totals, and the category
 * breakdown bars.
 *
 * On the bars: this is a share-of-total breakdown, so a set of labelled bars
 * beats a pie chart. Comparing two adjacent bar lengths is something people
 * do accurately; comparing two pie slice angles is something people do badly.
 * It also needs no charting library, so nothing extra ships in the bundle.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '../../../core/components';
import { formatMoney } from '../../../core/money';
import { formatBalance } from '../analytics';
import { CategoryDonut } from './CategoryDonut';
import { radius, spacing } from '../../../core/theme';
import type { CategoryTotal } from '../useTransactions';
import { makeStyles, useTheme } from '../../../core/ThemeContext';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

type MonthSummaryProps = {
  year: number;
  month: number;
  /** Income minus expense across every transaction ever. */
  balanceMinor: number;
  spentMinor: number;
  earnedMinor: number;
  netMinor: number;
  categoryTotals: CategoryTotal[];
  isCurrentMonth: boolean;
  onStepMonth: (delta: number) => void;
};

export function MonthSummary({
  year,
  month,
  balanceMinor,
  spentMinor,
  earnedMinor,
  netMinor,
  categoryTotals,
  isCurrentMonth,
  onStepMonth,
}: MonthSummaryProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View>
      {/*
        Balance first, and outside the month switcher on purpose. Everything
        below changes when you step a month; this does not, and nesting it in
        there would suggest otherwise.
      */}
      <GlassCard style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Balance</Text>
        <Text
          style={[
            styles.balanceValue,
            { color: balanceMinor < 0 ? colors.danger : colors.text },
          ]}
        >
          {formatBalance(balanceMinor)}
        </Text>
        <Text style={styles.balanceCaption}>Everything in, minus everything out</Text>
      </GlassCard>

      {/*  Month switcher  */}
      <View style={styles.monthRow}>
        <Pressable onPress={() => onStepMonth(-1)} hitSlop={12} style={styles.arrow}>
          <Ionicons name="chevron-back" size={18} color={colors.textSecondary} />
        </Pressable>

        <View style={styles.monthLabel}>
          <Text style={styles.monthName}>{MONTH_NAMES[month - 1]}</Text>
          <Text style={styles.monthYear}>{year}</Text>
        </View>

        {/* Forward is disabled in the current month - there's no future data
            to look at, and letting people wander into empty months reads as
            a bug rather than a feature. */}
        <Pressable
          onPress={() => !isCurrentMonth && onStepMonth(1)}
          hitSlop={12}
          disabled={isCurrentMonth}
          style={[styles.arrow, isCurrentMonth && styles.arrowDisabled]}
        >
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </Pressable>
      </View>

      {/*  Headline totals  */}
      <GlassCard style={styles.totals}>
        <View style={styles.totalsRow}>
          <View style={styles.totalBlock}>
            <Text style={styles.totalLabel}>Spent</Text>
            <Text style={styles.totalSpent}>{formatMoney(spentMinor, { compact: true })}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.totalBlock}>
            <Text style={styles.totalLabel}>Received</Text>
            <Text style={styles.totalIncome}>{formatMoney(earnedMinor, { compact: true })}</Text>
          </View>
        </View>

        {/* Net only appears once there's income to net against - otherwise
            it just restates "Spent" with a minus sign. */}
        {earnedMinor > 0 ? (
          <View style={styles.netRow}>
            <Text style={styles.netLabel}>Net</Text>
            <Text style={[styles.netValue, { color: netMinor >= 0 ? colors.success : colors.danger }]}>
              {netMinor >= 0 ? '+' : '-'}
              {formatMoney(Math.abs(netMinor), { compact: true })}
            </Text>
          </View>
        ) : null}
      </GlassCard>

      {/*  Category breakdown  */}
      {categoryTotals.length > 0 ? (
        <View style={styles.breakdown}>
          <Text style={styles.breakdownLabel}>Where it went</Text>
          <CategoryDonut categoryTotals={categoryTotals} />
          {categoryTotals.map((category) => (
            <CategoryBar key={category.key} category={category} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function CategoryBar({ category }: { category: CategoryTotal }) {
  const styles = useStyles();
  /**
   * The bar grows from zero on mount. `useNativeDriver: false` is required
   * here because we're animating WIDTH, which is a layout property the native
   * driver can't handle - unlike opacity and transform. It's a short, small
   * animation on a handful of rows, so the cost is fine.
   */
  const width = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(width, {
      toValue: category.share,
      duration: 520,
      useNativeDriver: false,
    }).start();
  }, [category.share, width]);

  return (
    <View style={styles.categoryRow}>
      <View style={[styles.categoryIcon, { backgroundColor: category.color + '1F' }]}>
        <Ionicons name={category.icon as never} size={15} color={category.color} />
      </View>

      <View style={styles.categoryBody}>
        <View style={styles.categoryTop}>
          <Text style={styles.categoryLabel}>{category.label}</Text>
          <Text style={styles.categoryAmount}>
            {formatMoney(category.totalMinor, { compact: true })}
          </Text>
        </View>

        <View style={styles.track}>
          <Animated.View
            style={[
              styles.fill,
              {
                backgroundColor: category.color,
                // Interpolating a 0-1 share into a percentage string is how
                // you animate a proportional width in React Native.
                width: width.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        </View>
      </View>

      <Text style={styles.categoryPercent}>{Math.round(category.share * 100)}%</Text>
    </View>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  balanceCard: {
    marginBottom: spacing.xl,
  },
  balanceLabel: {
    ...typography.overline,
  },
  balanceValue: {
    ...typography.display,
    fontSize: 30,
    marginTop: spacing.xs,
  },
  balanceCaption: {
    ...typography.caption,
    fontSize: 11.5,
    marginTop: 2,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  arrow: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  arrowDisabled: {
    opacity: 0.3,
  },
  monthLabel: {
    alignItems: 'center',
  },
  monthName: {
    ...typography.h2,
  },
  monthYear: {
    ...typography.caption,
    fontSize: 11.5,
  },

  totals: {},
  totalsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  totalBlock: {
    flex: 1,
  },
  divider: {
    width: 1,
    height: 34,
    backgroundColor: colors.glassBorder,
    marginHorizontal: spacing.lg,
  },
  totalLabel: {
    ...typography.overline,
    fontSize: 10,
  },
  totalSpent: {
    ...typography.h2,
    fontSize: 19,
    marginTop: 4,
  },
  totalIncome: {
    ...typography.h2,
    fontSize: 19,
    color: colors.success,
    marginTop: 4,
  },
  netRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.glassBorder,
  },
  netLabel: {
    ...typography.overline,
    fontSize: 10,
  },
  netValue: {
    ...typography.title,
    fontSize: 15,
  },

  breakdown: {
    marginTop: spacing.xxl,
  },
  breakdownLabel: {
    ...typography.overline,
    marginBottom: spacing.lg,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  categoryIcon: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  categoryBody: {
    flex: 1,
  },
  categoryTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  categoryLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 13,
  },
  categoryAmount: {
    ...typography.caption,
    color: colors.text,
    fontSize: 13,
  },
  track: {
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.glass,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.pill,
  },
  categoryPercent: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textFaint,
    width: 34,
    textAlign: 'right',
    marginLeft: spacing.sm,
  },
}));
