/**
 * ReminderSettingsSheet - when every subscription reminds you, unless it has
 * its own choice.
 *
 * "On the day" is always on and shown locked: the floor that makes reminders
 * impossible to miss even when every earlier one has passed. The rest are
 * chips; the time is the phone's own clock picker. Saving rebuilds every
 * reminder at once, since they all just changed.
 */
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Platform, Pressable, Text } from 'react-native';

import { Button, Sheet } from '../../../core/components';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { radius, spacing } from '../../../core/theme';
import { offsetsLabel, timeLabel } from '../format';
import type { ReminderSettings } from '../types';
import { OffsetChips } from './OffsetChips';

export function ReminderSettingsSheet({
  visible,
  settings,
  onClose,
  onSave,
}: {
  visible: boolean;
  settings: ReminderSettings;
  onClose: () => void;
  onSave: (settings: ReminderSettings) => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [offsets, setOffsets] = useState<number[]>(settings.offsets);
  const [minutes, setMinutes] = useState(settings.minutes);
  const [picking, setPicking] = useState(false);

  // Seeded during render on each opening, so a cancelled edit is not kept.
  const identity = `${visible}:${settings.offsets.join(',')}:${settings.minutes}`;
  const [seeded, setSeeded] = useState(identity);
  if (seeded !== identity) {
    setSeeded(identity);
    setOffsets(settings.offsets);
    setMinutes(settings.minutes);
  }

  const now = new Date();
  const pickerValue = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    Math.floor(minutes / 60),
    minutes % 60,
  );

  return (
    <Sheet
      visible={visible}
      title="Renewal reminders"
      subtitle="For every subscription without its own"
      onClose={onClose}
      footer={
        <Button
          label="Save"
          icon="checkmark"
          onPress={() => onSave({ offsets: offsets.filter((n) => n > 0), minutes })}
        />
      }
    >
      <Text style={styles.label}>Remind me</Text>
      <OffsetChips value={offsets} onChange={setOffsets} />

      <Text style={[styles.label, styles.gap]}>At</Text>
      <Pressable
        onPress={() => setPicking(true)}
        style={({ pressed }) => [styles.time, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={`Reminder time ${timeLabel(minutes)}. Change`}
      >
        <Ionicons name="time-outline" size={18} color={colors.textSecondary} />
        <Text style={styles.timeText}>{timeLabel(minutes)}</Text>
        <Text style={styles.change}>Change</Text>
      </Pressable>

      <Text style={styles.summary}>
        {offsetsLabel([...offsets.filter((n) => n > 0), 0])}, at {timeLabel(minutes)}.
      </Text>

      {/* Mounted only while open: on Android the component IS the dialog. */}
      {picking ? (
        <DateTimePicker
          value={pickerValue}
          mode="time"
          is24Hour
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onValueChange={(_event, picked) => {
            setPicking(false);
            if (picked) setMinutes(picked.getHours() * 60 + picked.getMinutes());
          }}
          onDismiss={() => setPicking(false)}
        />
      ) : null}
    </Sheet>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  label: {
    ...typography.overline,
    marginBottom: spacing.sm,
  },
  gap: {
    marginTop: spacing.xl,
  },
  time: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  pressed: {
    opacity: 0.7,
  },
  timeText: {
    ...typography.title,
    ...typography.numeric,
    flex: 1,
  },
  change: {
    ...typography.caption,
    color: colors.primary,
  },
  summary: {
    ...typography.caption,
    marginTop: spacing.lg,
  },
}));
