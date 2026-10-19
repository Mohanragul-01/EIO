/**
 * ReminderSettings - the builder's reminder section.
 *
 * Two independent reminders, set in two rows:
 *   - a nudge: a switch, a time, and the days it runs (skipped on a day that
 *     already has an entry - see reminders.ts);
 *   - a date reminder: one of the module's date fields, on the day or a few
 *     days before.
 *
 * Permission is asked when you switch one ON, never earlier: a prompt that
 * arrives before you have asked for anything is the one people refuse. What
 * comes back is said in words, because "denied" and "this build cannot" need
 * different advice.
 */
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { radius, spacing } from '../../../core/theme';
import type { BuilderState } from '../builder';
import { ensurePermission, type PermissionState } from '../notifications';
import { parseReminderTime } from '../reminders';
import { WEEKDAY_LONG, type FieldDraft } from '../types';
import { PickerChip } from './PickerChip';

type ReminderPatch = Partial<
  Pick<BuilderState, 'reminderTime' | 'reminderDays' | 'reminderFieldRef' | 'reminderOffset'>
>;

type ReminderSettingsProps = {
  accent: string;
  time: string | null;
  days: number[];
  fieldRef: string | null;
  offset: number;
  /** The module's date fields, which a date reminder can follow. */
  dateDrafts: FieldDraft[];
  onChange: (patch: ReminderPatch) => void;
};

const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];
const WEEKDAYS = [1, 2, 3, 4, 5];
const OFFSETS = [
  { days: 0, label: 'On the day' },
  { days: 1, label: '1 day before' },
  { days: 2, label: '2 days before' },
  { days: 7, label: '1 week before' },
];

const PERMISSION_NOTE: Record<Exclude<PermissionState, 'granted'>, string> = {
  denied:
    'Notifications are off for EIO. Turn them on in Android Settings and these reminders will start.',
  unsupported:
    'This build cannot schedule reminders (Expo Go cannot). They are saved, and ring in the installed app.',
};

