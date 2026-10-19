/**
 * HistoryBars - one category over the last six finance months.
 *
 * Plain Views rather than a chart library: six bars and a line do not need
 * one, and the amounts are printed above each bar, so the figure is readable
 * without judging heights. The limit, when there is a budget, is a dashed line
 * across with its amount written on it.
 */
import React from 'react';
import { Text, View } from 'react-native';

import { formatMoney } from '../../../core/money';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { radius, spacing } from '../../../core/theme';
import { periodTitle, shortMonth, type Period } from '../period';

const HEIGHT = 110;

type HistoryBarsProps = {
  history: { period: Period; spentMinor: number }[];
  limitMinor: number | null;
  color: string;
};

/** "₹4.2k" - six amounts have to fit across a phone. */
function compact(minor: number): string {
  const rupees = minor / 100;
  if (rupees >= 100000) return `₹${(rupees / 100000).toFixed(rupees >= 1000000 ? 0 : 1)}L`;
  if (rupees >= 1000) return `₹${(rupees / 1000).toFixed(rupees >= 10000 ? 0 : 1)}k`;
  return `₹${Math.round(rupees)}`;
}

export function HistoryBars({ history, limitMinor, color }: HistoryBarsProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const top = Math.max(1, limitMinor ?? 0, ...history.map((h) => h.spentMinor));

  return (
    <View>
      <View style={styles.chart}>
        {limitMinor ? (
          <View
            style={[styles.limit, { bottom: (limitMinor / top) * HEIGHT, borderColor: colors.textMuted }]}
            pointerEvents="none"
          >
            <Text style={styles.limitText}>Limit {formatMoney(limitMinor, { compact: true })}</Text>
          </View>
        ) : null}

        {history.map((h, index) => {
          const last = index === history.length - 1;
          return (
            <View
              key={`${h.period.year}-${h.period.month}`}
              style={styles.column}
              accessible
              accessibilityLabel={`${periodTitle(h.period)}: ${formatMoney(h.spentMinor, { compact: true })}${
                limitMinor && h.spentMinor > limitMinor ? ', over the limit' : ''
              }`}
            >
              <Text style={[styles.amount, last && styles.amountCurrent]}>{compact(h.spentMinor)}</Text>
              <View
                style={[
                  styles.bar,
                  {
                    height: Math.max(2, (h.spentMinor / top) * HEIGHT),
                    backgroundColor: color,
                    opacity: last ? 1 : 0.55,
                  },
                ]}
              />
            </View>
          );
        })}
      </View>

      <View style={styles.labels}>
        {history.map((h, index) => (
          <Text
            key={`${h.period.year}-${h.period.month}`}
            style={[styles.label, index === history.length - 1 && styles.labelCurrent]}
            importantForAccessibility="no"
          >
            {shortMonth(h.period)}
          </Text>
        ))}
      </View>
    </View>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: HEIGHT + 22,
    gap: spacing.sm,
  },
  column: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  amount: {
    ...typography.caption,
    ...typography.numeric,
    fontSize: 10.5,
    lineHeight: 14,
    marginBottom: 4,
  },
  amountCurrent: {
    color: colors.text,
  },
  bar: {
    width: '70%',
    borderTopLeftRadius: radius.sm / 2,
    borderTopRightRadius: radius.sm / 2,
  },
  limit: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderStyle: 'dashed',
  },
  limitText: {
    ...typography.caption,
    ...typography.numeric,
    fontSize: 10.5,
    lineHeight: 14,
    alignSelf: 'flex-end',
    marginTop: 2,
  },
  labels: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  label: {
    ...typography.caption,
    fontSize: 11,
    flex: 1,
    textAlign: 'center',
  },
  labelCurrent: {
    color: colors.text,
  },
}));
