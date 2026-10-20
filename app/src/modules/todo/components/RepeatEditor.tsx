/**
 * RepeatEditor - how often, on which days, and counted from what.
 *
 * The unit is the task's frequency, chosen above it (it is also the tab the
 * task lives in), so this edits only what sits inside the unit: every N, the
 * weekdays of a weekly repeat, the day or the nth weekday of a monthly one,
 * and whether the next date follows the schedule or the day it was done.
 *
 * Underneath, the rule in a sentence and the next three dates it lands on -
 * the cheapest way to check a rule before trusting it with a routine.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { SegmentedControl } from '../../../core/components';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { radius, spacing } from '../../../core/theme';
import { Chip } from './Chip';
import {
  describeRule,
  firstDueDate,
  ordinal,
  toRule,
  upcomingDates,
  WEEKDAY_SHORT,
  weekdayOf,
  weekdayOrder,
  type RepeatFrom,
} from '../recurrence';
import { dueLabel } from '../today';
import type { Frequency } from '../types';

export type RuleDraft = {
  every: number;
  weekdays: number[] | null;
  anchorDay: number | null;
  nth: number | null;
  from: RepeatFrom;
};

type RepeatEditorProps = {
  frequency: Frequency;
  draft: RuleDraft;
  dueDate: string | null;
  today: string;
  onChange: (draft: RuleDraft) => void;
};

/** Monday first, the order the week is lived in. */
const WEEK = [1, 2, 3, 4, 5, 6, 0];
const UNIT_PLURAL: Record<Frequency, [string, string]> = {
  daily: ['day', 'days'],
  weekly: ['week', 'weeks'],
  monthly: ['month', 'months'],
  yearly: ['year', 'years'],
};
const NTHS = [1, 2, 3, 4, -1];

export function RepeatEditor({ frequency, draft, dueDate, today, onChange }: RepeatEditorProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const base = dueDate ?? today;
  const set = (patch: Partial<RuleDraft>) => onChange({ ...draft, ...patch });

  const byCompletion = draft.from === 'completion';
  const weekdays = draft.weekdays ?? [weekdayOf(base)];
  const monthlyByWeekday = draft.nth !== null;
  const anchor = draft.anchorDay ?? Number(base.slice(8, 10));

  const rule = toRule({ frequency, ...draft });
  const start = dueDate ?? firstDueDate(rule, today);
  const preview = upcomingDates(start, rule, 3);
  const [one, many] = UNIT_PLURAL[frequency];

  const toggleWeekday = (day: number) => {
    const next = weekdays.includes(day) ? weekdays.filter((d) => d !== day) : [...weekdays, day];
    // A weekly repeat needs at least one day; un-ticking the last one is ignored.
    if (next.length > 0) set({ weekdays: weekdayOrder(next) });
  };

  return (
    <View>
      {/* Every N: a stepper, since N is almost always 1-4. */}
      <View style={styles.everyRow}>
        <Text style={styles.label}>Every</Text>
        <Stepper
          value={draft.every}
          min={1}
          max={99}
          onChange={(every) => set({ every })}
          unit={draft.every === 1 ? one : many}
        />
      </View>

      <SegmentedControl
        label="Next one counted from"
        options={['due', 'completion'] as const}
        value={draft.from}
        onChange={(from) => set({ from })}
        renderLabel={(o) => (o === 'due' ? 'Due date' : 'When done')}
        style={styles.spaced}
      />

      {!byCompletion && frequency === 'weekly' ? (
        <View style={styles.spaced}>
          <Text style={styles.overline}>On</Text>
          <View style={styles.grid}>
            {WEEK.map((day) => (
              <Chip
                key={day}
                label={WEEKDAY_SHORT[day]}
                selected={weekdays.includes(day)}
                onPress={() => toggleWeekday(day)}
                style={styles.dayCell}
              />
            ))}
            <Chip
              label="Weekdays"
              selected={weekdays.length === 5 && [1, 2, 3, 4, 5].every((d) => weekdays.includes(d))}
              onPress={() => set({ weekdays: [1, 2, 3, 4, 5] })}
              style={styles.dayCell}
            />
          </View>
        </View>
      ) : null}

      {!byCompletion && frequency === 'monthly' ? (
        <View style={styles.spaced}>
          <SegmentedControl
            label="On"
            options={['day', 'weekday'] as const}
            value={monthlyByWeekday ? 'weekday' : 'day'}
            onChange={(mode) =>
              mode === 'day'
                ? set({ nth: null, weekdays: null, anchorDay: anchor })
                : set({
                    nth: Math.min(4, Math.ceil(Number(base.slice(8, 10)) / 7)),
                    weekdays: [weekdayOf(base)],
                    anchorDay: null,
                  })
            }
            renderLabel={(o) => (o === 'day' ? 'A day of the month' : 'A weekday')}
          />

          {monthlyByWeekday ? (
            <>
              <View style={[styles.grid, styles.gridSpaced]}>
                {NTHS.map((n) => (
                  <Chip
                    key={n}
                    label={n < 0 ? 'Last' : ordinal(n)}
                    selected={draft.nth === n}
                    onPress={() => set({ nth: n })}
                    style={styles.nthCell}
                  />
                ))}
              </View>
              <View style={[styles.grid, styles.gridSpaced]}>
                {WEEK.map((day) => (
                  <Chip
                    key={day}
                    label={WEEKDAY_SHORT[day]}
                    selected={(draft.weekdays?.[0] ?? weekdayOf(base)) === day}
                    onPress={() => set({ weekdays: [day] })}
                    style={styles.dayCell}
                  />
                ))}
              </View>
            </>
          ) : (
            <View style={[styles.everyRow, styles.gridSpaced]}>
              <Text style={styles.label}>Day</Text>
              <Stepper
                value={anchor}
                min={1}
                max={31}
                onChange={(day) => set({ anchorDay: day })}
                display={(day) => (day === 31 ? 'Last' : ordinal(day))}
              />
              <Chip
                label="Last day"
                selected={anchor === 31}
                onPress={() => set({ anchorDay: 31 })}
                accessibilityHint="The 31st, or the last day of a shorter month"
              />
            </View>
          )}
        </View>
      ) : null}

      <View style={styles.summary} accessibilityLiveRegion="polite">
        <View style={styles.summaryRow}>
          <Ionicons name="repeat" size={15} color={colors.primary} />
          <Text style={styles.summaryText}>{describeRule(rule, start)}</Text>
        </View>
        <Text style={styles.next}>
          Next: {preview.map((date) => dueLabel(date, null, today)).join('  ·  ')}
        </Text>
      </View>
    </View>
  );
}

