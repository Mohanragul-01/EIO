/**
 * MonthSummary - the headline totals, how they compare with last month, and
 * where the money went.
 *
 * On the bars: this is a share-of-total breakdown, so a set of labelled bars
 * beats a pie chart for reading amounts. Comparing two adjacent bar lengths is
 * something people do accurately; comparing two slice angles is something
 * people do badly. The pie stays above them for proportion at a glance.
 *
 * Every figure here leaves transfers out (summary.ts): moving money between
 * your own accounts is not spending.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Animated, Pressable, Text, useAnimatedValue, View } from 'react-native';

import { GlassCard } from '../../../core/components';
import { formatMoney } from '../../../core/money';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { radius, spacing } from '../../../core/theme';
import { deltaSpoken, type CategoryTotal, type Delta, type PeriodSummary } from '../summary';
import { CategoryPie } from './CategoryPie';
import { DeltaText } from './DeltaText';

type MonthSummaryProps = {
  summary: PeriodSummary;
  deltas: { spent: Delta | null; earned: Delta | null; byCategory: Map<string, Delta | null> };
  /** Last month, as 'Sep' and 'September'. */
  versus: string;
  versusLong: string;
  onOpenCategory: (key: string) => void;
};

export function MonthSummary({ summary, deltas, versus, versusLong, onOpenCategory }: MonthSummaryProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { spentMinor, earnedMinor, netMinor, categoryTotals } = summary;

  return (
    <View>
      <GlassCard style={styles.totals}>
        <View style={styles.totalsRow}>
          <View style={styles.totalBlock}>
            <Text style={styles.totalLabel}>Spent</Text>
            <Text style={styles.totalSpent}>{formatMoney(spentMinor, { compact: true })}</Text>
            <DeltaText delta={deltas.spent} versus={versus} versusLong={versusLong} style={styles.delta} />
          </View>

          <View style={styles.divider} />

          <View style={styles.totalBlock}>
            <Text style={styles.totalLabel}>Received</Text>
            <Text style={styles.totalIncome}>{formatMoney(earnedMinor, { compact: true })}</Text>
            <DeltaText delta={deltas.earned} versus={versus} versusLong={versusLong} style={styles.delta} />
          </View>
        </View>

        {/* Net only appears once there's income to net against - otherwise
            it just restates "Spent" with a minus sign. */}
        {earnedMinor > 0 ? (
          <View style={styles.netRow}>
            <Text style={styles.netLabel}>Net</Text>
            <Text style={[styles.netValue, { color: netMinor >= 0 ? colors.success : colors.danger }]}>
              {netMinor >= 0 ? '+' : '−'}
              {formatMoney(Math.abs(netMinor), { compact: true })}
            </Text>
          </View>
        ) : null}
      </GlassCard>

      {categoryTotals.length > 0 ? (
        <View style={styles.breakdown}>
          <Text style={styles.breakdownLabel}>Where it went</Text>
          <CategoryPie categoryTotals={categoryTotals} />
          {categoryTotals.map((category) => (
            <CategoryBar
              key={category.key}
              category={category}
              delta={deltas.byCategory.get(category.key) ?? null}
              versus={versus}
              versusLong={versusLong}
              onPress={() => onOpenCategory(category.key)}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function CategoryBar({
  category,
  delta,
  versus,
  versusLong,
  onPress,
}: {
  category: CategoryTotal;
  delta: Delta | null;
  versus: string;
  versusLong: string;
  onPress: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  /**
   * The bar grows from zero on mount. `useNativeDriver: false` because this
   * animates WIDTH, a layout property the native driver cannot handle. A short
   * animation on a handful of rows, so the cost is fine.
   */
  const width = useAnimatedValue(0);

  React.useEffect(() => {
    Animated.timing(width, {
      toValue: category.share,
      duration: 520,
      useNativeDriver: false,
    }).start();
  }, [category.share, width]);

  const percent = Math.round(category.share * 100);
  const spoken = [
    category.label,
    formatMoney(category.totalMinor, { compact: true }),
    `${percent}% of spending`,
    delta ? deltaSpoken(delta, versusLong) : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.categoryRow, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={spoken}
      accessibilityHint={`Opens ${category.label} for this month and the last six`}
    >
      <View style={[styles.categoryIcon, { backgroundColor: category.color + '1F' }]}>
        <Ionicons name={category.icon as never} size={15} color={category.color} />
      </View>

      <View style={styles.categoryBody}>
        <View style={styles.categoryTop}>
          <Text style={styles.categoryLabel}>{category.label}</Text>
          <Text style={styles.categoryAmount}>{formatMoney(category.totalMinor, { compact: true })}</Text>
        </View>

        <View style={styles.track}>
          <Animated.View
            style={[
              styles.fill,
              {
                backgroundColor: category.color,
                width: width.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
              },
            ]}
          />
        </View>

        <View style={styles.categoryFoot}>
          <DeltaText delta={delta} versus={versus} versusLong={versusLong} />
          <Text style={styles.categoryPercent}>{percent}%</Text>
        </View>
      </View>

      <Ionicons name="chevron-forward" size={14} color={colors.textFaint} style={styles.chevron} />
    </Pressable>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  totals: {},
  totalsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  totalBlock: {
    flex: 1,
  },
  divider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: colors.glassBorder,
    marginHorizontal: spacing.lg,
  },
  totalLabel: {
    ...typography.overline,
    fontSize: 10,
  },
  totalSpent: {
    ...typography.h2,
    ...typography.numeric,
    fontSize: 19,
    marginTop: 4,
  },
  totalIncome: {
    ...typography.h2,
    ...typography.numeric,
    fontSize: 19,
    color: colors.success,
    marginTop: 4,
  },
  delta: {
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
    ...typography.numeric,
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
    minHeight: 48,
    marginBottom: spacing.md,
    borderRadius: radius.sm,
  },
  pressed: {
    opacity: 0.6,
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
    ...typography.numeric,
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
  categoryFoot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    minHeight: 15,
  },
  categoryPercent: {
    ...typography.caption,
    ...typography.numeric,
    fontSize: 11,
    lineHeight: 15,
    color: colors.textFaint,
  },
  chevron: {
    marginLeft: spacing.sm,
  },
}));
