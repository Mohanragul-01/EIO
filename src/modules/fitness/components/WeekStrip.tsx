/**
 * WeekStrip - sessions, volume and a streak over the last seven days.
 *
 * The strip is the point of this component. A list of past workouts tells you
 * what you did; seven bars tell you at a glance whether you have actually been
 * training this week. It is the cheapest version of the feedback loop that makes
 * keeping a log worth the effort.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { Animated, Text, View } from 'react-native';

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
};

export function WeekStrip({
  week,
  weekSessions,
  weekVolume,
  weekMax,
  streak,
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
          <DayBar key={day.date} day={day} max={weekMax} />
        ))}
      </View>
    </GlassCard>
  );
}

function DayBar({ day, max }: { day: DayCell; max: number }) {
  const styles = useStyles();
  const height = useRef(new Animated.Value(0)).current;

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
    <View style={styles.dayColumn}>
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
