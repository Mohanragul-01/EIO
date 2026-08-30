/**
 * TodoListScreen - four frequency tabs over one list of open tasks.
 *
 *  THE SCREEN PATTERN (shared by every module)
 *   1. call the module's hook for data and state
 *   2. render exactly one of: loading / empty / list
 *   3. refetch when the screen regains focus
 * The screen contains no Supabase code at all: it never imports the client.
 *
 * The tab lives in this screen's state rather than in navigation, because it
 * is a filter over one list, not a destination. Switching tabs rebuilds the
 * hook's loader and refetches, which is why useTodos takes the frequency.
 */
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';

import { Button, EmptyState, FadeInView, GlassCard, Screen } from '../../../core/components';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { motion, radius, spacing } from '../../../core/theme';
import type { RootStackParamList } from '../../../navigation/types';
import { FrequencyTabs } from '../components/FrequencyTabs';
import { TaskRow } from '../components/TaskRow';
import { FREQUENCY_LABEL, type Frequency } from '../types';
import { useTodos } from '../useTodos';

type Nav = NativeStackNavigationProp<RootStackParamList, 'TodoList'>;

export function TodoListScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();

  const [frequency, setFrequency] = useState<Frequency>('daily');
  const { todos, loading, refreshing, error, refresh, reload, complete } = useTodos(frequency);

  /**
   * useFocusEffect, not useEffect: this also runs when you pop back from the
   * edit screen, so a task you just added appears immediately. reload keeps one
   * identity for the life of the screen and always calls the latest loader, so
   * depending on it does not refetch in a loop.
   */
  useFocusEffect(
    useCallback(() => {
      reload(); // silent: no pull-to-refresh spinner on every return
    }, [reload]),
  );

  return (
    <Screen padded={false}>
      <View style={styles.tabsWrap}>
        <FrequencyTabs value={frequency} onChange={setFrequency} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={todos}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.list, todos.length === 0 && styles.listEmpty]}
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
            todos.length > 0 ? (
              <FadeInView>
                <Text style={styles.summary}>
                  {todos.length} open {todos.length === 1 ? 'task' : 'tasks'}
                </Text>
              </FadeInView>
            ) : null
          }
          ListEmptyComponent={
            <EmptyState
              icon="checkmark-done-outline"
              accent={colors.accentIndigo}
              title={`Nothing ${FREQUENCY_LABEL[frequency].toLowerCase()}`}
              message={
                frequency === 'daily'
                  ? 'Daily tasks you add here reset by repeating, not by being wiped.'
                  : `Add a ${FREQUENCY_LABEL[frequency].toLowerCase()} task and it will show up here.`
              }
              action={
                <Button
                  label="Add a task"
                  icon="add"
                  // Pre-select the tab you are looking at: adding a weekly task
                  // from the Weekly tab should not need the picker touched.
                  onPress={() => navigation.navigate('TodoEdit', { frequency })}
                />
              }
            />
          }
          renderItem={({ item, index }) => (
            <FadeInView delay={Math.min(index, 6) * motion.stagger}>
              <TaskRow
                todo={item}
                onToggle={() => complete(item)}
                onPress={() => navigation.navigate('TodoEdit', { id: item.id })}
              />
            </FadeInView>
          )}
        />
      )}

      {/* A failed background refresh should not interrupt what you are doing,
          so errors surface as a banner rather than an alert. */}
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

      {todos.length > 0 ? (
        <FadeInView style={styles.fabWrap} delay={120}>
          <Pressable
            onPress={() => navigation.navigate('TodoEdit', { frequency })}
            style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
            accessibilityRole="button"
            accessibilityLabel="Add a task"
          >
            <Ionicons name="add" size={26} color={colors.onPrimary} />
          </Pressable>
        </FadeInView>
      ) : null}
    </Screen>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  tabsWrap: {
    paddingHorizontal: spacing.xl,
    // Clears the transparent nav header, which the list used to do itself.
    paddingTop: 96,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: 110, // clears the FAB
  },
  listEmpty: {
    flexGrow: 1, // lets the empty state centre itself in what is left
  },
  summary: {
    ...typography.overline,
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