/** "8:30 pm", in the phone's own style. */
function formatTime(time: string): string {
  const parsed = parseReminderTime(time);
  if (!parsed) return time;
  return new Date(2000, 0, 1, parsed.hour, parsed.minute).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

const pad = (n: number) => String(n).padStart(2, '0');

export function ReminderSettings({
  accent,
  time,
  days,
  fieldRef,
  offset,
  dateDrafts,
  onChange,
}: ReminderSettingsProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [permission, setPermission] = useState<PermissionState | null>(null);

  const ask = async () => setPermission(await ensurePermission());

  const nudgeOn = time !== null;
  const sameDays = (list: number[]) =>
    list.length === days.length && list.every((day) => days.includes(day));

  const toggleDay = (day: number) =>
    onChange({
      reminderDays: days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort((a, b) => a - b),
    });

  return (
    <View>
      <Pressable
        onPress={() => {
          if (nudgeOn) onChange({ reminderTime: null });
          else {
            onChange({ reminderTime: '20:00', reminderDays: days.length ? days : EVERY_DAY });
            void ask();
          }
        }}
        style={styles.switchRow}
        accessibilityRole="switch"
        accessibilityState={{ checked: nudgeOn }}
        accessibilityLabel="Remind me to log"
      >
        <View style={styles.switchText}>
          <Text style={styles.title}>Remind me to log</Text>
          <Text style={styles.caption}>Skipped on a day that already has an entry.</Text>
        </View>
        <View style={[styles.switch, nudgeOn && { backgroundColor: accent + '4D', borderColor: accent }]}>
          <View style={[styles.knob, nudgeOn && [styles.knobOn, { backgroundColor: accent }]]} />
        </View>
      </Pressable>

      {nudgeOn && time ? (
        <View style={styles.block}>
          <Pressable
            onPress={() => setPickerOpen(true)}
            style={({ pressed }) => [styles.timeButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={`Reminder time, ${formatTime(time)}. Change it`}
          >
            <Ionicons name="alarm-outline" size={18} color={colors.textSecondary} />
            <Text style={styles.timeText}>{formatTime(time)}</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </Pressable>

          <View style={styles.row}>
            <PickerChip text="Every day" selected={sameDays(EVERY_DAY)} accent={accent} onPress={() => onChange({ reminderDays: EVERY_DAY })} />
            <PickerChip text="Weekdays" selected={sameDays(WEEKDAYS)} accent={accent} onPress={() => onChange({ reminderDays: WEEKDAYS })} />
          </View>

          <View style={styles.days}>
            {/* Monday first, as the calendar shows a week. */}
            {[1, 2, 3, 4, 5, 6, 0].map((day) => {
              const on = days.includes(day);
              return (
                <Pressable
                  key={day}
                  onPress={() => toggleDay(day)}
                  style={({ pressed }) => [
                    styles.day,
                    on && { backgroundColor: accent + '33', borderColor: accent },
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={WEEKDAY_LONG[day]}
                >
                  <Text style={[styles.dayText, on && styles.dayTextOn]}>
                    {WEEKDAY_LONG[day].slice(0, 2)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {days.length === 0 ? (
            <Text style={styles.warn}>Pick at least one day, or switch the reminder off.</Text>
          ) : null}
        </View>
      ) : null}

      {dateDrafts.length > 0 ? (
        <View style={styles.block}>
          <Text style={styles.title}>Remind me on a date</Text>
          <Text style={styles.caption}>{"A reminder for each entry's date in this field."}</Text>
          <View style={[styles.row, styles.rowSpaced]}>
            <PickerChip
              text="Off"
              selected={fieldRef === null}
              accent={accent}
              onPress={() => onChange({ reminderFieldRef: null })}
            />
            {dateDrafts.map((draft) => (
              <PickerChip
                key={draft.localId}
                text={draft.label.trim() || 'Untitled date'}
                icon="calendar-outline"
                selected={fieldRef === draft.localId}
                accent={accent}
                onPress={() => {
                  onChange({ reminderFieldRef: draft.localId });
                  if (fieldRef === null) void ask();
                }}
              />
            ))}
          </View>
          {fieldRef ? (
            <View style={[styles.row, styles.rowSpaced]}>
              {OFFSETS.map((option) => (
                <PickerChip
                  key={option.days}
                  text={option.label}
                  selected={offset === option.days}
                  accent={accent}
                  onPress={() => onChange({ reminderOffset: option.days })}
                />
              ))}
            </View>
          ) : null}
          {fieldRef ? (
            <Text style={styles.caption}>
              {time ? `At ${formatTime(time)}, your reminder time.` : 'At 9:00 am.'}
            </Text>
          ) : null}
        </View>
      ) : null}

      {permission && permission !== 'granted' && (nudgeOn || fieldRef) ? (
        <View style={styles.permission}>
          <Ionicons name="information-circle-outline" size={17} color={colors.info} />
          <Text style={styles.permissionText}>{PERMISSION_NOTE[permission]}</Text>
        </View>
      ) : null}

      {/* Mounted only while open: on Android this component IS the dialog. */}
      {pickerOpen && time ? (
        <DateTimePicker
          value={(() => {
            const parsed = parseReminderTime(time) ?? { hour: 20, minute: 0 };
            return new Date(2000, 0, 1, parsed.hour, parsed.minute);
          })()}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onValueChange={(_event, picked) => {
            setPickerOpen(false);
            if (picked) onChange({ reminderTime: `${pad(picked.getHours())}:${pad(picked.getMinutes())}` });
          }}
          onDismiss={() => setPickerOpen(false)}
        />
      ) : null}
    </View>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    minHeight: 48,
  },
  switchText: {
    flex: 1,
  },
  title: {
    ...typography.title,
    fontSize: 14.5,
  },
  caption: {
    ...typography.caption,
    marginTop: 2,
  },
  switch: {
    width: 46,
    height: 27,
    borderRadius: radius.pill,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  knob: {
    width: 19,
    height: 19,
    borderRadius: radius.pill,
    backgroundColor: colors.textMuted,
  },
  knobOn: {
    transform: [{ translateX: 19 }],
  },
  block: {
    marginTop: spacing.xl,
  },
  timeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    marginBottom: spacing.md,
  },
  timeText: {
    ...typography.title,
    ...typography.numeric,
    flex: 1,
  },
  pressed: {
    opacity: 0.7,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  rowSpaced: {
    marginTop: spacing.md,
  },
  days: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  day: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glass,
  },
  dayText: {
    ...typography.caption,
    fontSize: 12.5,
    color: colors.textSecondary,
  },
  dayTextOn: {
    color: colors.text,
    fontFamily: typography.title.fontFamily,
  },
  warn: {
    ...typography.caption,
    color: colors.warning,
    marginTop: spacing.sm,
  },
  permission: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  permissionText: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
  },
}));
