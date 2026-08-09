/**
 * WeekSummary - sessions and minutes this week, a streak, and a seven-day
 * activity strip.
 *
 * The strip is the point of this component. A list of past workouts tells you
 * what you did; seven bars tell you at a glance whether you've actually been
 * training this week. It's the cheapest possible version of the feedback loop
 * that makes a log worth keeping.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '../../../core/components';
import { radius, spacing } from '../../../core/theme';
import { formatDuration } from '../types';
import type { DayCell } from '../useWorkouts';
import { makeStyles, useTheme } from '../../../core/ThemeContext';

type WeekSummaryProps = {
  week: DayCell[];
  weekSessions: number;
  weekMinutes: number;
  weekMax: number;
  streak: number;
};

export function WeekSummary({
  week,
  weekSessions,
  weekMinutes,
  weekMax,
  streak,
}: WeekSummaryProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const duration = formatDuration(weekMinutes);

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
          {/* Only shown when at least one session had a recorded duration -
              "0m" would imply you trained for no time at all. */}
          {duration ? <Text style={styles.sub}>{duration} total</Text> : null}
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
          <DayBar key={day.date} day={day} max={weekMax} />
        ))}
      </View>
    </GlassCard>
  );
}

function DayBar({ day, max }: { day: DayCell; max: number }) {
  const styles = useStyles();
  const height = useRef(new Animated.Value(0)).current;
  // Scale to the busiest day so a single-session day still shows a clear bar,
  // rather than a sliver against some arbitrary fixed maximum.
  const target = day.count === 0 ? 0 : day.count / max;

  useEffect(() => {
    Animated.timing(height, {
      toValue: target,
      duration: 480,
      // Animating height is a layout property, which the native driver can't
      // handle - same trade-off as the Finance category bars.
      useNativeDriver: false,
    }).start();
  }, [target, height]);

  return (
    <View style={styles.dayColumn}>
      <View style={styles.barTrack}>
        {day.count > 0 ? (
          <Animated.View
            style={[
              styles.barFill,
              {
                height: height.interpolate({
                  inputRange: [0, 1],
                  // Floor of 22% so a logged day is always visibly filled,
                  // never a hairline that reads as empty.
                  outputRange: ['22%', '100%'],
                }),
              },
            ]}
          />
        ) : null}
      </View>

      <Text style={[styles.dayLabel, day.isToday && styles.dayLabelToday]}>{day.label}</Text>
    </View>
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
    // Bars grow upward from the bottom of the track.
    justifyContent: 'flex-end',
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
