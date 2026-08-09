/**
 * DateField
 *
 * Quick-pick chips plus a native calendar for anything else.
 *
 * Two modes, because dates point in two directions:
 *   mode="due"    a deadline in the future (task due date, next bill).
 *                 Quick picks: Today, Tomorrow, Next week.
 *   mode="event"  something that already happened (a purchase, a workout).
 *                 Quick picks: Today, Yesterday. Future dates are blocked.
 *
 * Getting this wrong is invisible in code and obvious on screen: an expense
 * offering "Next week" implies you are scheduling a payment, and a past
 * purchase rendered through the due-date wording comes out as "3 days overdue".
 *
 * Most dates in a personal app are today or one day either side, so those are
 * one tap and the calendar is the fallback.
 */
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useState } from 'react';
import { Platform, Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { makeStyles, useTheme } from '../ThemeContext';
import { addDaysISO, formatDueDate, formatEventDate, fromISODate, toISODate, todayISO } from '../date';
import { radius, spacing } from '../theme';

export type DateFieldMode = 'due' | 'event';

type DateFieldProps = {
  label: string;
  /** 'YYYY-MM-DD', or null when no date is set. */
  value: string | null;
  onChange: (value: string | null) => void;
  mode?: DateFieldMode;
  /** False for columns that are NOT NULL: an event happened on some day. */
  allowClear?: boolean;
  style?: StyleProp<ViewStyle>;
};

const QUICK_PICKS: Record<DateFieldMode, { label: string; get: () => string }[]> = {
  due: [
    { label: 'Today', get: () => todayISO() },
    { label: 'Tomorrow', get: () => addDaysISO(1) },
    { label: 'Next week', get: () => addDaysISO(7) },
  ],
  event: [
    { label: 'Today', get: () => todayISO() },
    { label: 'Yesterday', get: () => addDaysISO(-1) },
  ],
};

export function DateField({
  label,
  value,
  onChange,
  mode = 'due',
  allowClear = true,
  style,
}: DateFieldProps) {
  const styles = useStyles();
  const [pickerOpen, setPickerOpen] = useState(false);

  const picks = QUICK_PICKS[mode];
  const format = mode === 'due' ? formatDueDate : formatEventDate;
  const matchesPick = value ? picks.some((p) => p.get() === value) : false;

  return (
    <View style={style}>
      <Text style={styles.label}>{label}</Text>

      <View style={styles.chipRow}>
        {picks.map((pick) => {
          const iso = pick.get();
          const selected = value === iso;
          return (
            <Chip
              key={pick.label}
              text={pick.label}
              selected={selected}
              // Tapping the active chip clears the date, but only where
              // clearing is allowed, or it would empty a required field.
              onPress={() => onChange(selected && allowClear ? null : iso)}
            />
          );
        })}

        <Chip
          text={value && !matchesPick ? format(value) : 'Pick a date'}
          icon="calendar-outline"
          selected={!!value && !matchesPick}
          onPress={() => setPickerOpen(true)}
        />
      </View>

      {value && allowClear ? (
        <Pressable onPress={() => onChange(null)} style={styles.clearRow} hitSlop={8}>
          <Ionicons name="close-circle" size={14} color={styles.clearIcon.color as string} />
          <Text style={styles.clearText}>Clear ({format(value)})</Text>
        </Pressable>
      ) : !value ? (
        <Text style={styles.hint}>{mode === 'due' ? 'No due date' : 'No date set'}</Text>
      ) : null}

      {/* Mounted only while open: on Android this component is the dialog, so
          leaving it mounted would keep reopening it. */}
      {pickerOpen && (
        <DateTimePicker
          value={value ? fromISODate(value) : new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          // An event cannot happen in the future. Constraining the input beats
          // validating it after the fact.
          maximumDate={mode === 'event' ? new Date() : undefined}
          /*
           * onValueChange / onDismiss, not onChange.
           *
           * The single onChange callback is deprecated in this version: it
           * bundled "user picked a date" and "user cancelled" into one call
           * that you had to disambiguate by inspecting event.type. The split
           * pair says which happened, so there is nothing to check.
           */
          onValueChange={(_event, selectedDate) => {
            setPickerOpen(false);
            if (selectedDate) {
              onChange(toISODate(selectedDate));
            }
          }}
          // Cancelled: close the picker and keep whatever was already set.
          onDismiss={() => setPickerOpen(false)}
        />
      )}
    </View>
  );
}

function Chip({
  text,
  onPress,
  selected,
  icon,
}: {
  text: string;
  onPress: () => void;
  selected: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const styles = useStyles();
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && styles.chipPressed,
      ]}
    >
      {icon ? (
        <Ionicons
          name={icon}
          size={13}
          color={selected ? colors.primary : colors.textMuted}
          style={styles.chipIcon}
        />
      ) : null}
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{text}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  label: {
    ...typography.overline,
    marginBottom: spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap', // wraps rather than overflowing on narrow screens
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  chipSelected: {
    backgroundColor: colors.primary + '26',
    borderColor: colors.primary + '6B',
  },
  chipPressed: {
    opacity: 0.7,
  },
  chipIcon: {
    marginRight: 5,
  },
  chipText: {
    fontFamily: typography.title.fontFamily,
    fontSize: 13,
    color: colors.textSecondary,
  },
  chipTextSelected: {
    color: colors.primary,
  },
  clearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: spacing.md,
  },
  clearIcon: {
    color: colors.textMuted,
  },
  clearText: {
    ...typography.caption,
  },
  hint: {
    ...typography.caption,
    marginTop: spacing.md,
  },
}));
