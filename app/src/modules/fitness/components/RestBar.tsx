/**
 * RestBar - the rest timer, floating above the bottom of the session screen.
 *
 * It starts by itself when a set is ticked, so resting needs no tap at all;
 * −15 / +15 / Skip are there for the times the default is wrong. Time is
 * computed from the end timestamp (restTimer.ts), so locking the phone or
 * switching apps mid-rest costs nothing: it is right the moment you look.
 *
 * WHEN IT ENDS: a warning haptic if the app is open, and a local notification
 * (with sound) scheduled for the end time, which is what reaches you when the
 * phone is in your pocket. The notification is moved whenever the time
 * changes and cancelled when the rest is skipped or this bar goes away.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { warning } from '../../../core/haptics';
import { cancel, schedule } from '../../../core/notifications';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { radius, spacing } from '../../../core/theme';
import { isFinished, progress, remainingMs, type RestState } from '../restTimer';
import { formatDuration } from '../types';

const NOTIFICATION_ID = 'fitness-rest';
const CHANNEL = { id: 'fitness-rest', name: 'Rest timer' };

/** Height the session screen leaves free under its content while the bar shows. */
export const REST_BAR_HEIGHT = 64;

export function RestBar({
  state,
  label,
  onAdjust,
  onSkip,
  onFinished,
}: {
  state: RestState;
  /** What the rest is after, e.g. "Squat". */
  label: string;
  onAdjust: (deltaSeconds: number) => void;
  onSkip: () => void;
  onFinished: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [now, setNow] = useState(() => Date.now());

  // Re-render four times a second while resting. The time shown is computed
  // from the clock each time, so a late tick never makes it wrong.
  useEffect(() => {
    if (!state) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [state]);

  // Keep the end notification at the end time; take it away when resting stops.
  const endsAt = state?.endsAt;
  useEffect(() => {
    if (endsAt === undefined) return;
    void schedule({
      id: NOTIFICATION_ID,
      date: new Date(endsAt),
      title: 'Rest over',
      body: label ? `Time for your next set of ${label}.` : 'Time for your next set.',
      channel: CHANNEL,
    });
    return () => {
      // Only a rest cut short (skipped, changed, or the screen left early)
      // takes its notification back. One that ran its course keeps it: the
      // notification is what plays the sound, and it fires at this moment.
      if (Date.now() < endsAt) void cancel(NOTIFICATION_ID);
    };
  }, [endsAt, label]);

  const finished = isFinished(state, now);
  useEffect(() => {
    if (!finished) return;
    warning();
    onFinished();
  }, [finished, onFinished]);

  if (!state || finished) return null;

  const left = remainingMs(state, now);

  return (
    <View pointerEvents="box-none" style={[styles.dock, { bottom: insets.bottom + spacing.lg }]}>
      <View style={styles.bar}>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${progress(state, now) * 100}%` }]} />
        </View>
        <View style={styles.row}>
          <Pressable
            onPress={() => onAdjust(-15)}
            accessibilityRole="button"
            accessibilityLabel="Rest 15 seconds less"
            style={({ pressed }) => [styles.step, pressed && styles.pressed]}
          >
            <Text style={styles.stepLabel}>−15</Text>
          </Pressable>

          <View
            style={styles.center}
            accessible
            accessibilityLabel={`Resting, ${Math.ceil(left / 1000)} seconds left`}
          >
            <Ionicons name="timer-outline" size={16} color={colors.primary} />
            <Text style={styles.time}>{formatDuration(Math.ceil(left / 1000))}</Text>
          </View>

          <Pressable
            onPress={() => onAdjust(15)}
            accessibilityRole="button"
            accessibilityLabel="Rest 15 seconds more"
            style={({ pressed }) => [styles.step, pressed && styles.pressed]}
          >
            <Text style={styles.stepLabel}>+15</Text>
          </Pressable>

          <Pressable
            onPress={onSkip}
            accessibilityRole="button"
            accessibilityLabel="Skip rest"
            style={({ pressed }) => [styles.skip, pressed && styles.pressed]}
          >
            <Text style={styles.skipLabel}>Skip</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const useStyles = makeStyles(({ colors, typography, elevation }) => ({
  dock: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
  },
  bar: {
    ...elevation.floating,
    minHeight: REST_BAR_HEIGHT,
    borderRadius: radius.md,
    backgroundColor: colors.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.glassBorderStrong,
    overflow: 'hidden',
  },
  track: {
    height: 3,
    backgroundColor: colors.glass,
  },
  fill: {
    height: 3,
    backgroundColor: colors.primary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  step: {
    minWidth: 56,
    minHeight: 48,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepLabel: {
    ...typography.title,
    ...typography.numeric,
    color: colors.textSecondary,
  },
  center: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  time: {
    ...typography.h2,
    ...typography.numeric,
  },
  skip: {
    minWidth: 64,
    minHeight: 48,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.glassStrong,
  },
  skipLabel: {
    ...typography.title,
    color: colors.primary,
  },
  pressed: {
    backgroundColor: colors.glass,
  },
}));