/** A number with − and + either side, each a full 48dp target. */
function Stepper({
  value,
  min,
  max,
  onChange,
  unit,
  display,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  unit?: string;
  display?: (value: number) => string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const shown = display ? display(value) : String(value);

  return (
    <View style={styles.stepper}>
      <Pressable
        onPress={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        style={({ pressed }) => [styles.stepButton, pressed && styles.pressed, value <= min && styles.off]}
        accessibilityRole="button"
        accessibilityLabel="Fewer"
        accessibilityState={{ disabled: value <= min }}
      >
        <Ionicons name="remove" size={18} color={colors.text} />
      </Pressable>
      <Text
        style={styles.stepValue}
        accessibilityLabel={unit ? `${shown} ${unit}` : shown}
        accessibilityLiveRegion="polite"
      >
        {shown}
        {unit ? <Text style={styles.stepUnit}> {unit}</Text> : null}
      </Text>
      <Pressable
        onPress={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        style={({ pressed }) => [styles.stepButton, pressed && styles.pressed, value >= max && styles.off]}
        accessibilityRole="button"
        accessibilityLabel="More"
        accessibilityState={{ disabled: value >= max }}
      >
        <Ionicons name="add" size={18} color={colors.text} />
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  spaced: { marginTop: spacing.xl },
  label: { ...typography.title, fontSize: 14, minWidth: 44 },
  overline: { ...typography.overline, marginBottom: spacing.sm },
  everyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flexWrap: 'wrap',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  gridSpaced: { marginTop: spacing.md },
  // Four to a row: wide enough to read "Wed", and 48dp tall with 8dp gaps.
  dayCell: { flexBasis: '22%', flexGrow: 1, justifyContent: 'center' },
  nthCell: { flexBasis: '17%', flexGrow: 1, justifyContent: 'center' },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  stepButton: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  pressed: { opacity: 0.6 },
  off: { opacity: 0.35 },
  stepValue: {
    ...typography.title,
    ...typography.numeric,
    minWidth: 56,
    textAlign: 'center',
  },
  stepUnit: { ...typography.caption },
  summary: {
    marginTop: spacing.xl,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primary + '14',
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  summaryText: { ...typography.title, fontSize: 14, flex: 1 },
  next: { ...typography.caption, ...typography.numeric, color: colors.textSecondary, marginTop: 4 },
}));
