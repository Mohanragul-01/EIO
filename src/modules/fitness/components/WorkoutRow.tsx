/**
 * WorkoutRow - one logged session.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '../../../core/components';
import { formatEventDate } from '../../../core/date';
import { radius, spacing } from '../../../core/theme';
import { formatDuration, workoutTypeDef, type Workout } from '../types';
import { makeStyles } from '../../../core/ThemeContext';

type WorkoutRowProps = {
  workout: Workout;
  onPress: () => void;
};

export function WorkoutRow({ workout, onPress }: WorkoutRowProps) {
  const styles = useStyles();
  const type = workoutTypeDef(workout.type);
  const duration = formatDuration(workout.duration_minutes);

  return (
    <GlassCard onPress={onPress} style={styles.card}>
      <View style={styles.row}>
        <View style={[styles.icon, { backgroundColor: type.color + '1F' }]}>
          <Ionicons name={type.icon} size={18} color={type.color} />
        </View>

        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{type.label}</Text>
            {duration ? (
              <View style={styles.durationChip}>
                <Text style={styles.durationText}>{duration}</Text>
              </View>
            ) : null}
          </View>

          {/* formatEventDate, not formatDueDate - a workout already happened,
              so "3 days overdue" would be nonsense here. */}
          <Text style={styles.date}>{formatEventDate(workout.date)}</Text>

          {workout.notes ? (
            <Text style={styles.notes} numberOfLines={2}>
              {workout.notes.replace(/\s+/g, ' ').trim()}
            </Text>
          ) : null}
        </View>
      </View>
    </GlassCard>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  card: {
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  body: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    ...typography.title,
    fontSize: 15,
  },
  durationChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  durationText: {
    ...typography.caption,
    fontSize: 10.5,
    color: colors.textSecondary,
  },
  date: {
    ...typography.caption,
    fontSize: 12,
    marginTop: 3,
  },
  notes: {
    ...typography.caption,
    fontSize: 12.5,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    lineHeight: 18,
  },
}));
