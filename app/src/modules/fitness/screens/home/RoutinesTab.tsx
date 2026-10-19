/**
 * RoutinesTab - The Routines tab: templates that pre-fill a session.
 *
 * Moved out of FitnessListScreen unchanged when the screen grew past what one
 * file holds comfortably; each tab owns its own data, which is what lets the
 * pager mount them all at once.
 */
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';

import { Button, EmptyState, FadeInView, GlassCard } from '../../../../core/components';
import { useTheme } from '../../../../core/ThemeContext';
import { motion } from '../../../../core/theme';
import { usePlan } from '../../useFitness';
import { useFitnessMode } from '../../useFitnessMode';
import type { RootStackParamList } from '../../../../navigation/types';
import { ErrorBanner, useHomeStyles } from './styles';

type Nav = NativeStackNavigationProp<RootStackParamList, 'FitnessList'>;

export function RoutinesTab() {
  const styles = useHomeStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();
  const plan = usePlan();
  const { loading, refreshing, error, refresh, reload, removeRoutine } = plan;
  const { mode } = useFitnessMode();
  // Each mode lists its own routines; a routine's mode is set when it is made.
  const routines = useMemo(
    () => plan.routines.filter((r) => r.mode === mode),
    [plan.routines, mode],
  );

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <FlatList
        data={routines}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.list, routines.length === 0 && styles.listEmpty]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.backgroundElevated}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="list-outline"
            accent={colors.accentIndigo}
            title="No routines yet"
            message="A routine is a template: a named list of exercises with target sets and reps. It logs nothing itself, it pre-fills a session."
            action={
              <Button
                label="New routine"
                icon="add"
                onPress={() => navigation.navigate('RoutineEdit', { mode })}
              />
            }
          />
        }
        renderItem={({ item, index }) => (
          <FadeInView delay={Math.min(index, 6) * motion.stagger}>
            <GlassCard
              style={styles.row}
              onPress={() => navigation.navigate('RoutineEdit', { routineId: item.id })}
            >
              <View style={styles.rowInner}>
                <View style={[styles.rowIcon, { backgroundColor: colors.accentIndigo + '1F' }]}>
                  <Ionicons name="list-outline" size={17} color={colors.accentIndigo} />
                </View>
                <Text style={[styles.rowTitle, styles.rowBody]} numberOfLines={1}>
                  {item.name}
                </Text>
                <Pressable
                  onPress={() =>
                    Alert.alert('Delete routine', 'Sessions you already logged from it are kept.', [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: () => void removeRoutine(item.id),
                      },
                    ])
                  }
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete the routine ${item.name}`}
                >
                  <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
                </Pressable>
              </View>
            </GlassCard>
          </FadeInView>
        )}
      />

      {error ? <ErrorBanner message={error} /> : null}

      {routines.length > 0 ? (
        <FadeInView style={styles.fabWrap} delay={120}>
          <Pressable
            onPress={() => navigation.navigate('RoutineEdit', { mode })}
            style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
            accessibilityRole="button"
            accessibilityLabel="New routine"
          >
            <Ionicons name="add" size={26} color={colors.onPrimary} />
          </Pressable>
        </FadeInView>
      ) : null}
    </>
  );
}
