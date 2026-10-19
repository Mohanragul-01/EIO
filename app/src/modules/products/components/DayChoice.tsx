/**
 * DayChoice - Today · Yesterday · Pick a day.
 *
 * Most uses are logged for today, the next most for yesterday, so both are one
 * tap; anything older opens a month calendar inline. Inline rather than the
 * native date dialog, for three reasons: it can show which days already have a
 * use (a dot), it can show which days are out of reach (before the container
 * was opened, or in the future) instead of refusing them after the fact, and
 * it does not stack a native dialog on top of the sheet's own window.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { MonthCalendar, type CalendarDay } from '../../../core/components';
import { formatEventDate, fromISODate } from '../../../core/date';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { radius, spacing } from '../../../core/theme';
import { addDays } from '../types';

type DayChoiceProps = {
  label?: string;
  value: string;
  onChange: (iso: string) => void;
  /** The earliest day allowed - the container's opening day - or none. */
  min: string | null;
  /** The latest day allowed: today. */
  max: string;
  /** Days that already have a use, dotted in the calendar. */
  marked?: Set<string>;
};

export function DayChoice({ label = 'Day', value, onChange, min, max, marked }: DayChoiceProps) {
  const styles = useStyles();

  const yesterday = addDays(max, -1);
  const yesterdayAllowed = !min || yesterday >= min;
  const picked = value !== max && value !== yesterday;

  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(() => {
    const date = fromISODate(value);
    return { year: date.getFullYear(), month: date.getMonth() + 1 };
  });

  const inRange = (iso: string) => iso <= max && (!min || iso >= min);

  const choose = (iso: string) => {
    onChange(iso);
    setOpen(false);
  };

  const togglePicker = () => {
    if (!open) {
      const date = fromISODate(value);
      setShown({ year: date.getFullYear(), month: date.getMonth() + 1 });
    }
    setOpen(!open);
  };

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <Choice text="Today" selected={value === max} onPress={() => choose(max)} />
        {yesterdayAllowed ? (
          <Choice
            text="Yesterday"
            selected={value === yesterday}
            onPress={() => choose(yesterday)}
          />
        ) : null}
        <Choice
          text={picked ? formatEventDate(value) : 'Pick a day'}
          icon="calendar-outline"
          selected={picked || open}
          onPress={togglePicker}
          expanded={open}
        />
      </View>

      {open ? (
        <View style={styles.calendar}>
          <MonthCalendar
            year={shown.year}
            month={shown.month}
            onChangeMonth={(year, month) => setShown({ year, month })}
            selected={value}
            onSelect={(iso) => {
              if (inRange(iso)) choose(iso);
            }}
            dayLabel={(day) =>
              !inRange(day.iso) ? 'not available' : marked?.has(day.iso) ? 'already logged' : null
            }
            renderDay={(day: CalendarDay) => (
              <DayCell
                day={day}
                available={inRange(day.iso)}
                logged={!!marked?.has(day.iso)}
              />
            )}
          />
          <Text style={styles.hint}>
            {min
              ? `From ${formatEventDate(min)}, when it was opened, to today. A dot means something is already logged.`
              : 'Up to today. A dot means something is already logged.'}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function Choice({
  text,
  selected,
  onPress,
  icon,
  expanded,
}: {
  text: string;
  selected: boolean;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  expanded?: boolean;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityState={{ selected, expanded }}
    >
      {icon ? (
        <Ionicons name={icon} size={14} color={selected ? colors.primary : colors.textMuted} />
      ) : null}
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{text}</Text>
    </Pressable>
  );
}

function DayCell({
  day,
  available,
  logged,
}: {
  day: CalendarDay;
  available: boolean;
  logged: boolean;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.day,
        day.isToday && { borderColor: colors.primary },
        day.isSelected && { backgroundColor: colors.primary, borderColor: colors.primary },
      ]}
    >
      <Text
        style={[
          styles.dayNumber,
          (!day.inMonth || !available) && styles.dayUnavailable,
          day.isSelected && { color: colors.onPrimary },
        ]}
      >
        {Number(day.iso.slice(8))}
      </Text>
      <View
        style={[
          styles.dot,
          { backgroundColor: logged ? (day.isSelected ? colors.onPrimary : colors.accentCyan) : 'transparent' },
        ]}
      />
    </View>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  label: { ...typography.overline, marginBottom: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  chipSelected: { backgroundColor: colors.primary + '26', borderColor: colors.primary + '6B' },
  chipText: { ...typography.caption, color: colors.textSecondary },
  chipTextSelected: { color: colors.primary, fontWeight: '600' },
  pressed: { opacity: 0.7 },

  calendar: { marginTop: spacing.md },
  hint: { ...typography.caption, fontSize: 11.5, color: colors.textFaint, marginTop: spacing.xs },

  day: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  dayNumber: { ...typography.caption, ...typography.numeric, color: colors.text },
  dayUnavailable: { color: colors.textFaint, opacity: 0.5 },
  dot: { width: 4, height: 4, borderRadius: 2, marginTop: 1 },
}));
