/**
 * MonthCalendar - one month as a grid of days, with month-to-month paging.
 *
 * Several modules need "this month at a glance": the days you trained, the
 * days a product was used, when bills fall due. The grid is the same each time
 * and only what sits inside a day differs, so the grid lives here and each
 * module draws its own day through `renderDay`. Without it, a day shows its
 * number, with today outlined and the selected day filled.
 *
 * Paging is by the arrows only, not by swiping: calendars sit inside the
 * swipeable tab pager, and two horizontal swipes in one place fight.
 *
 * The parent owns which month is showing (`year`, `month`, `onChangeMonth`),
 * so it can load that month's data when the month changes.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { makeStyles, useTheme } from '../ThemeContext';
import { addMonths, fromISODate, monthGrid, todayISO } from '../date';
import { radius, spacing } from '../theme';

export type CalendarDay = {
  iso: string;
  inMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
};

type MonthCalendarProps = {
  year: number;
  /** 1-12. */
  month: number;
  onChangeMonth: (year: number, month: number) => void;
  selected?: string | null;
  /** Without it, days are not pressable. */
  onSelect?: (iso: string) => void;
  /** Draws the inside of a day cell. The cell itself handles the press. */
  renderDay?: (day: CalendarDay) => React.ReactNode;
  /** 1 = Monday (the default), 0 = Sunday. */
  weekStartsOn?: 0 | 1;
};

export function MonthCalendar({
  year,
  month,
  onChangeMonth,
  selected = null,
  onSelect,
  renderDay,
  weekStartsOn = 1,
}: MonthCalendarProps) {
  const styles = useStyles();
  const { colors } = useTheme();

  const weeks = monthGrid(year, month, weekStartsOn);
  const today = todayISO();
  const monthPrefix = `${year}-${String(month).padStart(2, '0')}-`;
  const showingThisMonth = today.startsWith(monthPrefix);

  const title = new Date(year, month - 1, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  const step = (delta: number) => {
    const next = addMonths(year, month, delta);
    onChangeMonth(next.year, next.month);
  };

  const goToToday = () => {
    const now = fromISODate(today);
    onChangeMonth(now.getFullYear(), now.getMonth() + 1);
  };

  return (
    <View>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        <Pressable
          onPress={goToToday}
          disabled={showingThisMonth}
          accessibilityRole="button"
          accessibilityLabel="Go to this month"
          accessibilityState={{ disabled: showingThisMonth }}
          style={({ pressed }) => [
            styles.todayButton,
            pressed && styles.pressed,
            showingThisMonth && styles.todayButtonIdle,
          ]}
        >
          <Text style={styles.todayLabel}>Today</Text>
        </Pressable>
        <Pressable
          onPress={() => step(-1)}
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}
        >
          <Ionicons name="chevron-back" size={20} color={colors.textSecondary} />
        </Pressable>
        <Pressable
          onPress={() => step(1)}
          accessibilityRole="button"
          accessibilityLabel="Next month"
          style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}
        >
          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
        </Pressable>
      </View>

      {/* Weekday initials, taken from the first row so they follow weekStartsOn
          and the phone's language. Hidden from TalkBack: every day cell
          already says its weekday in full. */}
      <View style={styles.row} importantForAccessibility="no-hide-descendants">
        {weeks[0].map((iso) => (
          <Text key={iso} style={styles.weekday}>
            {fromISODate(iso).toLocaleDateString(undefined, { weekday: 'narrow' })}
          </Text>
        ))}
      </View>

      {weeks.map((week) => (
        <View key={week[0]} style={styles.row}>
          {week.map((iso) => {
            const day: CalendarDay = {
              iso,
              inMonth: iso.startsWith(monthPrefix),
              isToday: iso === today,
              isSelected: iso === selected,
            };
            const label =
              fromISODate(iso).toLocaleDateString(undefined, {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              }) + (day.isToday ? ', today' : '');
            const content = renderDay ? renderDay(day) : <DayNumber day={day} />;

            return onSelect ? (
              <Pressable
                key={iso}
                onPress={() => onSelect(iso)}
                accessibilityRole="button"
                accessibilityLabel={label}
                accessibilityState={{ selected: day.isSelected }}
                style={({ pressed }) => [styles.cell, pressed && styles.pressed]}
              >
                {content}
              </Pressable>
            ) : (
              <View key={iso} accessible accessibilityLabel={label} style={styles.cell}>
                {content}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

/** The default inside of a day: its number, outlined if today, filled if selected. */
function DayNumber({ day }: { day: CalendarDay }) {
  const styles = useStyles();
  return (
    <View
      style={[
        styles.dot,
        day.isToday && styles.dotToday,
        day.isSelected && styles.dotSelected,
      ]}
    >
      <Text
        style={[
          styles.number,
          !day.inMonth && styles.numberOutside,
          day.isSelected && styles.numberSelected,
        ]}
      >
        {Number(day.iso.slice(8))}
      </Text>
    </View>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.h2,
    flex: 1,
  },
  todayButton: {
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    justifyContent: 'center',
  },
  todayButtonIdle: {
    opacity: 0.4,
  },
  todayLabel: {
    ...typography.title,
    color: colors.primary,
  },
  arrow: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    backgroundColor: colors.glass,
  },
  row: {
    flexDirection: 'row',
  },
  weekday: {
    ...typography.overline,
    flex: 1,
    textAlign: 'center',
    paddingVertical: spacing.xs,
  },
  cell: {
    flex: 1,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  dot: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  dotToday: {
    borderColor: colors.primary,
  },
  dotSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  number: {
    ...typography.body,
    ...typography.numeric,
    color: colors.text,
  },
  numberOutside: {
    color: colors.textFaint,
  },
  numberSelected: {
    fontFamily: typography.title.fontFamily,
    color: colors.onPrimary,
  },
}));
