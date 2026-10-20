/**
 * MemoryFields - when it happened, what happened, where, and would you again.
 *
 * Every field is optional and Save works with all of them empty: a memory
 * that demands a paragraph gets skipped, and "Sometime in 2019" alone is
 * already worth having.
 *
 * WHEN is the one that matters most. All 818 items came in undone, so most
 * ticks are things done long ago, and a tick can only say "today". Earlier…
 * reaches back by decade and month, and stops at whatever you remember: just
 * the year, a month, or - if you want - the exact day.
 *
 * Shared by the sheet that follows a tick and the item sheet's Memory tab, so
 * the two never drift apart.
 */
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { MonthCalendar, TextField } from '../../../core/components';
import { makeStyles } from '../../../core/ThemeContext';
import { radius, spacing } from '../../../core/theme';
import { AGAINS, AGAIN_LABEL, type Again } from '../types';
import {
  addDaysTo,
  daysInMonth,
  describeWhen,
  isFutureWhen,
  partsOf,
  type WhenChoice,
} from '../when';
import { PeriodPicker, PickDay } from './PeriodPicker';

export type MemoryDraft = {
  when: WhenChoice;
  memory: string;
  place: string;
  again: Again | null;
};

/** How far back Earlier… reaches. A lifetime, not a decade. */
const YEARS_BACK = 90;

type MemoryFieldsProps = {
  draft: MemoryDraft;
  onChange: (draft: MemoryDraft) => void;
  today: string;
};

export function MemoryFields({ draft, onChange, today }: MemoryFieldsProps) {
  const styles = useStyles();
  const now = partsOf(today);
  const { when } = draft;

  const set = (patch: Partial<MemoryDraft>) => onChange({ ...draft, ...patch });

  /** Where Earlier… opens: the yesterday-or-earlier month you are most likely after. */
  const startEarlier = (): WhenChoice => {
    if (when.kind === 'earlier') return when;
    const lastMonth = partsOf(addDaysTo(`${now.year}-${String(now.month).padStart(2, '0')}-01`, -1));
    return { kind: 'earlier', year: lastMonth.year, month: lastMonth.month, day: null };
  };

  return (
    <View>
      <Text style={styles.label}>When</Text>
      <View style={styles.row}>
        <Option
          label="Today"
          selected={when.kind === 'today'}
          onPress={() => set({ when: { kind: 'today' } })}
        />
        <Option
          label="Yesterday"
          selected={when.kind === 'yesterday'}
          onPress={() => set({ when: { kind: 'yesterday' } })}
        />
        <Option
          label="Earlier…"
          selected={when.kind === 'earlier'}
          onPress={() => set({ when: startEarlier() })}
        />
      </View>

      {when.kind === 'earlier' ? (
        <View style={styles.earlier}>
          <PeriodPicker
            year={when.year}
            month={when.month}
            allowYearOnly
            minYear={now.year - YEARS_BACK}
            maxYear={now.year}
            isMonthDisabled={(y, m) => isFutureWhen({ kind: 'earlier', year: y, month: m, day: null }, today)}
            // A new month drops the day: the 14th of March is not the 14th of May.
            onChange={(year, month) => set({ when: { kind: 'earlier', year, month, day: null } })}
          />

          {when.month !== null ? (
            <View style={styles.calendar}>
              <Text style={styles.hint}>
                The day, if you know it. Tap it again to leave it out.
              </Text>
              <MonthCalendar
                year={when.year}
                month={when.month}
                onChangeMonth={(year, month) => {
                  if (isFutureWhen({ kind: 'earlier', year, month, day: null }, today)) return;
                  set({ when: { kind: 'earlier', year, month, day: null } });
                }}
                selected={
                  when.day
                    ? `${when.year}-${String(when.month).padStart(2, '0')}-${String(
                        Math.min(when.day, daysInMonth(when.year, when.month)),
                      ).padStart(2, '0')}`
                    : null
                }
                renderDay={(day) => <PickDay day={day} disabled={day.iso > today} />}
                dayLabel={(day) => (day.iso > today ? 'not yet, cannot be chosen' : null)}
                onSelect={(iso) => {
                  const { year, month, day } = partsOf(iso);
                  const choice: WhenChoice = { kind: 'earlier', year, month, day };
                  // Days after today are shown but cannot be chosen.
                  if (isFutureWhen(choice, today)) return;
                  // A second tap on the chosen day un-chooses it: back to "a
                  // day in March" rather than a day you are not sure of.
                  const same = when.day === day && when.month === month && when.year === year;
                  set({ when: { ...choice, day: same ? null : day } });
                }}
              />
            </View>
          ) : null}
        </View>
      ) : null}

      <Text style={styles.summary} accessibilityLiveRegion="polite">
        {describeWhen(when, today)}
      </Text>

      <TextField
        label="What happened?"
        value={draft.memory}
        onChangeText={(memory) => set({ memory })}
        placeholder="Optional - a line is plenty"
        multiline
        style={styles.spaced}
      />

      <TextField
        label="Where"
        value={draft.place}
        onChangeText={(place) => set({ place })}
        placeholder="Optional"
        style={styles.spaced}
      />

      <Text style={[styles.label, styles.spaced]}>Do it again?</Text>
      <View style={styles.row}>
        {AGAINS.map((again) => (
          <Option
            key={again}
            label={AGAIN_LABEL[again]}
            selected={draft.again === again}
            // Tapping the chosen answer clears it: "I have not decided" is a
            // real answer, and there is no other way back to it.
            onPress={() => set({ again: draft.again === again ? null : again })}
          />
        ))}
      </View>
    </View>
  );
}

function Option({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.option, selected && styles.optionOn, pressed && styles.pressed]}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
    >
      <Text style={[styles.optionText, selected && styles.optionTextOn]}>{label}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  label: { ...typography.overline, marginBottom: spacing.sm },
  spaced: { marginTop: spacing.lg },
  row: { flexDirection: 'row', gap: spacing.sm },
  option: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glass,
  },
  optionOn: { borderColor: colors.primary, backgroundColor: colors.glassStrong },
  optionText: { ...typography.body, fontSize: 14 },
  optionTextOn: { color: colors.primary, fontFamily: typography.title.fontFamily },
  pressed: { opacity: 0.6 },

  earlier: { marginTop: spacing.md },
  calendar: { marginTop: spacing.lg },
  hint: { ...typography.caption, marginBottom: spacing.sm },
  summary: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.md },
}));
