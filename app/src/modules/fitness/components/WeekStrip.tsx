/**
 * WeekStrip - sessions, volume and a streak over the last seven days.
 *
 * The strip is the point of this component. A list of past workouts tells you
 * what you did; seven bars tell you at a glance whether you have actually been
 * training this week. It is the cheapest version of the feedback loop that makes
 * keeping a log worth the effort.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect } from 'react';
import {
  Animated,
  Pressable,
  Text,
  useAnimatedValue,
  View,
} from 'react-native';

import { GlassCard } from '../../../core/components';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { radius, spacing } from '../../../core/theme';
import type { DayCell } from '../useFitness';

type WeekStripProps = {
  week: DayCell[];
  weekSessions: number;
  weekVolume: number;
  weekMax: number;
  streak: number;
  /**
   * Tap a day to open or log it.
   *
   * Backdating used to live only on a long press of the + button, which is
   * invisible - and forgetting to log is the entire reason it exists, so it
   * cannot be the one thing you have to already know about. Seven days are
   * already on screen; the day you missed is the obvious thing to point at.
   */
  onPickDay?: (date: string) => void;
};

export function WeekStrip({
  week,
  weekSessions,
  weekVolume,
  weekMax,
  streak,
  onPickDay,
}: WeekStripProps) {
  const styles = useStyles();
  const { colors } = useTheme();

  return (
    <GlassCard>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.label}>Last 7 days</Text>
          <Text style={styles.headline}>
            {weekSessions === 0
              ? 'No sessions'
              : `${weekSessions} ${weekSessions === 1 ? 'session' : 'sessions'}`}
          </Text>
          {/* Only when there is volume to report. "0 kg lifted" is a sentence
              that makes the card look broken rather than empty. */}
          {weekVolume > 0 ? (
            <Text style={styles.sub}>
              {weekVolume.toLocaleString('en-IN')} kg moved
            </Text>
          ) : null}
        </View>

        {streak > 1 ? (
          <View style={styles.streak}>
            <Ionicons name="flame" size={14} color={colors.warning} />
            <Text style={styles.streakText}>{streak} day streak</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.strip}>
        {week.map((day) => (
          <DayBar key={day.date} day={day} max={weekMax} onPress={onPickDay} />
        ))}
      </View>

      {onPickDay ? <Text style={styles.hint}>Tap a day to log or open it</Text> : null}
    </GlassCard>
  );
}

function DayBar({
  day,
  max,
  onPress,
}: {
  day: DayCell;
  max: number;
  onPress?: (date: string) => void;
}) {
  const styles = useStyles();
  const height = useAnimatedValue(0);

  // Scaled to the busiest day, so a single-session day still shows a clear bar
  // rather than a sliver against some arbitrary fixed maximum.
  const target = day.count === 0 ? 0 : day.count / max;

  useEffect(() => {
    Animated.timing(height, {
      toValue: target,
      duration: 480,
      // Height is a layout property, which the native driver cannot handle.
      // Same trade-off as the Finance category bars.
      useNativeDriver: false,
    }).start();
  }, [target, height]);

  return (
    <Pressable
      onPress={onPress ? () => onPress(day.date) : undefined}
      disabled={!onPress}
      style={({ pressed }) => [styles.dayColumn, pressed && styles.dayPressed]}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={
        onPress
          ? day.count > 0
            ? `${day.date}, ${day.count} ${day.count === 1 ? 'session' : 'sessions'}`
            : `${day.date}, nothing logged`
          : undefined
      }
      accessibilityHint={onPress ? (day.count > 0 ? 'Opens it' : 'Logs a workout on this day') : undefined}
    >
      <View style={styles.barTrack}>
        {day.count > 0 ? (
          <Animated.View
            style={[
              styles.barFill,
              {
                height: height.interpolate({
                  inputRange: [0, 1],
                  // Floor of 22%, so a day you trained always reads as filled
                  // rather than as a hairline that looks like nothing.
                  outputRange: ['22%', '100%'],
                }),
              },
            ]}
          />
        ) : null}
      </View>
      <Text style={[styles.dayLabel, day.isToday && styles.dayLabelToday]}>{day.label}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  label: {
    ...typography.overline,
  },
  headline: {
    ...typography.h2,
    marginTop: spacing.xs,
  },
  sub: {
    ...typography.caption,
    marginTop: 2,
  },
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.warning + '1A',
    borderWidth: 1,
    borderColor: colors.warning + '33',
  },
  streakText: {
    ...typography.caption,
    fontSize: 11.5,
    color: colors.warning,
  },
  strip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xl,
  },
  hint: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textFaint,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  dayPressed: { opacity: 0.55 },
  dayColumn: {
    flex: 1,
    alignItems: 'center',
  },
  barTrack: {
    width: '68%',
    height: 46,
    borderRadius: radius.sm,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    justifyContent: 'flex-end', // bars grow upward from the bottom
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    backgroundColor: colors.accentRose,
    borderRadius: radius.sm,
  },
  dayLabel: {
    ...typography.caption,
    fontSize: 10.5,
    color: colors.textFaint,
    marginTop: spacing.sm,
  },
  dayLabelToday: {
    color: colors.text,
  },
}));
