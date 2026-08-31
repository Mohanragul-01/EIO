/**
 * RestTimer - a countdown between sets.
 *
 * PURELY LOCAL. Nothing is persisted and nothing is scheduled with the OS. A
 * rest timer is only meaningful while you are looking at it: a notification
 * ninety seconds later, after you have already done the next set, is worse than
 * no timer at all. Leave the screen and it is gone, which is correct.
 *
 * It counts down from a target rather than up, because the question during a
 * rest is "how much longer", not "how long has it been".
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { fonts, radius, spacing } from '../../../core/theme';
import { formatDuration } from '../types';

/** The usual rests. Anything else, tap again to add another 30. */
const PRESETS = [60, 90, 120, 180];

export function RestTimer() {
  const styles = useStyles();
  const { colors } = useTheme();

  const [target, setTarget] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(0);

  /**
   * The moment the timer should reach zero, not a decreasing counter.
   *
   * An interval that subtracts one each tick drifts, because setInterval is not
   * precise and JavaScript timers are throttled when the app is backgrounded.
   * Storing the deadline and recomputing from the clock means the display is
   * correct whenever it next renders, however long the gap was.
   */
  const deadline = useRef<number | null>(null);

  useEffect(() => {
    if (target === null) return;

    const tick = () => {
      if (deadline.current === null) return;
      const left = Math.ceil((deadline.current - Date.now()) / 1000);
      setRemaining(Math.max(0, left));
      if (left <= 0) {
        deadline.current = null;
        setTarget(null);
      }
    };

    tick(); // immediately, so the first second is not blank
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [target]);

  const start = (seconds: number) => {
    // Tapping a running timer adds time rather than restarting: mid-rest you
    // want thirty more seconds, not to start again from the top.
    const base = deadline.current && deadline.current > Date.now() ? deadline.current : Date.now();
    deadline.current = base + seconds * 1000;
    setTarget(seconds);
    setRemaining(Math.ceil((deadline.current - Date.now()) / 1000));
  };

  const stop = () => {
    deadline.current = null;
    setTarget(null);
    setRemaining(0);
  };

  if (target === null) {
    return (
      <View style={styles.presetRow}>
        <Ionicons name="timer-outline" size={15} color={colors.textMuted} />
        {PRESETS.map((seconds) => (
          <Pressable
            key={seconds}
            onPress={() => start(seconds)}
            style={({ pressed }) => [styles.preset, pressed && styles.pressed]}
          >
            <Text style={styles.presetText}>{formatDuration(seconds)}</Text>
          </Pressable>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.runningRow}>
      <Text style={styles.countdown}>{formatDuration(remaining)}</Text>

      <Pressable
        onPress={() => start(30)}
        style={({ pressed }) => [styles.action, pressed && styles.pressed]}
      >
        <Text style={styles.actionText}>+30s</Text>
      </Pressable>

      <Pressable onPress={stop} style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
        <Ionicons name="close" size={15} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  presetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  preset: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  presetText: {
    ...typography.caption,
    fontSize: 12,
    color: colors.textSecondary,
  },
  runningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  countdown: {
    fontFamily: fonts.bold,
    fontSize: 22,
    letterSpacing: -0.5,
    color: colors.primary,
    // Fixed-width digits, or the row jitters every time a digit changes.
    fontVariant: ['tabular-nums'],
  },
  action: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  actionText: {
    ...typography.caption,
    fontSize: 12,
    color: colors.textSecondary,
  },
  pressed: {
    opacity: 0.7,
  },
}));
