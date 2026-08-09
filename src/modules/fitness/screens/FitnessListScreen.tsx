/**
 * FitnessListScreen - week summary on top, session log below.
 *
 * Structurally identical to the Finance list: a substantial header that
 * scrolls with the content, then rows. By the fifth module this file should
 * read as unsurprising - that's the goal of having one pattern.
 */
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';

import { Button, EmptyState, FadeInView, GlassCard, Screen } from '../../../core/components';
import { motion, radius, spacing } from '../../../core/theme';
import type { RootStackParamList } from '../../../navigation/types';
import { WeekSummary } from '../components/WeekSummary';
import { WorkoutRow } from '../components/WorkoutRow';
import { useWorkouts } from '../useWorkouts';
import { makeStyles, useTheme } from '../../../core/ThemeContext';

type Nav = NativeStackNavigationProp<RootStackParamList, 'FitnessList'>;

export function FitnessListScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();
  const { workouts, summary, loading, refreshing, error, refresh, reload } = useWorkouts();

  useFocusEffect(
    // reload keeps one identity for the life of the screen and always calls
    // the latest loader, so this can depend on it without refetching in a loop.
    useCallback(() => {
      reload();
    }, [reload]),
  );

  if (loading) {
    return (
      <Screen>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

  const hasData = workouts.length > 0;

  return (
    <Screen padded={false}>
      <FlatList
        data={workouts}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.list, !hasData && styles.listEmpty]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.backgroundElevated}
          />
        }
        ListHeaderComponent={
          hasData ? (
            <FadeInView>
              <WeekSummary
                week={summary.week}
                weekSessions={summary.weekSessions}
                weekMinutes={summary.weekMinutes}
                weekMax={summary.weekMax}
                streak={summary.streak}
              />
              <Text style={styles.sectionLabel}>
                History · {summary.totalSessions}{' '}
                {summary.totalSessions === 1 ? 'session' : 'sessions'}
              </Text>
            </FadeInView>
          ) : null
        }
        ListEmptyComponent={
          <EmptyState
            icon="barbell-outline"
            accent={colors.accentRose}
            title="No workouts logged"
            message="Log a session and the weekly strip starts filling in."
            action={
              <Button
                label="Log a workout"
                icon="add"
                onPress={() => navigation.navigate('WorkoutEdit', {})}
              />
            }
          />
        }
        renderItem={({ item, index }) => (
          <FadeInView delay={Math.min(index, 6) * motion.stagger}>
            <WorkoutRow
              workout={item}
              onPress={() => navigation.navigate('WorkoutEdit', { id: item.id })}
            />
          </FadeInView>
        )}
      />

      {error ? (
        <FadeInView style={styles.errorWrap}>
          <GlassCard style={styles.errorCard}>
            <View style={styles.errorRow}>
              <Ionicons name="warning-outline" size={17} color={colors.danger} />
              <Text style={styles.errorText} numberOfLines={2}>
                {error}
              </Text>
            </View>
          </GlassCard>
        </FadeInView>
      ) : null}

      {hasData ? (
        <FadeInView style={styles.fabWrap} delay={120}>
          <Pressable
            onPress={() => navigation.navigate('WorkoutEdit', {})}
            style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
            accessibilityRole="button"
            accessibilityLabel="Log a workout"
          >
            <Ionicons name="add" size={26} color={colors.onPrimary} />
          </Pressable>
        </FadeInView>
      ) : null}
    </Screen>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingHorizontal: spacing.xl,
    paddingTop: 104,
    paddingBottom: 110,
  },
  listEmpty: {
    flexGrow: 1,
    paddingTop: 80,
  },
  sectionLabel: {
    ...typography.overline,
    marginTop: spacing.xxl,
    marginBottom: spacing.lg,
  },
  fabWrap: {
    position: 'absolute',
    right: spacing.xl,
    bottom: spacing.xxl,
  },
  fab: {
    width: 58,
    height: 58,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 12,
  },
  fabPressed: {
    transform: [{ scale: 0.94 }],
    opacity: 0.9,
  },
  errorWrap: {
    position: 'absolute',
    left: spacing.xl,
    right: spacing.xl,
    bottom: spacing.xxl + 70,
  },
  errorCard: {
    borderColor: colors.danger + '55',
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  errorText: {
    ...typography.caption,
    color: colors.text,
    flex: 1,
  },
}));
