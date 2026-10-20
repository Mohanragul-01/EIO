/**
 * CalendarView - the month: what was paid, and what is still to come.
 *
 * Each day shows up to two tiles for what renews (a check for what was
 * paid), and tapping a day lists it underneath. A projection never runs
 * backwards: before a subscription's due date the calendar shows only what
 * was actually logged, so a past day is a record, not a guess.
 *
 * The footer answers the cash-flow question: paid so far this month, and
 * still to pay.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { GlassCard, MonthCalendar, type CalendarDay } from '../../../core/components';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { monthBounds } from '../../../core/date';
import { formatMoney } from '../../../core/money';
import { fonts, radius, spacing } from '../../../core/theme';
import { shortDate } from '../format';
import type { Subscription } from '../types';
import { monthCharges, type Charge } from '../upcoming';
import { usePaymentsBetween } from '../useSubscriptions';
import { BrandTile } from './BrandTile';

const KIND_WORD: Record<Charge['kind'], string> = {
  charge: 'Due',
  trial_end: 'Trial ends',
  paid: 'Paid',
};

export function CalendarView({
  subscriptions,
  today,
  paymentsVersion,
  onOpen,
}: {
  subscriptions: Subscription[];
  today: string;
  paymentsVersion: number;
  onOpen: (sub: Subscription) => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [year, setYear] = useState(Number(today.slice(0, 4)));
  const [month, setMonth] = useState(Number(today.slice(5, 7)));
  const [selected, setSelected] = useState<string | null>(today);

  const { start, end } = monthBounds(year, month);
  const { payments } = usePaymentsBetween(start, end, paymentsVersion);
  const view = useMemo(
    () => monthCharges(subscriptions, payments, year, month, today),
    [subscriptions, payments, year, month, today],
  );

  const describe = (charges: Charge[]): string | null => {
    if (charges.length === 0) return null;
    const paid = charges.filter((c) => c.kind === 'paid');
    const due = charges.filter((c) => c.kind === 'charge');
    const trials = charges.filter((c) => c.kind === 'trial_end');
    const sum = (list: Charge[]) => list.reduce((t, c) => t + (c.inrMinor ?? 0), 0);
    return [
      paid.length ? `${paid.length} paid, ${formatMoney(sum(paid), { compact: true })}` : null,
      due.length
        ? `${due.length} due, ${formatMoney(sum(due), { compact: true })}`
        : null,
      trials.length ? `${trials.length} trial ${trials.length === 1 ? 'ends' : 'end'}` : null,
    ]
      .filter(Boolean)
      .join('; ');
  };

  const renderDay = (day: CalendarDay) => {
    const charges = view.days.get(day.iso) ?? [];
    const shown = charges.slice(0, 2);
    return (
      <View style={styles.cell}>
        <View
          style={[
            styles.number,
            day.isToday && styles.today,
            day.isSelected && styles.selected,
          ]}
        >
          {/* Today is bold and underlined too: the ring alone is colour alone. */}
          <Text
            style={[
              styles.numberText,
              !day.inMonth && styles.outside,
              day.isToday && styles.todayText,
              day.isSelected && styles.selectedText,
            ]}
          >
            {Number(day.iso.slice(8))}
          </Text>
        </View>
        <View style={styles.marks}>
          {shown.map((charge, i) =>
            charge.kind === 'paid' ? (
              <Ionicons
                key={`p${i}`}
                name="checkmark-circle"
                size={13}
                color={colors.success}
              />
            ) : (
              <BrandTile key={`c${i}`} sub={charge.sub} size={12} />
            ),
          )}
          {charges.length > 2 ? <Text style={styles.more}>+{charges.length - 2}</Text> : null}
        </View>
      </View>
    );
  };

  const selectedCharges = selected ? (view.days.get(selected) ?? []) : [];

  return (
    <View>
      <GlassCard>
        <MonthCalendar
          year={year}
          month={month}
          onChangeMonth={(y, m) => {
            setYear(y);
            setMonth(m);
            setSelected(null);
          }}
          selected={selected}
          onSelect={setSelected}
          renderDay={renderDay}
          dayLabel={(day) => describe(view.days.get(day.iso) ?? [])}
        />
        <View style={styles.footer}>
          <View style={styles.footerItem}>
            <Text style={styles.footerLabel}>Paid</Text>
            <Text style={styles.footerValue}>{formatMoney(view.paidMinor, { compact: true })}</Text>
          </View>
          <View style={styles.footerItem}>
            <Text style={styles.footerLabel}>Still to pay</Text>
            <Text style={styles.footerValue}>
              {formatMoney(view.stillToPayMinor, { compact: true })}
            </Text>
          </View>
        </View>
      </GlassCard>

      {selected ? (
        <View style={styles.dayList}>
          <Text style={styles.dayTitle}>{shortDate(selected, today)}</Text>
          {selectedCharges.length === 0 ? (
            <Text style={styles.empty}>Nothing due or paid this day.</Text>
          ) : (
            selectedCharges.map((charge, i) => (
              <Pressable
                key={`${charge.sub.id}-${charge.kind}-${i}`}
                onPress={() => onOpen(charge.sub)}
                style={({ pressed }) => [styles.item, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={`${charge.sub.name}, ${KIND_WORD[charge.kind]}${
                  charge.inrMinor !== null ? `, ${formatMoney(charge.inrMinor, { compact: true })}` : ''
                }`}
              >
                <BrandTile sub={charge.sub} size={30} />
                <View style={styles.itemText}>
                  <Text style={styles.itemName} numberOfLines={1}>
                    {charge.sub.name}
                  </Text>
                  <Text
                    style={[
                      styles.itemKind,
                      charge.kind === 'paid' && { color: colors.success },
                      charge.kind === 'trial_end' && { color: colors.info },
                    ]}
                  >
                    {KIND_WORD[charge.kind]}
                    {charge.kind === 'charge' && charge.date < today ? ' · overdue' : ''}
                  </Text>
                </View>
                <Text style={styles.itemAmount}>
                  {charge.inrMinor !== null ? formatMoney(charge.inrMinor, { compact: true }) : '—'}
                </Text>
              </Pressable>
            ))
          )}
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  cell: {
    alignItems: 'center',
    paddingVertical: 2,
    minHeight: 52,
  },
  number: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  today: {
    borderColor: colors.primary,
  },
  selected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  numberText: {
    ...typography.caption,
    ...typography.numeric,
    fontSize: 13,
    color: colors.text,
  },
  outside: {
    color: colors.textFaint,
  },
  todayText: {
    fontFamily: fonts.bold,
    textDecorationLine: 'underline',
  },
  selectedText: {
    color: colors.onPrimary,
  },
  marks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 16,
    marginTop: 2,
  },
  more: {
    ...typography.caption,
    fontSize: 9.5,
    lineHeight: 12,
    color: colors.textSecondary,
  },
  footer: {
    flexDirection: 'row',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.glassBorder,
  },
  footerItem: {
    flex: 1,
  },
  footerLabel: {
    ...typography.overline,
  },
  footerValue: {
    ...typography.h2,
    ...typography.numeric,
    marginTop: 2,
  },
  dayList: {
    marginTop: spacing.xl,
  },
  dayTitle: {
    ...typography.overline,
    marginBottom: spacing.sm,
  },
  empty: {
    ...typography.caption,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 56,
    borderBottomWidth: 1,
    borderBottomColor: colors.glassBorder,
  },
  pressed: {
    opacity: 0.7,
  },
  itemText: {
    flex: 1,
  },
  itemName: {
    ...typography.title,
    fontSize: 14,
  },
  itemKind: {
    ...typography.caption,
    fontSize: 12,
  },
  itemAmount: {
    ...typography.title,
    ...typography.numeric,
    fontSize: 14,
  },
}));
