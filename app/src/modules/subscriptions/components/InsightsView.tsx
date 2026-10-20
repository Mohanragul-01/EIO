/**
 * InsightsView - what a week, a month or a year costs, and where it goes.
 *
 * The total is what was paid in the period plus what is still due in it, so
 * "this year" counts the renewals really left rather than a monthly figure
 * times twelve. Breakdowns are horizontal bars labelled "42% · ₹2,340", not a
 * donut: readable at phone width, and every bar names itself, so nothing
 * depends on matching a colour to a legend.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { categoryDef } from '../../../core/categories';
import { GlassCard, SegmentedControl } from '../../../core/components';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { addDaysISO } from '../../../core/date';
import { formatMoney } from '../../../core/money';
import { radius, spacing } from '../../../core/theme';
import { shortDate } from '../format';
import {
  PERIOD_LABEL,
  PERIODS,
  periodRange,
  periodTotals,
  perItemYearly,
  type Period,
  type Share,
} from '../insights';
import type { Subscription } from '../types';
import { projectedCharges } from '../upcoming';
import { usePaymentsBetween } from '../useSubscriptions';
import { BrandTile } from './BrandTile';

const PERIOD_TITLE: Record<Period, string> = {
  week: 'This week',
  month: 'This month',
  year: 'This year',
};

export function InsightsView({
  subscriptions,
  accountName,
  today,
  paymentsVersion,
  onOpen,
}: {
  subscriptions: Subscription[];
  accountName: (id: string | null) => string | null;
  today: string;
  paymentsVersion: number;
  onOpen: (sub: Subscription) => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [period, setPeriod] = useState<Period>('month');

  const range = periodRange(period, today);
  const { payments } = usePaymentsBetween(range.start, range.end, paymentsVersion);
  const totals = useMemo(
    () => periodTotals(subscriptions, payments, period, today),
    [subscriptions, payments, period, today],
  );
  const next30 = useMemo(
    () =>
      projectedCharges(subscriptions, today, addDaysISO(29), today).reduce(
        (sum, c) => (c.kind === 'charge' && c.inrMinor !== null ? sum + c.inrMinor : sum),
        0,
      ),
    [subscriptions, today],
  );
  const yearly = useMemo(() => perItemYearly(subscriptions, today), [subscriptions, today]);

  return (
    <View>
      <SegmentedControl
        options={PERIODS}
        value={period}
        onChange={setPeriod}
        renderLabel={(p) => PERIOD_LABEL[p]}
      />

      <GlassCard style={styles.card}>
        <Text style={styles.overline}>{PERIOD_TITLE[period]}</Text>
        <Text style={styles.range}>
          {shortDate(range.start, today)} – {shortDate(range.end, today)}
        </Text>
        <Text style={styles.total}>{formatMoney(totals.totalMinor, { compact: true })}</Text>
        <Text style={styles.split}>
          Paid {formatMoney(totals.paidMinor, { compact: true })} · Still due{' '}
          {formatMoney(totals.dueMinor, { compact: true })}
        </Text>
        <Text style={styles.footnote}>
          Paid counts payments marked paid here. Trials and prices without a rate are left out.
        </Text>
      </GlassCard>

      <GlassCard style={styles.card}>
        <View style={styles.inline}>
          <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.inlineLabel}>Next 30 days</Text>
          <Text style={styles.inlineValue}>{formatMoney(next30, { compact: true })}</Text>
        </View>
      </GlassCard>

      {totals.byCategory.length > 0 ? (
        <GlassCard style={styles.card}>
          <Text style={styles.overline}>By category</Text>
          {totals.byCategory.map((share) => {
            const def = categoryDef(share.key);
            return (
              <Bar
                key={share.key}
                share={share}
                label={def.label}
                icon={def.icon}
                color={def.color}
              />
            );
          })}
        </GlassCard>
      ) : null}

      {totals.byAccount.length > 0 ? (
        <GlassCard style={styles.card}>
          <Text style={styles.overline}>By account</Text>
          {totals.byAccount.map((share) => (
            <Bar
              key={share.key || 'none'}
              share={share}
              label={share.key ? (accountName(share.key) ?? 'An old account') : 'No account'}
              icon={share.key ? 'wallet-outline' : 'help-circle-outline'}
              color={colors.primary}
            />
          ))}
        </GlassCard>
      ) : null}

      {yearly.length > 0 ? (
        <GlassCard style={styles.card}>
          <Text style={styles.overline}>A year of each</Text>
          {yearly.map(({ sub, perYearMinor }) => (
            <Pressable
              key={sub.id}
              onPress={() => onOpen(sub)}
              style={({ pressed }) => [styles.item, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={`${sub.name}, ${formatMoney(perYearMinor, { compact: true })} a year`}
            >
              <BrandTile sub={sub} size={28} />
              <Text style={styles.itemName} numberOfLines={1}>
                {sub.name}
              </Text>
              <Text style={styles.itemValue}>
                {formatMoney(perYearMinor, { compact: true })}
                <Text style={styles.itemPer}> / yr</Text>
              </Text>
            </Pressable>
          ))}
        </GlassCard>
      ) : null}
    </View>
  );
}

/** One labelled bar: "Fun   42% · ₹2,340", the bar under it. */
function Bar({
  share,
  label,
  icon,
  color,
}: {
  share: Share;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View
      style={styles.bar}
      accessible
      accessibilityLabel={`${label}, ${share.pct} percent, ${formatMoney(share.minor, { compact: true })}`}
    >
      <View style={styles.barHead}>
        <Ionicons name={icon} size={14} color={colors.textSecondary} />
        <Text style={styles.barLabel} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.barValue}>
          {share.pct}% · {formatMoney(share.minor, { compact: true })}
        </Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.max(share.pct, 2)}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  card: {
    marginTop: spacing.lg,
  },
  overline: {
    ...typography.overline,
    marginBottom: spacing.xs,
  },
  range: {
    ...typography.caption,
  },
  total: {
    ...typography.display,
    ...typography.numeric,
    fontSize: 30,
    marginTop: spacing.sm,
  },
  split: {
    ...typography.caption,
    ...typography.numeric,
    marginTop: spacing.xs,
    color: colors.textSecondary,
  },
  footnote: {
    ...typography.caption,
    fontSize: 11.5,
    marginTop: spacing.md,
  },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  inlineLabel: {
    ...typography.title,
    fontSize: 14,
    flex: 1,
  },
  inlineValue: {
    ...typography.title,
    ...typography.numeric,
  },
  bar: {
    marginTop: spacing.md,
  },
  barHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  barLabel: {
    ...typography.caption,
    color: colors.text,
    flex: 1,
  },
  barValue: {
    ...typography.caption,
    ...typography.numeric,
    color: colors.textSecondary,
  },
  track: {
    height: 8,
    marginTop: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.glassStrong,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.pill,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 48,
  },
  pressed: {
    opacity: 0.7,
  },
  itemName: {
    ...typography.body,
    color: colors.text,
    flex: 1,
  },
  itemValue: {
    ...typography.title,
    ...typography.numeric,
    fontSize: 14,
  },
  itemPer: {
    ...typography.caption,
    color: colors.textMuted,
  },
}));
