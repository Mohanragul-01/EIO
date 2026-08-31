/**
 * ExerciseProgressScreen - is this lift going up?
 *
 * The one question a training log exists to answer, and the reason v1's
 * free-text workouts were replaced.
 *
 * Plots the HEAVIEST set per session rather than every set. A session has warm-
 * ups and back-off sets, so plotting all of them produces a sawtooth that hides
 * the trend inside it. Best-per-day is the line people mean by "progress".
 */
import { Ionicons } from '@expo/vector-icons';
import { useRoute, type RouteProp } from '@react-navigation/native';
import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { ActivityIndicator, Dimensions, Text, View } from 'react-native';
import { LineChart } from 'react-native-chart-kit';

import { EmptyState, FadeInView, GlassCard, Screen } from '../../../core/components';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { fonts, radius, spacing } from '../../../core/theme';
import type { RootStackParamList } from '../../../navigation/types';
import * as api from '../api';
import { estimatedOneRepMax, formatSet } from '../types';

type Route = RouteProp<RootStackParamList, 'ExerciseProgress'>;

type Point = { date: string; weight_kg: number; reps: number };

export function ExerciseProgressScreen() {
  const styles = useStyles();
  const { colors, isDark } = useTheme();
  const navigation = useNavigation();
  const route = useRoute<Route>();
  const { exerciseId, name } = route.params;

  const [points, setPoints] = useState<Point[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title: name });
  }, [navigation, name]);

  useEffect(() => {
    let active = true;
    api
      .listExerciseProgress(exerciseId)
      .then((rows) => {
        // No date filtering here any more: listExerciseProgress guarantees it.
        if (active) setPoints(rows);
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : 'Could not load progress');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [exerciseId]);

  /**
   * Best set per day, oldest first.
   *
   * "Best" is by estimated one-rep max, not raw weight, so a heavier set at
   * fewer reps does not always win. 100kg x 3 and 90kg x 8 are close in effort,
   * and ranking purely by weight would make dropping the reps look like
   * progress.
   */
  const daily = useMemo(() => {
    const byDate = new Map<string, Point>();

    points.forEach((point) => {
      const existing = byDate.get(point.date);
      if (
        !existing ||
        estimatedOneRepMax(point.weight_kg, point.reps) >
          estimatedOneRepMax(existing.weight_kg, existing.reps)
      ) {
        byDate.set(point.date, point);
      }
    });

    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, point]) => ({ ...point, date }));
  }, [points]);

  const best = useMemo(() => {
    if (points.length === 0) return null;
    return points.reduce((top, point) =>
      estimatedOneRepMax(point.weight_kg, point.reps) >
      estimatedOneRepMax(top.weight_kg, top.reps)
        ? point
        : top,
    );
  }, [points]);

  if (loading) {
    return (
      <Screen>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        <View style={styles.centered}>
          <Ionicons name="warning-outline" size={26} color={colors.danger} />
          <Text style={styles.error}>{error}</Text>
        </View>
      </Screen>
    );
  }

  if (daily.length === 0) {
    return (
      <Screen>
        <EmptyState
          icon="trending-up-outline"
          accent={colors.accentRose}
          title="Nothing logged yet"
          message={`Log some sets of ${name} and the trend appears here.`}
        />
      </Screen>
    );
  }

  const width = Dimensions.get('window').width - spacing.xl * 2;
  // At most twelve points: beyond that the labels overlap into mush on a phone.
  const shown = daily.slice(-12);

  return (
    <Screen padded={false}>
      <View style={styles.content}>
        <FadeInView>
          <GlassCard>
            <Text style={styles.label}>Best set</Text>
            {best ? (
              <>
                <Text style={styles.best}>{formatSet(best.weight_kg, best.reps)}</Text>
                <Text style={styles.hint}>
                  Estimated 1RM {estimatedOneRepMax(best.weight_kg, best.reps)} kg
                </Text>
              </>
            ) : null}
          </GlassCard>
        </FadeInView>

        {shown.length >= 2 ? (
          <FadeInView delay={60}>
            <Text style={styles.sectionLabel}>Heaviest set per session</Text>
            <LineChart
              data={{
                labels: shown.map((point) => point.date.slice(8, 10)), // day of month
                datasets: [
                  {
                    data: shown.map((point) => point.weight_kg),
                    color: () => colors.accentRose,
                    strokeWidth: 2,
                  },
                ],
              }}
              width={width}
              height={200}
              yAxisSuffix=" kg"
              withOuterLines={false}
              withShadow={false}
              chartConfig={{
                backgroundGradientFrom: 'transparent',
                backgroundGradientTo: 'transparent',
                backgroundGradientFromOpacity: 0,
                backgroundGradientToOpacity: 0,
                decimalPlaces: 0,
                color: (opacity = 1) =>
                  isDark
                    ? `rgba(255,255,255,${opacity * 0.25})`
                    : `rgba(17,24,39,${opacity * 0.18})`,
                labelColor: () => colors.textMuted,
                propsForBackgroundLines: {
                  strokeDasharray: '4 6',
                  stroke: colors.glassBorder,
                },
                propsForDots: { r: '3' },
                propsForLabels: { fontFamily: fonts.regular, fontSize: 10 },
              }}
              bezier
              style={styles.chart}
            />
          </FadeInView>
        ) : (
          <FadeInView delay={60}>
            <Text style={styles.hint}>
              One session logged. The trend line appears once there are two.
            </Text>
          </FadeInView>
        )}
      </View>
    </Screen>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: 104,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.xxl,
  },
  label: {
    ...typography.overline,
  },
  best: {
    ...typography.display,
    fontSize: 28,
    marginTop: spacing.xs,
  },
  hint: {
    ...typography.caption,
    marginTop: spacing.sm,
  },
  sectionLabel: {
    ...typography.overline,
    marginTop: spacing.xxl,
    marginBottom: spacing.md,
  },
  chart: {
    // chart-kit adds its own left padding for the y-axis; pulling back keeps
    // the plot aligned with the card above it.
    marginLeft: -spacing.lg,
    borderRadius: radius.md,
  },
  error: {
    ...typography.body,
    textAlign: 'center',
  },
}));
