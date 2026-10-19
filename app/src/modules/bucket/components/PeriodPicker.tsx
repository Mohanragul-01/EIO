/**
 * PeriodPicker - a year, and optionally a month, without paging a calendar.
 *
 * Backdating is the reason it exists: things on this list were done years
 * ago, and a month calendar reaches 2014 after 150 taps on "previous". So the
 * year is chosen from a decade at a time (three taps reach the 1990s), then a
 * month, or "Just the year" when that is all you remember. Plan targets use
 * the same control looking forward.
 *
 * Disabled options stay visible and say why by being dimmed and announced as
 * disabled - a memory cannot be in the future, a target cannot be in the past.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import type { CalendarDay } from '../../../core/components';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { radius, spacing } from '../../../core/theme';
import { MONTH_LONG, MONTH_SHORT } from '../when';

type PeriodPickerProps = {
  year: number;
  /** 1-12, or null for the whole year. */
  month: number | null;
  onChange: (year: number, month: number | null) => void;
  /** Offer "Just the year". */
  allowYearOnly?: boolean;
  minYear: number;
  maxYear: number;
  isMonthDisabled?: (year: number, month: number) => boolean;
};

export function PeriodPicker({
  year,
  month,
  onChange,
  allowYearOnly = false,
  minYear,
  maxYear,
  isMonthDisabled,
}: PeriodPickerProps) {
  const styles = useStyles();
  const { colors } = useTheme();

  // Which decade is showing. Starts at the chosen year's and is free to move
  // without changing the choice until a year is tapped.
  const [decade, setDecade] = useState(Math.floor(year / 10) * 10);

  const years = Array.from({ length: 10 }, (_, i) => decade + i);
  const canBack = decade > minYear;
  const canForward = decade + 9 < maxYear;

  const pickYear = (next: number) => {
    // Keep the month if it is still allowed in the new year; otherwise fall
    // back to the whole year (or the first allowed month) rather than holding
    // a choice the control would then show as disabled.
    if (month !== null && isMonthDisabled?.(next, month)) {
      const firstAllowed = Array.from({ length: 12 }, (_, i) => i + 1).find(
        (m) => !isMonthDisabled(next, m),
      );
      onChange(next, allowYearOnly ? null : (firstAllowed ?? month));
      return;
    }
    onChange(next, month);
  };

  return (
    <View>
      <View style={styles.decadeRow}>
        <Pressable
          onPress={() => setDecade(decade - 10)}
          disabled={!canBack}
          style={styles.arrow}
          accessibilityRole="button"
          accessibilityLabel="Earlier decade"
          accessibilityState={{ disabled: !canBack }}
        >
          <Ionicons
            name="chevron-back"
            size={18}
            color={canBack ? colors.textSecondary : colors.glassBorderStrong}
          />
        </Pressable>
        <Text style={styles.decade} accessibilityRole="header">
          {decade}s
        </Text>
        <Pressable
          onPress={() => setDecade(decade + 10)}
          disabled={!canForward}
          style={styles.arrow}
          accessibilityRole="button"
          accessibilityLabel="Later decade"
          accessibilityState={{ disabled: !canForward }}
        >
          <Ionicons
            name="chevron-forward"
            size={18}
            color={canForward ? colors.textSecondary : colors.glassBorderStrong}
          />
        </Pressable>
      </View>

      <View style={styles.grid}>
        {years.map((y) => {
          const disabled = y < minYear || y > maxYear;
          const selected = y === year;
          return (
            <Chip
              key={y}
              label={String(y)}
              selected={selected}
              disabled={disabled}
              onPress={() => pickYear(y)}
              width="18%"
              accessibilityLabel={String(y)}
            />
          );
        })}
      </View>

      <View style={[styles.grid, styles.months]}>
        {allowYearOnly ? (
          <Chip
            label="Just the year"
            selected={month === null}
            onPress={() => onChange(year, null)}
            width="100%"
            accessibilityLabel={`Just the year, ${year}`}
          />
        ) : null}
        {MONTH_SHORT.map((label, index) => {
          const m = index + 1;
          const disabled = isMonthDisabled?.(year, m) ?? false;
          return (
            <Chip
              key={label}
              label={label}
              selected={month === m}
              disabled={disabled}
              onPress={() => onChange(year, m)}
              width="23%"
              accessibilityLabel={`${MONTH_LONG[index]} ${year}`}
            />
          );
        })}
      </View>
    </View>
  );
}

function Chip({
  label,
  selected,
  disabled = false,
  onPress,
  width,
  accessibilityLabel,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
  width: `${number}%`;
  accessibilityLabel: string;
}) {
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      // 44 drawn, 48 to touch; the 8dp row gap keeps neighbours apart.
      hitSlop={{ top: 2, bottom: 2 }}
      style={({ pressed }) => [
        styles.chip,
        { width },
        selected && styles.chipOn,
        disabled && styles.chipDisabled,
        pressed && styles.pressed,
      ]}
      accessibilityRole="radio"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected, disabled }}
    >
      <Text
        style={[styles.chipText, selected && styles.chipTextOn, disabled && styles.chipTextDisabled]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * A day cell for the core MonthCalendar that can be out of bounds - a memory
 * cannot be tomorrow, a target cannot be yesterday. Drawn like the calendar's
 * own day, with today outlined and the choice filled, and dimmed when it
 * cannot be chosen. The caller ignores taps on those and says so via
 * dayLabel.
 */
export function PickDay({ day, disabled }: { day: CalendarDay; disabled: boolean }) {
  const styles = useStyles();
  return (
    <View
      style={[
        styles.day,
        day.isToday && styles.dayToday,
        day.isSelected && styles.daySelected,
        disabled && styles.chipDisabled,
      ]}
    >
      <Text
        style={[
          styles.dayNumber,
          (!day.inMonth || disabled) && styles.dayNumberMuted,
          day.isSelected && styles.dayNumberSelected,
        ]}
      >
        {Number(day.iso.slice(8))}
      </Text>
    </View>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  day: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  dayToday: { borderColor: colors.primary },
  daySelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayNumber: { ...typography.body, ...typography.numeric, color: colors.text },
  dayNumberMuted: { color: colors.textMuted },
  dayNumberSelected: { fontFamily: typography.title.fontFamily, color: colors.onPrimary },

  decadeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  arrow: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  decade: { ...typography.title, ...typography.numeric },

  // Fixed percentage widths spread by space-between: every row is full (ten
  // years in fives, twelve months in fours), so the columns line up.
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.sm,
  },
  months: { marginTop: spacing.md },
  chip: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glass,
  },
  chipOn: { borderColor: colors.primary, backgroundColor: colors.glassStrong },
  chipDisabled: { opacity: 0.45 },
  pressed: { opacity: 0.6 },
  chipText: { ...typography.caption, ...typography.numeric, color: colors.textSecondary },
  chipTextOn: { color: colors.primary, fontFamily: typography.title.fontFamily },
  chipTextDisabled: { color: colors.textMuted },
}));
