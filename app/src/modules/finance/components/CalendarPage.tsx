/**
 * CalendarPage - the Finance screen's second tab: a month of days, each with
 * what it cost.
 *
 * "What happened on the 14th?" and "which days was I heavy?" are questions a
 * list answers slowly. Each day shows its spend, tinted against your usual
 * spending day (summary.spendLevels), with a plus where money came in. Tap a
 * day for its entries and "Add for 16 Oct".
 *
 * The amount is always printed, so the tint is never the only way to read a
 * day, and every cell tells TalkBack what it holds.
 */
import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

import { GlassCard, MonthCalendar, type CalendarDay } from '../../../core/components';
import { formatMoney } from '../../../core/money';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { layout, radius, spacing } from '../../../core/theme';
import { formatRange } from '../period';
import type { ListItem, SpendLevel } from '../summary';
import type { Account } from '../types';
import { useCalendarMonth } from '../useCalendarMonth';
import { DaySheet } from './DaySheet';

/** Alpha suffixes for the four tint levels over the "out" colour. */
const TINT: Record<SpendLevel, string | null> = { 0: null, 1: '1A', 2: '33', 3: '55', 4: '80' };

/** "₹1.2k" - a day cell is about 48dp wide. */
function cellAmount(minor: number): string {
  const rupees = minor / 100;
  if (rupees >= 100000) return `${(rupees / 100000).toFixed(rupees >= 1000000 ? 0 : 1)}L`;
  if (rupees >= 1000) return `${(rupees / 1000).toFixed(rupees >= 10000 ? 0 : 1)}k`;
  return `${Math.round(rupees)}`;
}

type CalendarPageProps = {
  accountsById: Map<string, Account>;
  onOpenItem: (item: ListItem) => void;
  onAdd: (date: string) => void;
};

export function CalendarPage({ accountsById, onOpenItem, onAdd }: CalendarPageProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const month = useCalendarMonth();
  const [selected, setSelected] = useState<string | null>(null);

  const renderDay = (day: CalendarDay) => {
    const total = month.totals.get(day.iso);
    const level = month.levels.get(day.iso) ?? 0;
    const tint = TINT[level];
    return (
      <View
        style={[
          styles.cell,
          tint && day.inMonth ? { backgroundColor: colors.accentRose + tint } : null,
          day.isToday && styles.today,
          day.isSelected && styles.selected,
        ]}
      >
        <Text style={[styles.number, !day.inMonth && styles.outside]}>{Number(day.iso.slice(8))}</Text>
        {day.inMonth && total?.outMinor ? (
          <Text style={styles.amount} numberOfLines={1}>
            {cellAmount(total.outMinor)}
          </Text>
        ) : null}
        {day.inMonth && total?.inMinor ? <Text style={styles.income}>+</Text> : null}
      </View>
    );
  };

  const dayLabel = (day: CalendarDay) => {
    const total = month.totals.get(day.iso);
    if (!total) return null;
    const parts: string[] = [];
    if (total.outMinor) parts.push(`${formatMoney(total.outMinor, { compact: true })} spent`);
    if (total.inMinor) parts.push(`${formatMoney(total.inMinor, { compact: true })} received`);
    return parts.join(', ') || null;
  };

  return (
    <>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <GlassCard>
          <MonthCalendar
            year={month.year}
            month={month.month}
            onChangeMonth={month.changeMonth}
            selected={selected}
            onSelect={setSelected}
            renderDay={renderDay}
            dayLabel={dayLabel}
          />
        </GlassCard>

        {month.loading ? (
          <ActivityIndicator color={colors.primary} style={styles.loading} />
        ) : (
          <View style={styles.footer}>
            <Text style={styles.footerTotals}>
              {formatRange(month.bounds)} · {formatMoney(month.summary.spentMinor, { compact: true })} out
              {month.summary.earnedMinor > 0
                ? ` · ${formatMoney(month.summary.earnedMinor, { compact: true })} in`
                : ''}
            </Text>
            <Text style={styles.footerNote}>
              Darker days cost more than your usual spending day. A + means money came in. Tap a day
              to see it or add to it.
            </Text>
            {month.error ? <Text style={styles.error}>{month.error}</Text> : null}
          </View>
        )}
      </ScrollView>

      <DaySheet
        date={selected}
        items={selected ? month.itemsOn(selected) : []}
        total={selected ? month.totals.get(selected) : undefined}
        accountsById={accountsById}
        onClose={() => setSelected(null)}
        onOpen={onOpenItem}
        onAdd={onAdd}
      />
    </>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: layout.aboveFab + spacing.xxxl,
  },
  cell: {
    width: '94%',
    minHeight: 50,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 3,
  },
  today: {
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  selected: {
    borderWidth: 2,
    borderColor: colors.text,
  },
  number: {
    ...typography.caption,
    ...typography.numeric,
    fontSize: 12.5,
    lineHeight: 16,
    color: colors.text,
  },
  outside: {
    color: colors.textFaint,
  },
  amount: {
    ...typography.caption,
    ...typography.numeric,
    fontSize: 10,
    lineHeight: 13,
    color: colors.textSecondary,
  },
  income: {
    ...typography.caption,
    fontSize: 11,
    lineHeight: 12,
    color: colors.success,
    position: 'absolute',
    top: 1,
    right: 4,
  },
  loading: {
    marginTop: spacing.xl,
  },
  footer: {
    marginTop: spacing.lg,
  },
  footerTotals: {
    ...typography.body,
    ...typography.numeric,
    color: colors.text,
  },
  footerNote: {
    ...typography.caption,
    marginTop: spacing.xs,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
    marginTop: spacing.sm,
  },
}));
